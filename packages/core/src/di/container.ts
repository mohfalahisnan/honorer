import "reflect-metadata"

/**
 * Hierarchical dependency injection container that supports module-scoped providers.
 * Each module can have its own container that inherits from parent containers.
 */
export class Container {
	private instances = new Map<any, any>()
	private parent?: Container

	constructor(parent?: Container) {
		this.parent = parent
	}

	/**
	 * Register a provider in this container.
	 * Supports class constructors, factory functions, and direct values.
	 *
	 * @param token Provider token (usually a class constructor or string)
	 * @param provider Provider implementation (constructor, factory, or value)
	 */
	register<T>(token: any, provider?: T | (() => T) | (new (...args: any[]) => T)): void {
		if (provider === undefined) {
			// Auto-registration for classes with @Injectable
			if (typeof token === "function" && !this.instances.has(token)) {
				this.instances.set(token, { type: "class", constructor: token })
			}
		} else if (typeof provider === "function") {
			// Check if it's a factory function (no parameters) or a class constructor
			if (provider.length === 0 && provider !== token) {
				// Factory function
				this.instances.set(token, { type: "factory", factory: provider })
			} else {
				// Class constructor
				this.instances.set(token, { type: "class", constructor: provider })
			}
		} else {
			// Direct value
			this.instances.set(token, provider)
		}
	}

	/**
	 * Resolve a provider instance, creating it if necessary.
	 * Dependencies are resolved recursively using constructor injection.
	 *
	 * @param token Provider token to resolve
	 * @returns Resolved instance
	 */
	resolve<T>(token: any): T {
		return this.resolveWithStack(token, new Set())
	}

	/**
	 * Create an instance of a class with dependency injection.
	 */

	// biome-ignore lint/suspicious/noShadowRestrictedNames: exp
	private createInstance<T>(constructor: new (...args: any[]) => T, resolutionStack: Set<any> = new Set()): T {
		// Check for circular dependencies
		if (resolutionStack.has(constructor)) {
			throw new Error("Circular dependency detected")
		}

		resolutionStack.add(constructor)

		try {
			// Resolve dependencies and create instance
			const injections = Reflect.getMetadata("inject:params", constructor) || []
			const paramTypes = Reflect.getMetadata("design:paramtypes", constructor) || []

			// Fallback: if design:paramtypes is missing (common with esbuild/tsx),
			// infer constructor param count from @Inject metadata indices.
			const inferredParamCount = (() => {
				if (paramTypes.length > 0) return paramTypes.length
				if (injections.length === 0) return 0
				return injections.reduce((max: number, inj: any) => Math.max(max, inj.index), -1) + 1
			})()

			const params = Array.from({ length: inferredParamCount }, (_, index) => {
				const injection = injections.find((inj: any) => inj.index === index)
				const resolveToken = injection?.token ?? paramTypes[index]

				// If neither @Inject nor design:paramtypes provided a token, pass undefined.
				if (!resolveToken) return undefined

				// Auto-register dependencies if they have @Injectable decorator
				if (!this.has(resolveToken) && Reflect.getMetadata("di:injectable", resolveToken)) {
					this.register(resolveToken)
				}

				return this.resolveWithStack(resolveToken, resolutionStack)
			})

			const instance = new constructor(...params)

			// Inject properties if any
			const diProps = Reflect.getMetadata("di:props", constructor) || []
			for (const { key, token: propToken } of diProps) {
				// Auto-register property dependencies if they have @Injectable decorator
				if (!this.has(propToken) && Reflect.getMetadata("di:injectable", propToken)) {
					this.register(propToken)
				}
				;(instance as any)[key] = this.resolveWithStack(propToken, resolutionStack)
			}

			return instance
		} finally {
			resolutionStack.delete(constructor)
		}
	}

	/**
	 * Resolve with circular dependency tracking
	 */
	private resolveWithStack<T>(token: any, resolutionStack: Set<any>): T {
		// Check if already instantiated in this container
		const existing = this.instances.get(token)

		// If it's already an instance (not a provider object), return it
		if (existing && (typeof existing !== "object" || !existing.type)) {
			return existing
		}

		// If it's a provider object, we need to create the instance
		if (existing && typeof existing === "object" && existing.type) {
			let instance: T

			switch (existing.type) {
				case "factory":
					instance = existing.factory()
					break
				case "class":
					instance = this.createInstance(existing.constructor, resolutionStack)
					break
				default:
					throw new Error(`Unknown provider type: ${existing.type}`)
			}

			this.instances.set(token, instance)
			return instance
		}

		// Check parent containers
		if (this.parent?.has(token)) {
			return this.parent.resolve(token)
		}

		// If not registered anywhere, throw error
		throw new Error(`No provider found for token: ${token.name || token.toString()}`)
	}

	/**
	 * Create a child container that inherits from this one.
	 *
	 * @returns New child container
	 */
	child(): Container {
		return new Container(this)
	}

	/**
	 * Check if a token is available in this container or parent containers.
	 *
	 * @param token Token to check
	 * @returns True if token is available
	 */
	has(token: any): boolean {
		return this.instances.has(token) || (this.parent?.has(token) ?? false)
	}

	/**
	 * Override an existing provider with a new instance or factory.
	 * Useful for testing with mocks.
	 *
	 * @param token Provider token to override
	 * @param provider New instance or factory to use
	 */
	override<T>(token: any, provider: T | (() => T)): void {
		if (typeof provider === "function" && provider.length === 0) {
			this.instances.set(token, { type: "factory", factory: provider })
		} else {
			this.instances.set(token, provider)
		}
	}

	/**
	 * Clear all instances in this container.
	 * Does not affect parent containers.
	 */
	clear(): void {
		this.instances.clear()
	}

	/**
	 * Get all registered tokens in this container (not including parents).
	 *
	 * @returns Array of registered tokens
	 */
	getTokens(): any[] {
		return Array.from(this.instances.keys())
	}
}

// Global root container for application-level singletons
export const rootContainer = new Container()
