import 'reflect-metadata'
import { z, type ZodTypeAny } from 'zod'
import type { Context } from 'hono'

const META_PARAM_SCHEMA = 'route:paramSchema'
const CTX_PARAM_KEY = 'params'

export type ParamsContext<T extends ZodTypeAny> = Context<{
	Variables: { [CTX_PARAM_KEY]: z.infer<T> }
}>

/**
 * Generic decorator that attaches schema and enables type inference for the method param.
 */
// ParameterDecorator: attach schema binding to a specific parameter index
// ParameterDecorator binding type
export type ParamSchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}

export function Params<T extends ZodTypeAny>(schema: T): ParameterDecorator {
	return (target, propertyKey, parameterIndex) => {
		const list: ParamSchemaBinding<ZodTypeAny>[] =
			Reflect.getMetadata(META_PARAM_SCHEMA, target, propertyKey!) || []
		list.push({ index: parameterIndex!, schema })
		Reflect.defineMetadata(META_PARAM_SCHEMA, list, target, propertyKey!)
	}
}

export function getParamSchemaBindings(target: object, key: string | symbol): ParamSchemaBinding<ZodTypeAny>[] {
	return (Reflect.getMetadata(META_PARAM_SCHEMA, target, key) || []) as ParamSchemaBinding<ZodTypeAny>[]
}

// Typed helper to retrieve params inside controllers without annotating method signature.
// Ensures parsed values are cached into context variables.
export function paramsOf<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
	const existing = (c as any).get?.(CTX_PARAM_KEY)
	if (existing) return existing as z.infer<T>
	const raw = { ...c.req.param(), ...c.req.query() }
	const parsed = schema.parse(raw)
	;(c as any).set?.(CTX_PARAM_KEY, parsed)
	return parsed
}

/**
 * Runtime wrapper: parses params/query, injects parsed values into context.
 * (kept for backward compatibility with method-level usage)
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

export function getParamSchema(target: object, key: string | symbol) {
	return Reflect.getMetadata(META_PARAM_SCHEMA, target, key) as ZodTypeAny | undefined
}
