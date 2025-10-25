import 'reflect-metadata'
import type { MiddlewareFn } from '../module/types'

/**
 * Decorator to apply middleware to controllers or individual route methods.
 * Middleware functions are executed in the order they are applied.
 * 
 * When applied to a class (controller), the middleware applies to all routes in that controller.
 * When applied to a method, the middleware applies only to that specific route.
 * 
 * @param middlewares One or more middleware functions to apply
 * 
 * @example
 * ```ts
 * // Controller-level middleware
 * @Controller('/users')
 * @Use(authMiddleware, loggingMiddleware)
 * class UserController {
 *   
 *   // Method-level middleware
 *   @Get('/:id')
 *   @Use(validateIdMiddleware)
 *   getUser(@Params(userParamsSchema) params: UserParams) {
 *     // Route handler
 *   }
 * }
 * ```
 */
export function Use(...middlewares: MiddlewareFn[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    if (propertyKey) {
      // Method-level middleware
      const existing = Reflect.getMetadata('route:use', target, propertyKey) || []
      Reflect.defineMetadata('route:use', [...existing, ...middlewares], target, propertyKey)
    } else {
      // Controller-level middleware
      const existing = Reflect.getMetadata('controller:use', target) || []
      Reflect.defineMetadata('controller:use', [...existing, ...middlewares], target)
    }
  }
}

/**
 * Get middleware applied to a controller class.
 * 
 * @param target Controller class
 * @returns Array of middleware functions
 */
export function getControllerMiddleware(target: any): MiddlewareFn[] {
  return Reflect.getMetadata('controller:use', target) || []
}

/**
 * Get middleware applied to a specific route method.
 * 
 * @param target Controller prototype
 * @param propertyKey Method name
 * @returns Array of middleware functions
 */
export function getRouteMiddleware(target: any, propertyKey: string | symbol): MiddlewareFn[] {
  return Reflect.getMetadata('route:use', target, propertyKey) || []
}