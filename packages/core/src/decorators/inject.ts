import "reflect-metadata"
import { rootContainer } from '../di/container'
import type { ProviderToken } from '../module/types'

// Legacy container for backward compatibility
const legacyContainer = new Map<any, any>()

/**
 * Marks a class as injectable for dependency injection.
 * In the new system, this registers the class with the root container.
 * For backward compatibility, it also registers with the legacy container.
 * Can be used as @Injectable or @Injectable()
 */
export function Injectable(target?: any): any {
	// If called with target directly (@Injectable)
	if (target) {
		Reflect.defineMetadata('di:injectable', true, target)
		
		// Register with new hierarchical container
		rootContainer.register(target)
		
		return target
	}
	
	// If called as factory (@Injectable())
	return (target: any) => {
		Reflect.defineMetadata('di:injectable', true, target)
		
		// Register with new hierarchical container
		rootContainer.register(target)
		
		return target
	}
}

/**
 * Parameter decorator to inject a dependency by constructor token.
 * The token can be a class constructor or provider key. When applied to a class
 * constructor parameter, the token is recorded in metadata and used by `resolve`
 * to instantiate the class with dependencies.
 *
 * @param token Constructor token to resolve from the container.
 */
export const Inject = <T>(token: new (...args: any[]) => T): ParameterDecorator => {
	return (target: Object, _key: string | symbol | undefined, index: number) => {
		const existing = Reflect.getMetadata("inject:params", target) || []
		existing.push({ index, token })
		Reflect.defineMetadata("inject:params", existing, target)
	}
}

/**
 * Property decorator to inject a dependency into a class property.
 * This is the new preferred way for property injection in the module system.
 * 
 * @param token Provider token to inject
 */
export function InjectProperty(token: ProviderToken): PropertyDecorator {
	return (target, propertyKey) => {
		const existing = Reflect.getMetadata('di:props', target.constructor) || []
		Reflect.defineMetadata('di:props', [...existing, { key: propertyKey, token }], target.constructor)
	}
}

/**
 * Resolve an instance of the given class, recursively instantiating and injecting
 * its constructor dependencies based on recorded `Inject` metadata or design-time
 * types from `reflect-metadata`.
 *
 * This function maintains backward compatibility with the legacy container
 * while also supporting the new hierarchical container system.
 *
 * @param target Class constructor to instantiate.
 * @returns Resolved instance with injected dependencies.
 */
export function resolve<T>(target: new (...args: any[]) => T): T {
	// Try new container first
	if (rootContainer.has(target)) {
		return rootContainer.resolve(target)
	}
	
	// Fall back to legacy behavior for backward compatibility
	const injections = Reflect.getMetadata("inject:params", target) || []
	const paramTypes = Reflect.getMetadata("design:paramtypes", target) || []
	const params: any[] = paramTypes.map((p: any, i: number) => {
		const token = injections.find((x: any) => x.index === i)?.token ?? p
		if (!legacyContainer.has(token)) legacyContainer.set(token, resolve(token))
		return legacyContainer.get(token)
	})
	return new target(...params)
}

/**
 * Override the instance bound to a token in the container.
 * Useful for testing with mocks or for providing custom implementations.
 *
 * @param token Constructor token to override.
 * @param mock Instance to associate with the token.
 */
export function override<T>(token: new (...args: any[]) => T, mock: T): void {
	legacyContainer.set(token, mock)
	rootContainer.override(token, mock)
}

/**
 * Reset the DI container, clearing all registered instances.
 * Use with caution; this will drop all singletons and cached providers.
 */
export function resetContainer(): void {
	legacyContainer.clear()
	rootContainer.clear()
}

// Alias for backward compatibility
export const diResolve = resolve
