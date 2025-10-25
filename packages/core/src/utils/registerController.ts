import type { Context, Hono } from "hono"
import type { CreateAppConfig, RouteRecord } from "../app"
import type { AppBindings, AppVariables } from "../app/factory"
import { getBodySchemaBindings, getParamSchemaBindings, getQuerySchemaBindings } from "../decorators"
import { resolve } from "../decorators/inject"
import { getControllerMiddleware, getRouteMiddleware } from "../decorators/middleware"
import { Container, rootContainer } from "../di/container"
import type { BodySchemaBinding, ParamSchemaBinding, QuerySchemaBinding } from "../types"

import { createBodyValidator, createParamValidator, createQueryValidator } from "../validators/factory"
import { ApiResponse, formatReturn } from "./response"

// Legacy bindings for simple param/query injection via metadata
type LegacyBindingSource = "param" | "query"
type LegacyBinding = { index: number; source: LegacyBindingSource; name: string }

function normalizeRoutePath(prefix: string, path: string): string {
	const combined = `${prefix}${path}`.replace(/\/{2,}/g, "/")
	if (combined.length > 1 && combined.endsWith("/")) return combined.slice(0, -1)
	return combined
}

export function registerControllers(
	app: Hono<{ Bindings: AppBindings; Variables: AppVariables }>,
	{ options = {}, controllers = [], providers = [] }: CreateAppConfig,
): void {
	const { formatResponse = true } = options

	// Create a temporary container for legacy DI support
	const legacyContainer = new Container()

	// Register providers in the legacy container
	for (const provider of providers || []) {
		legacyContainer.register(provider, provider)
		// Also register in the root container for legacy resolve function
		rootContainer.register(provider, provider)
	}

	// Register controllers in the legacy container
	for (const Controller of controllers) {
		legacyContainer.register(Controller, Controller)
		// Also register in the root container for legacy resolve function
		rootContainer.register(Controller, Controller)
	}

	for (const Controller of controllers) {
		const prefix: string = Reflect.getMetadata("prefix", Controller) || ""
		const routes: RouteRecord[] = Reflect.getMetadata("routes", Controller) || []

		// Use the legacy container to resolve controllers with dependencies
		let instance: any
		try {
			instance = legacyContainer.resolve(Controller)
		} catch (error) {
			// Fallback to the old resolve method if container fails
			instance = resolve(Controller)
		}

		for (const r of routes) {
			const fullPath = normalizeRoutePath(prefix, r.path)
			const propertyKey = r.propertyKey
			const methodFn: ((...args: unknown[]) => unknown) | undefined = propertyKey
				? ((instance as Record<string | symbol, unknown>)[propertyKey] as (...args: unknown[]) => unknown)
				: r.handler
			const boundHandler: (...args: unknown[]) => unknown | Promise<unknown> = methodFn!.bind(instance)
			const bindings: LegacyBinding[] = propertyKey
				? Reflect.getMetadata("route:params", Controller.prototype, propertyKey) || []
				: []

			const paramSchemaBindings: ParamSchemaBinding<any>[] = propertyKey
				? getParamSchemaBindings(Controller.prototype, propertyKey)
				: []

			const querySchemaBindings: QuerySchemaBinding<any>[] = propertyKey
				? getQuerySchemaBindings(Controller.prototype, propertyKey)
				: []

			const bodySchemaBindings: BodySchemaBinding<any>[] = propertyKey
				? getBodySchemaBindings(Controller.prototype, propertyKey)
				: []


			if (
				bindings.length > 0 ||
				paramSchemaBindings.length > 0 ||
				querySchemaBindings.length > 0 ||
				bodySchemaBindings.length > 0
			) {
				;(app as any)[r.method](fullPath, async (c: Context) => {
					const maxIndex = Math.max(
						...bindings.map((b) => b.index),
						...paramSchemaBindings.map((s) => s.index),
						...querySchemaBindings.map((s) => s.index),
						...bodySchemaBindings.map((s) => s.index),
						-1,
					)

					let bodyRaw: unknown | undefined
					const args: unknown[] = []
					for (let i = 0; i <= maxIndex; i++) {
						const pSchema = paramSchemaBindings.find((s) => s.index === i)
						if (pSchema) {
							const rawParams = { ...c.req.param() }
							const parsedParams = pSchema.schema.parse(rawParams)
							c.set?.("params", parsedParams)
							args.push(parsedParams)
							continue
						}

						const qSchema = querySchemaBindings.find((s) => s.index === i)
						if (qSchema) {
							const rawQuery = { ...c.req.query() }
							const parsedQuery = qSchema.schema.parse(rawQuery)
							c.set?.("query", parsedQuery)
							args.push(parsedQuery)
							continue
						}

						const bSchema = bodySchemaBindings.find((s) => s.index === i)
						if (bSchema) {
							if (bodyRaw === undefined) bodyRaw = await c.req.json()
							const parsedBody = bSchema.schema.parse(bodyRaw)
							c.set?.("body", parsedBody)
							args.push(parsedBody)
							continue
						}

						const b = bindings.find((x) => x.index === i)
						if (b) {
							if (b.source === "param") {
								if (b.name === "all") {
									// Legacy @Params() without schema - inject all params as object
									args.push({ ...c.req.param() })
								} else {
									args.push(c.req.param(b.name))
								}
							} else if (b.source === "query") {
								if (b.name === "all") {
									// Legacy @Query() without schema - inject all query params as object
									args.push({ ...c.req.query() })
								} else {
									args.push(c.req.query(b.name))
								}
							} else if (b.name === "body") {
								// Legacy @Body() without schema - inject raw body
								args.push(await c.req.json())
							} else {
								args.push(undefined)
							}
							continue
						}

						args.push(undefined)
					}

					const result = await boundHandler(...args, c)
					if (formatResponse) {
						return await formatReturn(c, result)
					}
					if (result instanceof Response) return result
					if (result instanceof ApiResponse) return result.toResponse(c)
					return c.json(result ?? null)
				})
			} else {
				;(app as any)[r.method](fullPath, async (c: Context) => {
					const result = await boundHandler(c)
					if (formatResponse) {
						return await formatReturn(c, result)
					}
					if (result instanceof Response) return result
					if (result instanceof ApiResponse) return result.toResponse(c)
					return c.json(result ?? null)
				})
			}
		}
	}

}

/**
 * Enhanced controller registration with module-aware type generation.
 * This function supports the new module system and generates comprehensive types.
 */
export async function registerControllersWithModules(
	app: Hono<{ Bindings: AppBindings; Variables: AppVariables }>,
	controllers: any[],
	options: {
		formatResponse?: boolean
		container?: Container // Module container for DI
	} = {},
): Promise<void> {
	const { formatResponse = true, container } = options


	for (const Controller of controllers) {
		const prefix: string = Reflect.getMetadata("prefix", Controller) || ""
		const routes: RouteRecord[] = Reflect.getMetadata("routes", Controller) || []
		// Use module container if provided, otherwise fall back to global resolve
		let instance: any
		try {
			instance = container ? container.resolve(Controller) : resolve(Controller)
			console.log(`Successfully resolved controller: ${Controller.name}`)
		} catch (error) {
			console.error(`Failed to resolve controller ${Controller.name}:`, error)
			throw error
		}

		for (const r of routes) {
			const fullPath = normalizeRoutePath(prefix, r.path)
			const propertyKey = r.propertyKey
			const methodFn: ((...args: unknown[]) => unknown) | undefined = propertyKey
				? ((instance as Record<string | symbol, unknown>)[propertyKey] as (...args: unknown[]) => unknown)
				: r.handler
			const boundHandler: (...args: unknown[]) => unknown | Promise<unknown> = methodFn!.bind(instance)
			const bindings: LegacyBinding[] = propertyKey
				? Reflect.getMetadata("route:params", Controller.prototype, propertyKey) || []
				: []

			const paramSchemaBindings: ParamSchemaBinding<any>[] = propertyKey
				? getParamSchemaBindings(Controller.prototype, propertyKey)
				: []

			const querySchemaBindings: QuerySchemaBinding<any>[] = propertyKey
				? getQuerySchemaBindings(Controller.prototype, propertyKey)
				: []

			const bodySchemaBindings: BodySchemaBinding<any>[] = propertyKey
				? getBodySchemaBindings(Controller.prototype, propertyKey)
				: []

			// Helper to pick first schema for validator middleware
			const pickFirstSchema = <T extends { index: number; schema: any }>(arr: T[]) =>
				arr.length ? arr.slice().sort((a, b) => a.index - b.index)[0].schema : undefined

			// Get middleware for proper composition order
			const controllerMiddleware = getControllerMiddleware(Controller)
			const routeMiddleware = propertyKey ? getRouteMiddleware(Controller.prototype, propertyKey) : []

			// Middleware composition order: Controller -> Route -> Validators -> Handler
			const allMiddleware = [...controllerMiddleware, ...routeMiddleware]

			// Register the route with Hono with proper middleware composition
			if (
				bindings.length > 0 ||
				paramSchemaBindings.length > 0 ||
				querySchemaBindings.length > 0 ||
				bodySchemaBindings.length > 0
			) {
				// Create validator middleware from schemas
				const validatorMiddleware: any[] = []

				if (paramSchemaBindings.length > 0) {
					const paramSchema = pickFirstSchema(paramSchemaBindings)
					if (paramSchema) {
						validatorMiddleware.push(createParamValidator(paramSchema))
					}
				}

				if (querySchemaBindings.length > 0) {
					const querySchema = pickFirstSchema(querySchemaBindings)
					if (querySchema) {
						validatorMiddleware.push(createQueryValidator(querySchema))
					}
				}

				if (bodySchemaBindings.length > 0) {
					const bodySchema = pickFirstSchema(bodySchemaBindings)
					if (bodySchema) {
						validatorMiddleware.push(createBodyValidator(bodySchema))
					}
				}
				// Register route with complete middleware chain
				;(app as any)[r.method](fullPath, ...allMiddleware, ...validatorMiddleware, async (c: Context) => {
					const maxIndex = Math.max(
						...bindings.map((b) => b.index),
						...paramSchemaBindings.map((s) => s.index),
						...querySchemaBindings.map((s) => s.index),
						...bodySchemaBindings.map((s) => s.index),
						-1,
					)

					let bodyRaw: unknown | undefined
					const args: unknown[] = []
					for (let i = 0; i <= maxIndex; i++) {
						const pSchema = paramSchemaBindings.find((s) => s.index === i)
						if (pSchema) {
							// Use validated params from middleware if available
							const validatedParams = c.get("validatedParams")
							if (validatedParams) {
								args.push(validatedParams)
							} else {
								const rawParams = { ...c.req.param() }
								const parsedParams = pSchema.schema.parse(rawParams)
								c.set?.("params", parsedParams)
								args.push(parsedParams)
							}
							continue
						}

						const qSchema = querySchemaBindings.find((s) => s.index === i)
						if (qSchema) {
							// Use validated query from middleware if available
							const validatedQuery = c.get("validatedQuery")
							if (validatedQuery) {
								args.push(validatedQuery)
							} else {
								const rawQuery = { ...c.req.query() }
								const parsedQuery = qSchema.schema.parse(rawQuery)
								c.set?.("query", parsedQuery)
								args.push(parsedQuery)
							}
							continue
						}

						const bSchema = bodySchemaBindings.find((s) => s.index === i)
						if (bSchema) {
							// Use validated body from middleware if available
							const validatedBody = c.get("validatedBody")
							if (validatedBody) {
								args.push(validatedBody)
							} else {
								if (bodyRaw === undefined) bodyRaw = await c.req.json()
								const parsedBody = bSchema.schema.parse(bodyRaw)
								c.set?.("body", parsedBody)
								args.push(parsedBody)
							}
							continue
						}

						const b = bindings.find((x) => x.index === i)
						if (b) {
							if (b.source === "param") {
								if (b.name === "all") {
									// Legacy @Params() without schema - inject all params as object
									args.push({ ...c.req.param() })
								} else {
									args.push(c.req.param(b.name))
								}
							} else if (b.source === "query") {
								if (b.name === "all") {
									// Legacy @Query() without schema - inject all query params as object
									args.push({ ...c.req.query() })
								} else {
									args.push(c.req.query(b.name))
								}
							} else if (b.name === "body") {
								// Legacy @Body() without schema - inject raw body
								args.push(await c.req.json())
							} else {
								args.push(undefined)
							}
							continue
						}

						args.push(undefined)
					}

					const result = await boundHandler(...args, c)
					if (formatResponse) {
						return await formatReturn(c, result)
					}
					if (result instanceof Response) return result
					if (result instanceof ApiResponse) return result.toResponse(c)
					return c.json(result ?? null)
				})
			} else {
				// Register route with middleware but no validators
				;(app as any)[r.method](fullPath, ...allMiddleware, async (c: Context) => {
					const result = await boundHandler(c)
					if (formatResponse) {
						return await formatReturn(c, result)
					}
					if (result instanceof Response) return result
					if (result instanceof ApiResponse) return result.toResponse(c)
					return c.json(result ?? null)
				})
			}
		}
	}

}
