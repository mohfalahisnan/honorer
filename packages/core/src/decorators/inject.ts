import "reflect-metadata"

const container = new Map<any, any>()

/**
 * Class decorator that marks a class as injectable and eagerly registers an instance
 * in the internal DI container. If an instance for the token does not yet exist,
 * one is created and stored.
 */
export const Injectable: ClassDecorator = (target: any) => {
	if (!container.has(target)) {
		container.set(target, new (target as any)())
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
 * Resolve an instance of the given class, recursively instantiating and injecting
 * its constructor dependencies based on recorded `Inject` metadata or design-time
 * types from `reflect-metadata`.
 *
 * - Uses `design:paramtypes` to determine constructor parameter types.
 * - If a parameter has an explicit `Inject` token, it is used preferentially.
 * - Dependencies are singleton-scoped within the internal container map.
 *
 * @param target Class constructor to instantiate.
 * @returns Resolved instance with injected dependencies.
 */
export function resolve<T>(target: new (...args: any[]) => T): T {
	const injections = Reflect.getMetadata("inject:params", target) || []
	const paramTypes = Reflect.getMetadata("design:paramtypes", target) || []
	const params: any[] = paramTypes.map((p: any, i: number) => {
		const token = injections.find((x: any) => x.index === i)?.token ?? p
		if (!container.has(token)) container.set(token, resolve(token))
		return container.get(token)
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
	container.set(token, mock)
}

/**
 * Reset the DI container, clearing all registered instances.
 * Use with caution; this will drop all singletons and cached providers.
 */
export function resetContainer(): void {
	container.clear()
}
