import type { MiddlewareHandler } from "hono"

/**
 * Token for dependency injection providers.
 * Can be a class constructor, string, or symbol.
 * Generic parameter narrows constructor instance type when available.
 */
export type ProviderToken<T = any> = string | symbol | (new (...args: any[]) => T)

/**
 * Middleware function type for Hono.
 */
export type MiddlewareFn = MiddlewareHandler

/**
 * Class provider definition.
 */
export interface ClassProvider {
    provide: ProviderToken
    useClass: new (...args: any[]) => any
    inject?: ProviderToken[]
}

/**
 * Value provider definition.
 */
export interface ValueProvider {
    provide: ProviderToken
    useValue: any
}

/**
 * Factory provider definition.
 */
export interface FactoryProvider {
    provide: ProviderToken
    useFactory: (...args: any[]) => any
    inject?: ProviderToken[]
}

/**
 * Provider definition types.
 */
export type Provider =
	| (new (
			...args: any[]
	  ) => any) // Class constructor
	| ClassProvider
	| ValueProvider
	| FactoryProvider

/**
 * Module metadata configuration.
 */
export interface ModuleMeta {
	/** Controllers to register in this module */
	controllers?: (new (
		...args: any[]
	) => any)[]
	/** Providers for dependency injection */
	providers?: Provider[]
    /** Imported modules */
    imports?: Array<ModuleClass | (() => Promise<any>) | Promise<any>>
    /** Exported providers (available to importing modules) */
    exports?: ProviderToken[]
	/** Module-level middleware */
	middleware?: MiddlewareFn[]
	/** Module route prefix (namespace), e.g. '/auth' or '/users' */
	prefix?: string
}

/**
 * Module class type.
 */
export type ModuleClass = new (...args: any[]) => any
