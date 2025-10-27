import { Hono } from "hono"
import { createFactory } from "hono/factory"
import onErrorHandler from "../handler/onError"
import { responseEnvelopeMiddleware } from "../middleware/responseEnvelope"
import { createModuleFactory, type ModuleRegistrationFactory } from "../module"
import type { ModuleClass } from "../module/types"
import { ApiResponse } from "../utils"

export type AppBindings = {
	DB?: unknown
	[key: string]: unknown
}

export type AppVariables = {
	params?: unknown
	query?: unknown
	body?: unknown
	validatedParams?: unknown
	validatedQuery?: unknown
	validatedBody?: unknown
	[key: string]: unknown
}

export function honorerFactory<
	T extends { Bindings?: any; Variables?: any } = { Bindings: AppBindings; Variables: AppVariables },
>() {
	return createFactory<T>()
}

export type HonorerApp = Hono<{
	Bindings: AppBindings
	Variables: AppVariables
}> & {
	// Enhanced methods for module support
	registerModule: (moduleClass: ModuleClass) => Promise<void>
	registerModules: (modules: ModuleClass[]) => Promise<void>
	getModuleFactory: () => ModuleRegistrationFactory
}

export interface CreateHonorerAppConfig {
	formatResponse?: boolean
	debug?: boolean
	errorHandler?: (err: any, c: any) => Response | Promise<Response>
}

export function createHonorerApp(config: CreateHonorerAppConfig = {}): HonorerApp {
	const fmt =
		(config as any).enableResponseEnvelope !== undefined
			? Boolean((config as any).enableResponseEnvelope)
			: ((config as any).formatResponse ?? true)

	const dbg = (config as any).debug === true ? true : false
	const errorHandler = (config as any)?.errorHandler
	const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

	// Set up error handling
	if (errorHandler) {
		app.onError((err, c) => {
			c.set?.("honorer:customError", true)
			return errorHandler(err, c)
		})
	} else {
		app.onError(onErrorHandler)
	}

	// Add response envelope middleware if enabled
	if (fmt) {
		app.use("*", async (c, next) => {
			c.set?.("honorer:envelope", true)
			await next()
		})
		app.use("*", responseEnvelopeMiddleware())

		// Format 404 responses as envelope when enabled
		app.notFound((c) => {
			return ApiResponse.error("Not Found", {
				status: 404,
				code: "NOT_FOUND",
			}).toResponse(c)
		})
	} else {
		// No envelope formatting when disabled
		app.notFound((c) => c.text("404 Not Found", 404))
	}

	// Create module factory for this app instance
	const moduleFactory = createModuleFactory(app, {
		debug: dbg,
	})

	// Enhance the app with module registration methods
	const enhancedApp = app as HonorerApp

	enhancedApp.registerModule = async (moduleClass: ModuleClass) => {
		return moduleFactory.registerModule(moduleClass)
	}

	enhancedApp.registerModules = async (modules: ModuleClass[]) => {
		return moduleFactory.registerModules(modules)
	}

	enhancedApp.getModuleFactory = () => moduleFactory

	return enhancedApp
}
