// container.ts
export class Container {
	private instances = new Map()

	register(token: any, provider: any) {
		this.instances.set(token, new provider())
	}

	resolve<T>(token: new (...args: any[]) => T): T {
		const instance = this.instances.get(token)
		if (!instance) throw new Error(`No provider for ${token.name}`)
		return instance
	}
}
