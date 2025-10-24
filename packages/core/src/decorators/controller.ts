import 'reflect-metadata'

/**
 * Class decorator to assign a base path prefix for a controller.
 * The prefix is combined with method-level route paths at registration time.
 *
 * @param prefix Base URL path for the controller (e.g. "/users").
 */
export function Controller(prefix = ''): ClassDecorator {
	return (target) => {
		Reflect.defineMetadata('prefix', prefix, target)
	}
}

/**
 * Method decorator to register a GET route for the controller method.
 * The `path` is relative to the controller's prefix.
 *
 * @param path Route path (e.g. "/:id" or "/").
 */
export function Get(path: string = '/'): MethodDecorator {
	return (target, propertyKey, descriptor) => {
		const routes = Reflect.getMetadata('routes', target.constructor) || []
		routes.push({
			method: 'get',
			path,
			handler: descriptor.value,
			propertyKey,
		})
		Reflect.defineMetadata('routes', routes, target.constructor)
	}
}

/**
 * Method decorator to register a POST route for the controller method.
 * The `path` is relative to the controller's prefix.
 *
 * @param path Route path (e.g. "/").
 */
export function Post(path: string = '/'): MethodDecorator {
	return (target, propertyKey, descriptor) => {
		const routes = Reflect.getMetadata('routes', target.constructor) || []
		routes.push({
			method: 'post',
			path,
			handler: descriptor.value,
			propertyKey,
		})
		Reflect.defineMetadata('routes', routes, target.constructor)
	}
}

/**
 * Method decorator to register a PUT route for the controller method.
 * The `path` is relative to the controller's prefix.
 *
 * @param path Route path (e.g. "/:id").
 */
export function Put(path: string = '/'): MethodDecorator {
	return (target, propertyKey, descriptor) => {
		const routes = Reflect.getMetadata('routes', target.constructor) || []
		routes.push({
			method: 'put',
			path,
			handler: descriptor.value,
			propertyKey,
		})
		Reflect.defineMetadata('routes', routes, target.constructor)
	}
}

/**
 * Method decorator to register a DELETE route for the controller method.
 * The `path` is relative to the controller's prefix.
 *
 * @param path Route path (e.g. "/:id").
 */
export function Delete(path: string = '/'): MethodDecorator {
	return (target, propertyKey, descriptor) => {
		const routes = Reflect.getMetadata('routes', target.constructor) || []
		routes.push({
			method: 'delete',
			path,
			handler: descriptor.value,
			propertyKey,
		})
		Reflect.defineMetadata('routes', routes, target.constructor)
	}
}
