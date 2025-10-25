import "reflect-metadata"
import { createHonorerApp, type HonorerApp } from "./app/factory"
import type { ModuleClass } from "./module/types"
import { registerControllers } from "./utils"

export type ControllerClass<T = any> = new (...args: any[]) => T

export type RouteRecord = {
	method: string
	path: string
	handler?: (...args: unknown[]) => unknown
	propertyKey?: string | symbol
}

export type CreateAppConfig = {
	options?: {
		formatResponse?: boolean
		debug?: boolean
	}
	controllers?: ControllerClass[]
	providers?: ControllerClass[]
	modules?: ModuleClass[]
}

// Maintain existing API for backward compatibility
export function createApp({
	options = { formatResponse: true, debug: false },
	controllers = [],
	providers = [],
	modules = [],
}: CreateAppConfig = {}): HonorerApp {
	const app = createHonorerApp(options)

	// Register legacy controllers if provided
	if (controllers.length) {
		registerControllers(app, { options, controllers, providers })
	}

	// Register modules if provided (new module system)
	if (modules.length) {
		// Register modules asynchronously but return app immediately for backward compatibility
		app.registerModules(modules).catch((error) => {
			console.error("Failed to register modules:", error)
		})
	}

	return app
}

// New module-first API for enhanced functionality
export async function createModularApp({
	options = { formatResponse: true, debug: false },
	modules = [],
	controllers = [], // Legacy support
	providers = [], // Legacy support
}: CreateAppConfig = {}): Promise<HonorerApp> {
	const app = createHonorerApp(options)

	// Register modules first (new preferred approach)
	if (modules.length) {
		await app.registerModules(modules)
	}

	// Register legacy controllers if provided (for migration scenarios)
	if (controllers.length) {
		registerControllers(app, { options, controllers, providers })
	}

	return app
}
