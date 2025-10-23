import 'reflect-metadata'

const container = new Map<any, any>()

export const Injectable: ClassDecorator = (target: any) => {
	if (!container.has(target)) {
		container.set(target, new (target as any)())
	}
}

export const Inject = <T>(token: new (...args: any[]) => T): ParameterDecorator => {
	return (target: Object, _key: string | symbol | undefined, index: number) => {
		const existing = Reflect.getMetadata('inject:params', target) || []
		existing.push({ index, token })

		Reflect.defineMetadata('inject:params', existing, target)
	}
}

export function resolve<T>(target: new (...args: any[]) => T): T {
	const injections = Reflect.getMetadata('inject:params', target) || []
	const paramTypes = Reflect.getMetadata('design:paramtypes', target) || []
	const params: any[] = paramTypes.map((p: any, i: number) => {
		const token = injections.find((x: any) => x.index === i)?.token ?? p
		if (!container.has(token)) container.set(token, resolve(token))
		return container.get(token)
	})
	return new target(...params)
}

export function override<T>(token: new (...args: any[]) => T, mock: T): void {
	container.set(token, mock)
}

export function resetContainer(): void {
	container.clear()
}
