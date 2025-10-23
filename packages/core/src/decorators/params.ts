import 'reflect-metadata';

export type ParamBinding = { index: number; source: 'param' | 'query'; name: string }

export function Param(name: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    const key = propertyKey as string | symbol
    const bindings: ParamBinding[] = Reflect.getMetadata('route:params', target, key) || []
    bindings.push({ index, source: 'param', name })
    Reflect.defineMetadata('route:params', bindings, target, key)
  }
}

export function Query(name: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    const key = propertyKey as string | symbol
    const bindings: ParamBinding[] = Reflect.getMetadata('route:params', target, key) || []
    bindings.push({ index, source: 'query', name })
    Reflect.defineMetadata('route:params', bindings, target, key)
  }
}