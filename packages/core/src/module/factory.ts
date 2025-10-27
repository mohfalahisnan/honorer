import type { Hono } from "hono"
import type { AppBindings, AppVariables } from "../app/factory"
import { Container, rootContainer } from "../di/container"
import { registerControllersWithModules } from "../utils/registerController"
import { getModuleMeta } from "./decorator"
import type { ModuleClass, ModuleMeta, ProviderToken } from "./types"
export interface OnModuleInit {
	onModuleInit(): Promise<void> | void
}

export interface OnModuleDestroy {
	onModuleDestroy(): Promise<void> | void
}
/**
 * Configuration for module registration
 */
export interface ModuleRegistrationConfig {
	/** Whether to enable debug logging */
	debug?: boolean
	/** Automatically run onModuleInit for providers after registration */
	autoInit?: boolean
}

/**
 * Factory for registering modules with dependency injection and middleware composition.
 */
export class ModuleRegistrationFactory {
	private registeredModules = new Set<ModuleClass>()
	private moduleContainers = new Map<ModuleClass, Container>()
	private currentModuleName = ""
	/** Instances that implement onModuleDestroy, grouped by module */
	private destroyRegistry = new Map<ModuleClass, any[]>()

	constructor(
		private app: Hono<{ Bindings: AppBindings; Variables: AppVariables }>,
		private rootContainer: Container,
		private config: ModuleRegistrationConfig = {},
	) {}

	/**
	 * Register a module with all its providers, controllers, and middleware.
	 * Handles circular dependencies and ensures proper initialization order.
	 *
	 * @param moduleClass The module class to register
	 * @returns Promise that resolves when module is fully registered
	 */
	/**
	 * Register a single module with all its dependencies.
	 *
	 * @param moduleClass Module class to register
	 */
	async registerModule(moduleClass: ModuleClass): Promise<void> {
		// Skip if already registered
		if (this.registeredModules.has(moduleClass)) {
			if (this.config.debug) {
				console.log(`Module ${moduleClass.name} already registered, skipping`)
			}
			return
		}

		// Mark as registered early to prevent circular dependencies
		this.registeredModules.add(moduleClass)
		this.currentModuleName = moduleClass.name

		try {
			const meta = getModuleMeta(moduleClass)
			if (!meta) {
				throw new Error(`Module ${moduleClass.name} is missing @Module decorator`)
			}

			// Create module-scoped container
			const moduleContainer = new Container(this.rootContainer)
			this.moduleContainers.set(moduleClass, moduleContainer)

			// Register the module in dependency order
			await this.registerImports(meta)
			this.importExportedProviders(meta, moduleContainer)
			this.registerProviders(meta, moduleContainer)
			await this.registerControllers(moduleClass, meta, moduleContainer)
			this.applyModuleMiddleware(meta)

			// Run lifecycle init hooks if enabled
			if (this.config.autoInit !== false) {
				await this.runInitHooksForModule(moduleClass, moduleContainer)
			}

			if (this.config.debug) {
				console.log(`Successfully registered module: ${moduleClass.name}`)
			}
		} catch (error) {
			// Remove from registered set if registration fails
			this.registeredModules.delete(moduleClass)
			throw new Error(`[${this.currentModuleName}] Registration failed → ${(error as Error).message}`)
		}
	}

	/**
	 * Register multiple modules in dependency order.
	 *
	 * @param modules Array of module classes to register
	 */
	async registerModules(modules: ModuleClass[]): Promise<void> {
		for (const moduleClass of modules) {
			await this.registerModule(moduleClass)
		}
	}

	/**
	 * Register imported modules (dependencies) first.
	 */
	private async registerImports(meta: ModuleMeta): Promise<void> {
		if (!meta.imports?.length) return

		const resolvedImports: ModuleClass[] = []
		for (const imported of meta.imports) {
			let modClass: ModuleClass | undefined
			// Already a decorated module class
			if (typeof imported === "function" && getModuleMeta(imported)) {
				modClass = imported as ModuleClass
			} else if (typeof imported === "function") {
				// Loader function returning a Promise
				const maybePromise = (imported as () => any)()
				const loaded = maybePromise instanceof Promise ? await maybePromise : maybePromise
				const resolved = loaded?.default ?? loaded
				if (typeof resolved === "function") {
					modClass = resolved as ModuleClass
				}
			} else if (imported && typeof (imported as any).then === "function") {
				// Direct Promise
				const loaded = await (imported as Promise<any>)
				const resolved = loaded?.default ?? loaded
				if (typeof resolved === "function") {
					modClass = resolved as ModuleClass
				}
				// biome-ignore lint/suspicious/noDuplicateElseIf: just 3 is safe
			} else if (typeof imported === "function") {
				modClass = imported as ModuleClass
			}

			if (!modClass) {
				if (this.config.debug) {
					console.warn("Skipping unresolved import in", this.currentModuleName)
				}
				continue
			}

			resolvedImports.push(modClass)
			await this.registerModule(modClass)
		}

		meta.imports = resolvedImports
	}

	/**
	 * Import exported providers from imported modules into the current module container.
	 */
	private importExportedProviders(meta: ModuleMeta, moduleContainer: Container): void {
		if (!meta.imports?.length) return

		for (const importedModule of meta.imports) {
			const importedMeta = getModuleMeta(importedModule)
			if (!importedMeta?.exports?.length) continue

			// Register exported providers as aliases to root singletons
			for (const exportedProvider of importedMeta.exports) {
				moduleContainer.register(exportedProvider, () => this.rootContainer.resolve(exportedProvider as any))
			}
		}
	}

	/**
	 * Register providers in the module-scoped container and root container.
	 */
	private registerProviders(meta: ModuleMeta, moduleContainer: Container): void {
		if (!meta.providers?.length) return

		for (const provider of meta.providers) {
			if (typeof provider === "function") {
				// Class provider
				this.rootContainer.register(provider, provider)
				// Alias in module container to lazily resolve from root
				moduleContainer.register(provider, () => this.rootContainer.resolve(provider))
				if (this.config.debug) {
					console.log(`Registered provider: ${provider.name}`)
				}
			} else if (typeof provider === "object" && "provide" in provider) {
				// Token-based provider
				if ("useClass" in provider && provider.useClass) {
					this.rootContainer.register(provider.provide, provider.useClass)
					moduleContainer.register(provider.provide, () => this.rootContainer.resolve(provider.provide))
				} else if ("useValue" in provider) {
					const valueFactory = () => provider.useValue
					this.rootContainer.register(provider.provide, valueFactory)
					moduleContainer.register(provider.provide, () => this.rootContainer.resolve(provider.provide))
				} else if ("useFactory" in provider && provider.useFactory) {
					const factory = provider.useFactory
					const deps = provider.inject || []
					const factoryWrapper = () => {
						const resolvedDeps = deps.map((dep) => this.rootContainer.resolve(dep))
						return factory(...resolvedDeps)
					}
					this.rootContainer.register(provider.provide, factoryWrapper)
					moduleContainer.register(provider.provide, () => this.rootContainer.resolve(provider.provide))
				}
				if (this.config.debug) {
					console.log(`Registered token provider: ${String(provider.provide)}`)
				}
			}
		}
	}

	/**
	 * Register controllers with proper middleware composition order.
	 * Middleware order: Module middleware -> Controller middleware -> Route middleware
	 */
	private async registerControllers(
		moduleClass: ModuleClass,
		meta: ModuleMeta,
		moduleContainer: Container,
	): Promise<void> {
		if (!meta.controllers?.length) return

		// Register controllers in module container first
		meta.controllers.forEach((ControllerClass) => {
			if (!moduleContainer.has(ControllerClass)) {
				moduleContainer.register(ControllerClass, ControllerClass)
				if (this.config.debug) {
					console.log(`Registered controller: ${ControllerClass.name}`)
				}
			}
		})

		// Register controllers with the app using enhanced module-aware registration
		await registerControllersWithModules(this.app, meta.controllers, {
			formatResponse: true,
			container: moduleContainer,
			basePath: meta?.prefix ?? "",
		})
	}

	/**
	 * Resolve all tokens in the module container and invoke onModuleInit if present.
	 * Collect instances that implement onModuleDestroy for later teardown.
	 */
	private async runInitHooksForModule(moduleClass: ModuleClass, moduleContainer: Container): Promise<void> {
		const tokens = moduleContainer.getTokens()
		const destroyables: any[] = []

		for (const token of tokens) {
			let instance: any
			try {
				instance = moduleContainer.resolve<any>(token)
			} catch (err) {
				if (this.config.debug) {
					console.warn(`Skipping init for token ${String(token)} in ${moduleClass.name}: not resolvable`)
				}
				continue
			}

			// Invoke initialization hook when available
			if (instance && typeof instance.onModuleInit === "function") {
				try {
					await instance.onModuleInit()
					if (this.config.debug) {
						console.log(
							`onModuleInit executed for ${instance.constructor?.name || String(token)} in ${moduleClass.name}`,
						)
					}
				} catch (e) {
					console.error(
						`onModuleInit failed for ${instance.constructor?.name || String(token)} in ${moduleClass.name}:`,
						e,
					)
					throw e
				}
			}

			// Track destroy hook for clean shutdown
			if (instance && typeof instance.onModuleDestroy === "function") {
				destroyables.push(instance)
			}
		}

		if (destroyables.length > 0) {
			this.destroyRegistry.set(moduleClass, destroyables)
		}
	}

	/**
	 * Get the current module name being registered.
	 */
	private getCurrentModuleName(): string {
		return this.currentModuleName
	}

	/**
	 * Teardown a specific module by invoking onModuleDestroy on tracked instances.
	 * Also clears its container and registration state.
	 */
	async destroyModule(moduleClass: ModuleClass): Promise<void> {
		const destroyables = this.destroyRegistry.get(moduleClass) || []

		for (const instance of destroyables) {
			try {
				await instance.onModuleDestroy()
				if (this.config.debug) {
					console.log(
						`onModuleDestroy executed for ${instance.constructor?.name || "instance"} in ${moduleClass.name}`,
					)
				}
			} catch (e) {
				console.error(
					`onModuleDestroy failed for ${instance.constructor?.name || "instance"} in ${moduleClass.name}:`,
					e,
				)
			}
		}

		this.destroyRegistry.delete(moduleClass)

		// Clear container and registration state
		const moduleContainer = this.moduleContainers.get(moduleClass)
		moduleContainer?.clear()
		this.moduleContainers.delete(moduleClass)
		this.registeredModules.delete(moduleClass)
	}

	/**
	 * Teardown all registered modules in reverse registration order.
	 */
	async destroyAllModules(): Promise<void> {
		const modules = this.getRegisteredModules().slice().reverse()
		for (const mod of modules) {
			await this.destroyModule(mod)
		}
	}

	/**
	 * Apply module-level middleware to all routes.
	 */
	private applyModuleMiddleware(meta: ModuleMeta): void {
		if (!meta.middleware?.length) return

		for (const middleware of meta.middleware) {
			this.app.use("*", middleware)
		}
	}

	/**
	 * Resolve a provider directly from the root container (testing utility).
	 */
	resolveProvider<T>(token: ProviderToken<T>): T {
		return this.rootContainer.resolve(token as any)
	}

	/**
	 * Get all registered modules.
	 */
	getRegisteredModules(): ModuleClass[] {
		return Array.from(this.registeredModules)
	}

	/**
	 * Check if a module is registered.
	 */
	isModuleRegistered(moduleClass: ModuleClass): boolean {
		return this.registeredModules.has(moduleClass)
	}

	/**
	 * Clear all registered modules (useful for testing).
	 */
	clear(): void {
		this.registeredModules.clear()
		this.moduleContainers.clear()
	}
}

/**
 * Create a module registration factory for the given app.
 *
 * @param app Hono app instance
 * @param config Registration configuration
 * @returns Module registration factory
 */
export function createModuleFactory(
	app: Hono<{ Bindings: AppBindings; Variables: AppVariables }>,
	config?: ModuleRegistrationConfig,
): ModuleRegistrationFactory {
	return new ModuleRegistrationFactory(app, rootContainer, config)
}
