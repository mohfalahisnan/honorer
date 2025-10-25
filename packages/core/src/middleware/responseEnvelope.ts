import type { MiddlewareHandler } from 'hono'
import { formatReturn } from '../utils/response'

export function responseEnvelopeMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    
    // Only format JSON responses that haven't been formatted yet
    // Guard: only run when envelope is explicitly enabled for this request
    if (!c.get?.('honorer:envelope')) {
      return
    }
    if (c.res.headers.get('content-type')?.includes('application/json')) {
      // Skip formatting when a custom error handler produced the response
      if (c.get?.('honorer:customError')) {
        return
      }
      try {
        // Clone the response to avoid consuming the original body
        const clonedRes = c.res.clone()
        const body = await clonedRes.json()
        
        // Check if response is already formatted (has success/status fields)
        if (typeof body === 'object' && body !== null && 
            ('success' in body || 'status' in body)) {
          return
        }
        
        // Pass the original response to formatReturn to preserve status code
        const formatted = await formatReturn(c, c.res)
        c.res = formatted
      } catch (error) {
        // If we can't parse the response, leave it as is
        console.warn('Failed to parse response for formatting:', error)
      }
    }
  }
}