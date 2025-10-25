import { validator } from 'hono/validator'
import type { ZodSchema } from 'zod'
import type { MiddlewareHandler } from 'hono'

/**
 * Create a Hono validator middleware for route parameters.
 * The validated data is stored in context variables as 'validatedParams'.
 * 
 * @param schema Zod schema for parameter validation
 * @returns Hono middleware handler
 */
export function createParamValidator(schema: ZodSchema): MiddlewareHandler {
  return validator('param', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        error: 'Invalid parameters',
        details: result.error.issues
      }, 400)
    }
    c.set('validatedParams', result.data)
    return result.data
  })
}

/**
 * Create a Hono validator middleware for query parameters.
 * The validated data is stored in context variables as 'validatedQuery'.
 * 
 * @param schema Zod schema for query validation
 * @returns Hono middleware handler
 */
export function createQueryValidator(schema: ZodSchema): MiddlewareHandler {
  return validator('query', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        error: 'Invalid query parameters',
        details: result.error.issues
      }, 400)
    }
    c.set('validatedQuery', result.data)
    return result.data
  })
}

/**
 * Create a Hono validator middleware for request body.
 * The validated data is stored in context variables as 'validatedBody'.
 * 
 * @param schema Zod schema for body validation
 * @returns Hono middleware handler
 */
export function createBodyValidator(schema: ZodSchema): MiddlewareHandler {
  return validator('json', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        error: 'Invalid request body',
        details: result.error.issues
      }, 400)
    }
    c.set('validatedBody', result.data)
    return result.data
  })
}

/**
 * Create a combined validator for params and query (legacy compatibility).
 * This merges route params, query params, and body before validation.
 * 
 * @param schema Zod schema for combined params/query/body validation
 * @returns Hono middleware handler
 */
export function createParamsValidator(schema: ZodSchema): MiddlewareHandler {
  return async (c, next) => {
    let combined = { ...c.req.param(), ...c.req.query() }
    
    // Try to include body data if it's a POST/PUT request
    try {
      const body = await c.req.json()
      combined = { ...combined, ...body }
    } catch {
      // No body or invalid JSON, continue with just params and query
    }
    
    const result = schema.safeParse(combined)
    
    if (!result.success) {
      return c.json({
        error: 'Invalid parameters',
        details: result.error.issues
      }, 400)
    }
    
    c.set('validatedParams', result.data)
    await next()
  }
}