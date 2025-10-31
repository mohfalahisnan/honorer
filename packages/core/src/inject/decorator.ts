import "reflect-metadata"
import { rootContainer } from "../di/container"
import type { ProviderToken } from "../module/types"

// Legacy container for backward compatibility
const legacyContainer = new Map<any, any>()

/**
 * Marks a class as injectable for dependency injection.
 * Registers with the root container and legacy container for backward compatibility.
 */
export function Injectable(target?: any): any {
	if (target) {
		Reflect.defineMetadata("di:injectable", true, target)
		rootContainer.register(target)
		return target
	}

	return (target: any) => {
		Reflect.defineMetadata("di:injectable", true, target)
		rootContainer.register(target)
		return target
	}
}

/**
 * Parameter decorator to inject a dependency by constructor token.
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
 */
export function InjectProperty(token: ProviderToken): PropertyDecorator {
	return (target, propertyKey) => {
		const existing = Reflect.getMetadata("di:props", target.constructor) || []
		Reflect.defineMetadata("di:props", [...existing, { key: propertyKey, token }], target.constructor)
	}
}

/**
 * Resolve an instance with circular dependency protection.
 */
export function resolve<T>(target: new (...args: any[]) => T, resolutionStack = new Set<any>()): T {
	// Legacy container check
	if (legacyContainer.has(target)) return legacyContainer.get(target)

	if (resolutionStack.has(target)) {
		throw new Error(`Circular dependency detected: ${target.name || target.toString()}`)
	}
	resolutionStack.add(target)

	// Try both class constructor and prototype for design:paramtypes
	const paramTypes: any[] =
		Reflect.getMetadata("design:paramtypes", target) ??
		Reflect.getMetadata("design:paramtypes", (target as any).prototype) ??
		[]
	const injectParams: { index: number; token: any }[] = Reflect.getMetadata("inject:params", target) || []

	// Infer constructor parameter count when design:paramtypes is missing (common with esbuild/tsx)
	const inferredParamCount = (() => {
		if (paramTypes.length > 0) return paramTypes.length
		if (injectParams.length === 0) return 0
		return injectParams.reduce((max, inj) => Math.max(max, inj.index), -1) + 1
	})()

	const dependencies = Array.from({ length: inferredParamCount }, (_, i) => {
		// Prefer @Inject token if present, otherwise use design type
		const injectParam = injectParams.find((p) => p.index === i)
		const token = injectParam?.token ?? paramTypes[i]

		// If neither source provided a token, pass undefined
		if (!token) return undefined

		try {
			return rootContainer.resolve(token)
		} catch {
			return resolve(token as any, resolutionStack)
		}
	})

	const instance = new target(...dependencies)

	// Property injection
	const injectProps: { key: string | symbol; token: any }[] = Reflect.getMetadata("di:props", target) || []
	for (const { key, token } of injectProps) {
		try {
			;(instance as any)[key] = rootContainer.resolve(token)
		} catch {
			;(instance as any)[key] = resolve(token, resolutionStack)
		}
	}

	resolutionStack.delete(target)
	return instance
}

/**
 * Override the instance bound to a token in the container.
 */
export function override<T>(token: new (...args: any[]) => T, mock: T): void {
	legacyContainer.set(token, mock)
	rootContainer.override(token, mock)
}

/**
 * Reset the DI container.
 */
export function resetContainer(): void {
	legacyContainer.clear()
	rootContainer.clear()
}

// Alias for backward compatibility
export const diResolve = resolve
