import type { ZodTypeAny } from "zod"

/**
 * Binding describing the method parameter index and its Zod schema for query parsing.
 */
export type QuerySchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}
