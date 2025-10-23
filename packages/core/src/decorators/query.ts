import 'reflect-metadata'
import { z, type ZodTypeAny } from 'zod'
import type { Context } from 'hono'

const META_QUERY_PARAM_SCHEMA = 'route:queryParamSchema'
const CTX_QUERY_KEY = 'query'

export type QuerySchemaBinding<T extends ZodTypeAny> = { index: number; schema: T }

export function Query<T extends ZodTypeAny>(schema: T): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const list: QuerySchemaBinding<ZodTypeAny>[] =
      Reflect.getMetadata(META_QUERY_PARAM_SCHEMA, target, propertyKey!) || []
    list.push({ index: parameterIndex!, schema })
    Reflect.defineMetadata(META_QUERY_PARAM_SCHEMA, list, target, propertyKey!)
  }
}

export function getQuerySchemaBindings(
  target: object,
  key: string | symbol
): QuerySchemaBinding<ZodTypeAny>[] {
  return (Reflect.getMetadata(META_QUERY_PARAM_SCHEMA, target, key) ||
    []) as QuerySchemaBinding<ZodTypeAny>[]
}

export function queryOf<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  const existing = (c as any).get?.(CTX_QUERY_KEY)
  if (existing) return existing as z.infer<T>
  const raw = c.req.query()
  const parsed = schema.parse(raw)
  ;(c as any).set?.(CTX_QUERY_KEY, parsed)
  return parsed
}