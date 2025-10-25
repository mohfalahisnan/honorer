import type { Hono } from 'hono'
import type { AppBindings, AppVariables } from '../app/factory'
import { Container, rootContainer } from '../di/container'
import type { ModuleClass, ModuleMeta } from './types'
import { getModuleMeta } from './decorator'
import { registerControllersWithModules } from '../utils/registerController'

/**
 * Configuration for module registration
 */
export interface ModuleRegistrationConfig {
  /** Whether to enable debug logging */
  debug?: boolean
}

/**
 * Factory for registering modules with dependency injection and middleware composition.
 */
export class ModuleRegistrationFactory {
  private registeredModules = new Set<ModuleClass>()
  private moduleContainers = new Map<ModuleClass, Container>()
  private currentModuleName = ''

  constructor(
    private app: Hono<{ Bindings: AppBindings; Variables: AppVariables }>,
    private rootContainer: Container,
    private config: ModuleRegistrationConfig = {}
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

      if (this.config.debug) {
        console.log(`Successfully registered module: ${moduleClass.name}`)
      }
    } catch (error) {
      // Remove from registered set if registration fails
      this.registeredModules.delete(moduleClass)
      throw new Error(`Failed to register module ${moduleClass.name}: ${error}`)
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

    for (const importedModule of meta.imports) {
      await this.registerModule(importedModule)
    }
  }

  /**
   * Import exported providers from imported modules into the current module container.
   */
  private importExportedProviders(meta: ModuleMeta, moduleContainer: Container): void {
    if (!meta.imports?.length) return

    for (const importedModule of meta.imports) {
      const importedMeta = getModuleMeta(importedModule)
      if (!importedMeta?.exports?.length) continue

      // Get the imported module's container
      const importedContainer = this.moduleContainers.get(importedModule)
      if (!importedContainer) continue

      // Register exported providers in the current module container
      for (const exportedProvider of importedMeta.exports) {
        if (typeof exportedProvider === 'function') {
          // If the provider exists in the imported module's container, use it
          if (importedContainer.has(exportedProvider)) {
            const instance = importedContainer.resolve(exportedProvider)
            moduleContainer.register(exportedProvider, () => instance)
          }
        }
      }
    }
  }

  /**
   * Register providers in the module-scoped container and root container.
   */
  private registerProviders(meta: ModuleMeta, moduleContainer: Container): void {
    if (!meta.providers?.length) return

    for (const provider of meta.providers) {
      if (typeof provider === 'function') {
        // Class provider
        moduleContainer.register(provider, provider)
        this.rootContainer.register(provider, provider)
        if (this.config.debug) {
          console.log(`Registered provider: ${provider.name}`)
        }
      } else if (typeof provider === 'object' && 'provide' in provider) {
        // Token-based provider
        if ('useClass' in provider && provider.useClass) {
          moduleContainer.register(provider.provide, provider.useClass)
          this.rootContainer.register(provider.provide, provider.useClass)
        } else if ('useValue' in provider) {
          const valueFactory = () => provider.useValue
          moduleContainer.register(provider.provide, valueFactory)
          this.rootContainer.register(provider.provide, valueFactory)
        } else if ('useFactory' in provider && provider.useFactory) {
          const factory = provider.useFactory
          const deps = provider.inject || []
          const factoryWrapper = () => {
            const resolvedDeps = deps.map(dep => moduleContainer.resolve(dep))
            return factory(...resolvedDeps)
          }
          moduleContainer.register(provider.provide, factoryWrapper)
          this.rootContainer.register(provider.provide, factoryWrapper)
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
  private async registerControllers(moduleClass: ModuleClass, meta: ModuleMeta, moduleContainer: Container): Promise<void> {
    if (!meta.controllers?.length) return

    // Register controllers in module container first
    meta.controllers.forEach(ControllerClass => {
      if (!moduleContainer.has(ControllerClass)) {
        moduleContainer.register(ControllerClass, ControllerClass)
        if (this.config.debug) {
          console.log(`Registered controller: ${ControllerClass.name}`)
        }
      }
    })


    // Register controllers with the app using enhanced module-aware registration
    await registerControllersWithModules(
      this.app,
      meta.controllers,
      {
        formatResponse: true,
        container: moduleContainer
      }
    )

  }

  /**
   * Get the current module name being registered.
   */
  private getCurrentModuleName(): string {
    return this.currentModuleName
  }

  /**
   * Apply module-level middleware to all routes.
   */
  private applyModuleMiddleware(meta: ModuleMeta): void {
    if (!meta.middleware?.length) return

    for (const middleware of meta.middleware) {
      this.app.use('*', middleware)
    }
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
  config?: ModuleRegistrationConfig
): ModuleRegistrationFactory {
  return new ModuleRegistrationFactory(app, rootContainer, config)
}