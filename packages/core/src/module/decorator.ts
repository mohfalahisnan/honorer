import "reflect-metadata"
import type { ModuleMeta } from "./types"

/**
 * Class decorator that marks a class as a module and defines its metadata.
 * Modules provide a way to organize controllers, providers, and middleware
 * in a hierarchical structure similar to NestJS modules.
 *
 * @param meta Module metadata including controllers, providers, middleware, etc.
 *
 * @example
 * ```ts
 * @Module({
 *   controllers: [UserController],
 *   providers: [UserService],
 *   middlewares: [authMiddleware],
 *   prefix: '/api/v1'
 * })
 * class UserModule {}
 * ```
 */
export function Module(meta: ModuleMeta): ClassDecorator {
	return (target) => {
		Reflect.defineMetadata("module:meta", meta, target)
	}
}

/**
 * Retrieve module metadata from a module class.
 *
 * @param moduleClass The module class to get metadata from
 * @returns Module metadata or undefined if not a module
 */
export function getModuleMeta(moduleClass: any): ModuleMeta | undefined {
	return Reflect.getMetadata("module:meta", moduleClass)
}
