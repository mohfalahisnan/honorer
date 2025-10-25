import "reflect-metadata"
import type { Context } from "hono"
import type { ZodTypeAny, z } from "zod"

const META_QUERY_PARAM_SCHEMA = "route:queryParamSchema"
const CTX_QUERY_KEY = "query"

/**
 * Binding describing the method parameter index and its Zod schema for query parsing.
 */
export type QuerySchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}

/**
 * Parameter decorator that attaches a Zod schema for query-string parsing.
 * The core router will:
 * 1. Validate `c.req.query()` against the provided schema.
 * 2. Cache the parsed result under `c.get('query')`.
 * 3. Inject the validated object into the decorated parameter.
 *
 * @param schema - Zod schema describing the expected query parameters.
 * @returns ParameterDecorator
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import type { Context } from 'hono'
 *
 * const GetUsersQuery = z.object({
 *   page: z.coerce.number().int().min(1).default(1),
 *   limit: z.coerce.number().int().min(1).max(100).default(10),
 *   search: z.string().optional(),
 * })
 *
 * class UserController {
 *   async getUsers(@Query(GetUsersQuery) query: z.infer<typeof GetUsersQuery>,c: Context) {
 *     // `query` is validated and typed
 *     return c.json({ users: [], page: query.page, limit: query.limit })
 *   }
 * }
 * ```
 */
export function Query<T extends ZodTypeAny>(schema: T): ParameterDecorator {
	return (target, propertyKey, parameterIndex) => {
		const list: QuerySchemaBinding<ZodTypeAny>[] =
			Reflect.getMetadata(META_QUERY_PARAM_SCHEMA, target, propertyKey!) || []
		list.push({ index: parameterIndex!, schema })
		Reflect.defineMetadata(META_QUERY_PARAM_SCHEMA, list, target, propertyKey!)
	}
}

/**
 * Retrieve all query schema bindings for a method.
 *
 * @param target The controller prototype.
 * @param key The method name/symbol.
 */
export function getQuerySchemaBindings(target: object, key: string | symbol): QuerySchemaBinding<ZodTypeAny>[] {
	return (Reflect.getMetadata(META_QUERY_PARAM_SCHEMA, target, key) || []) as QuerySchemaBinding<ZodTypeAny>[]
}

/**
 * Helper to obtain parsed query parameters inside a handler.
 * Caches the parsed result in `c.get('query')`.
 *
 * @param c Hono context.
 * @param schema Zod schema for query parameters.
 * @returns Parsed query object.
 */
export function queryOf<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
	const existing = (c as any).get?.(CTX_QUERY_KEY)
	if (existing) return existing as z.infer<T>
	const raw = c.req.query()
	const parsed = schema.parse(raw)
	;(c as any).set?.(CTX_QUERY_KEY, parsed)
	return parsed
}
