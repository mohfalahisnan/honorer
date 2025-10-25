import "reflect-metadata"
import type { Context } from "hono"
import type { ZodTypeAny, z } from "zod"

const META_BODY_SCHEMA = "route:bodySchema"
const CTX_BODY_KEY = "body"

/**
 * Binding describing the method parameter index and its associated Zod schema for body parsing.
 */
export type BodySchemaBinding<T extends ZodTypeAny> = {
	index: number
	schema: T
}

/**
 * Parameter decorator that attaches a Zod schema for request body parsing.
 * The core router parses `c.req.json()` and validates using the schema,
 * caches the parsed result in `c.get('body')`, and injects it into the method arg.
 *
 * @param schema Zod schema describing the request body.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const CreateUserDto = z.object({
 *   name: z.string(),
 *   email: z.string().email()
 * });
 *
 * class UserController {
 *   async create(@Body(CreateUserDto) body: z.infer<typeof CreateUserDto>) {
 *     // body is already validated and typed
 *     return { id: 1, ...body };
 *   }
 * }
 * ```
 */
export function Body<T extends ZodTypeAny>(schema: T): ParameterDecorator {
	return (target, propertyKey, parameterIndex) => {
		const list: BodySchemaBinding<ZodTypeAny>[] = Reflect.getMetadata(META_BODY_SCHEMA, target, propertyKey!) || []
		list.push({ index: parameterIndex!, schema })
		Reflect.defineMetadata(META_BODY_SCHEMA, list, target, propertyKey!)
	}
}

/**
 * Retrieve all body schema bindings for a method.
 *
 * @param target The controller prototype.
 * @param key The method name/symbol.
 */
export function getBodySchemaBindings(target: object, key: string | symbol): BodySchemaBinding<ZodTypeAny>[] {
	return (Reflect.getMetadata(META_BODY_SCHEMA, target, key) || []) as BodySchemaBinding<ZodTypeAny>[]
}

/**
 * Helper to obtain a parsed/validated request body inside a handler.
 * Caches the parsed result in `c.get('body')`.
 *
 * @param c Hono context.
 * @param schema Zod schema describing the body.
 * @returns Parsed body according to `schema`.
 */
export function bodyOf<T extends ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
	const existing = (c as any).get?.(CTX_BODY_KEY)
	if (existing) return Promise.resolve(existing as z.infer<T>)
	return c.req.json().then((raw: any) => {
		const parsed = schema.parse(raw)
		;(c as any).set?.(CTX_BODY_KEY, parsed)
		return parsed as z.infer<T>
	})
}
