import type { Context } from "hono"
import type { ZodTypeAny, z } from "zod"
import type { CTX_PARAM_KEY } from "./constant"

/**
 * Context type helper exposing parsed `params` via Hono context variables.
 */
export type ParamsContext<T extends ZodTypeAny> = Context<{
	Variables: { [CTX_PARAM_KEY]: z.infer<T> }
}>

/**
 * Binding describing the parameter index and its associated Zod schema.
 */
export type ParamSchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}
