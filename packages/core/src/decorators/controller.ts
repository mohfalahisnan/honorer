import 'reflect-metadata';

export function Controller(prefix = ''): ClassDecorator {
  return target => {
    Reflect.defineMetadata('prefix', prefix, target);
  };
}

export function Get(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const routes = Reflect.getMetadata('routes', target.constructor) || []
    routes.push({ method: 'get', path, handler: descriptor.value, propertyKey })
    Reflect.defineMetadata('routes', routes, target.constructor)
  }
}

export function Post(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const routes = Reflect.getMetadata('routes', target.constructor) || []
    routes.push({ method: 'post', path, handler: descriptor.value, propertyKey })
    Reflect.defineMetadata('routes', routes, target.constructor)
  }
}

export function Put(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const routes = Reflect.getMetadata('routes', target.constructor) || []
    routes.push({ method: 'put', path, handler: descriptor.value, propertyKey })
    Reflect.defineMetadata('routes', routes, target.constructor)
  }
}

export function Delete(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const routes = Reflect.getMetadata('routes', target.constructor) || []
    routes.push({ method: 'delete', path, handler: descriptor.value, propertyKey })
    Reflect.defineMetadata('routes', routes, target.constructor)
  }
}