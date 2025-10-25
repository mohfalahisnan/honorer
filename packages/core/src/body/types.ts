import type { ZodTypeAny } from "zod"

/**
 * Binding describing the method parameter index and its associated Zod schema for body parsing.
 */
export type BodySchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}
