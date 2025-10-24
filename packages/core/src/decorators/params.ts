import 'reflect-metadata'
import type { Context } from 'hono'
import type { ZodTypeAny, z } from 'zod'

const META_PARAM_SCHEMA = 'route:paramSchema'
const CTX_PARAM_KEY = 'params'

/**
 * Context type helper exposing parsed `params` via Hono context variables.
 */
export type ParamsContext<T extends ZodTypeAny> = Context<{
	Variables: { [CTX_PARAM_KEY]: z.infer<T> }
}>

/**
 * Parameter decorator that attaches a Zod schema to a method parameter.
 * The core router will:
 * 1. Merge route parameters (`c.req.param()`) and query parameters (`c.req.query()`)
 * 2. Validate the merged object against the provided Zod schema
 * 3. Cache the parsed result in `c.get('params')` for the lifetime of the request
 * 4. Inject the validated object into the decorated parameter
 *
 * The decorator can be used multiple times on the same method; each schema is
 * stored separately and later processed in declaration order.
 *
 * @param schema Zod schema describing the expected shape of route + query parameters.
 *               Must extend {@link ZodTypeAny}.
 * @returns A parameter decorator function that registers the schema for runtime validation.
 *
 * @example
 * ```ts
 * class OrdersController {
 *   async addItem(@Params(ZodSchema) order: z.infer<typeof ZodSchema>){
 * 		// `order` is validated and typed
 * 		return c.json({ order });
 * 	}
 * }
 * ```
 *
 * @see {@link paramsOf}  Utility to manually retrieve parsed parameters inside a handler.
 * @see {@link bindRoute}  Helper that wraps a handler with automatic validation.
 */
export function Params<T extends ZodTypeAny>(schema: T): ParameterDecorator {
	return (target, propertyKey, parameterIndex) => {
		const list: ParamSchemaBinding<ZodTypeAny>[] =
			Reflect.getMetadata(META_PARAM_SCHEMA, target, propertyKey!) || []
		list.push({ index: parameterIndex!, schema })
		Reflect.defineMetadata(META_PARAM_SCHEMA, list, target, propertyKey!)
	}
}

/**
 * Binding describing the parameter index and its associated Zod schema.
 */
export type ParamSchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}

/**
 * Retrieve all parameter schema bindings for a method.
 *
 * @param target The controller prototype.
 * @param key The method name/symbol.
 */
export function getParamSchemaBindings(target: object, key: string | symbol): ParamSchemaBinding<ZodTypeAny>[] {
	return (Reflect.getMetadata(META_PARAM_SCHEMA, target, key) || []) as ParamSchemaBinding<ZodTypeAny>[]
}

/**
 * Helper to obtain parsed params within a handler using a schema.
 * Combines route `params` and `query` before validation and caches the result.
 *
 * @param c Hono context.
 * @param schema Zod schema for params.
 * @returns Parsed params according to `schema`.
 */
export function paramsOf<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
	const existing = (c as any).get?.(CTX_PARAM_KEY)
	if (existing) return existing as z.infer<T>
	const raw = { ...c.req.param(), ...c.req.query() }
	const parsed = schema.parse(raw)
	;(c as any).set?.(CTX_PARAM_KEY, parsed)
	return parsed
}

/**
 * Runtime wrapper that validates `params`/`query` before invoking the handler.
 * Populates `c.get('params')` with the parsed values for downstream use.
 */
export function bindRoute<T extends ZodTypeAny>(
	handler: (c: ParamsContext<T>) => unknown | Promise<unknown>,
	schema: T,
) {
	return async (c: Context) => {
		const raw = { ...c.req.param(), ...c.req.query() }
		const parsed = schema.parse(raw)
		c.set(CTX_PARAM_KEY, parsed)
		return handler(c as ParamsContext<T>)
	}
}

/**
 * Retrieve the first parameter schema attached to a method, if any.
 */
export function getParamSchema(target: object, key: string | symbol) {
	return Reflect.getMetadata(META_PARAM_SCHEMA, target, key) as ZodTypeAny | undefined
}
