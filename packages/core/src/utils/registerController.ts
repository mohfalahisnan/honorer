import type { Context, Hono } from "hono"
import type { CreateAppConfig, RouteRecord } from "../app"
import { getBodySchemaBindings, getParamSchemaBindings, getQuerySchemaBindings } from "../decorators"
import { resolve } from "../decorators/inject"
import { ApiResponse, formatReturn } from "./response"
import type { BodySchemaBinding, ParamSchemaBinding, QuerySchemaBinding } from "../types"

// Legacy bindings for simple param/query injection via metadata
type LegacyBindingSource = "param" | "query"
type LegacyBinding = { index: number; source: LegacyBindingSource; name: string }

function normalizeRoutePath(prefix: string, path: string): string {
	const combined = `${prefix}${path}`.replace(/\/{2,}/g, "/")
	if (combined.length > 1 && combined.endsWith("/")) return combined.slice(0, -1)
	return combined
}

export function registerControllers(
	app: Hono,
	{ options = { formatResponse: true }, controllers = [] }: CreateAppConfig,
): void {
	const { formatResponse } = options
	for (const Controller of controllers) {
		const prefix: string = Reflect.getMetadata("prefix", Controller) || ""
		const routes: RouteRecord[] = Reflect.getMetadata("routes", Controller) || []
		const instance = resolve(Controller)

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
							if (b.source === "param") args.push(c.req.param(b.name))
							else if (b.source === "query") args.push(c.req.query(b.name))
							else args.push(undefined)
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
