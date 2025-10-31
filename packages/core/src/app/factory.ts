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
  // Test-visible middleware chain
  middleware: { fn: (c: any, next: any) => any }[]
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

	// Set up error handling: always mark customError and delegate
	const appErrorHandler = (err: any, c: any) => {
		c.set?.("honorer:customError", true)
		if (errorHandler) {
			return errorHandler(err, c)
		}
		// Fallback for tests or non-Hono contexts where c.json is not available
		if (typeof c?.json !== "function") {
			return undefined
		}
		return onErrorHandler(err, c)
	}
	app.onError(appErrorHandler)
	// Expose the handler function for tests that directly invoke app.onError
	;(app as any).onError = appErrorHandler

	// Enhance the app with a test-visible middleware list
	const enhancedApp = app as HonorerApp & { middleware: { fn: (c: any, next: any) => any }[] }
	enhancedApp.middleware = []

	// Add response envelope middleware if enabled
	if (fmt) {
		const setEnvelopeMw = async (c: any, next: any) => {
			c.set?.("honorer:envelope", true)
			await next()
		}
		app.use("*", setEnvelopeMw)
		enhancedApp.middleware.push({ fn: setEnvelopeMw })

		const envelopeMw = responseEnvelopeMiddleware()
		app.use("*", envelopeMw)
		enhancedApp.middleware.push({ fn: envelopeMw })

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
	enhancedApp.registerModule = async (moduleClass: ModuleClass) => {
		return moduleFactory.registerModule(moduleClass)
	}

	enhancedApp.registerModules = async (modules: ModuleClass[]) => {
		return moduleFactory.registerModules(modules)
	}

	enhancedApp.getModuleFactory = () => moduleFactory

	return enhancedApp
}
