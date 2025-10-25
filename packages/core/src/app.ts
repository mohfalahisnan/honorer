import { Hono } from "hono"
import "reflect-metadata"
import onErrorHandler from "./handler/onError"
import { registerControllers } from "./utils/registerController"

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
	}
	controllers?: ControllerClass[]
}

export function createApp({ options = { formatResponse: true }, controllers = [] }: CreateAppConfig = {}) {
	const app = new Hono()

	app.onError(onErrorHandler)

	app.get("/", (c) => {
		return c.text("Hello From Honorer!")
	})

	if (controllers.length) {
		// Use the full config so registerControllers can read options.formatResponse
		registerControllers(app, { options, controllers })
	}

	return app
}
