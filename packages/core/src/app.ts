import { Hono } from 'hono'
import 'reflect-metadata'
import { resolve } from './decorators/inject'
import { getParamSchemaBindings } from './decorators/params'
import { getQuerySchemaBindings } from './decorators/query'

export type ControllerClass<T = any> = new (...args: any[]) => T
export type RouteRecord = { method: string; path: string; handler?: Function; propertyKey?: string | symbol }

function normalizeRoutePath(prefix: string, path: string): string {
  const combined = `${prefix}${path}`.replace(/\/{2,}/g, '/')
  if (combined.length > 1 && combined.endsWith('/')) return combined.slice(0, -1)
  return combined
}

export function createApp(controllers: ControllerClass[] = []) {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello From Honorer!')
  })

  if (controllers.length) {
    registerControllers(app, controllers)
  }

  return app
}

function registerControllers(app: Hono, controllers: ControllerClass[]) {
  for (const Controller of controllers) {
    const prefix: string = Reflect.getMetadata('prefix', Controller) || ''
    const routes: RouteRecord[] = Reflect.getMetadata('routes', Controller) || []
    const instance = resolve(Controller)

    for (const r of routes) {
      const fullPath = normalizeRoutePath(prefix, r.path)
      const propertyKey = r.propertyKey
      const methodFn: any = propertyKey ? (instance as any)[propertyKey] : r.handler
      const boundHandler = methodFn!.bind(instance)
      const bindings: any[] = propertyKey
        ? (Reflect.getMetadata('route:params', Controller.prototype, propertyKey) || [])
        : []

      const paramSchemaBindings = propertyKey
        ? getParamSchemaBindings(Controller.prototype, propertyKey)
        : []

      const querySchemaBindings = propertyKey
        ? getQuerySchemaBindings(Controller.prototype, propertyKey)
        : []

      if (bindings.length > 0 || paramSchemaBindings.length > 0 || querySchemaBindings.length > 0) {
        ;(app as any)[r.method](fullPath, async (c: any) => {
          const maxIndex = Math.max(
            ...bindings.map((b: any) => b.index),
            ...paramSchemaBindings.map((s: any) => s.index),
            ...querySchemaBindings.map((s: any) => s.index),
            -1
          )

          const args: any[] = []
          for (let i = 0; i <= maxIndex; i++) {
            const pSchema = paramSchemaBindings.find((s: any) => s.index === i)
            if (pSchema) {
              const rawParams = { ...c.req.param() }
              const parsedParams = pSchema.schema.parse(rawParams)
              c.set?.('params', parsedParams)
              args.push(parsedParams)
              continue
            }

            const qSchema = querySchemaBindings.find((s: any) => s.index === i)
            if (qSchema) {
              const rawQuery = { ...c.req.query() }
              const parsedQuery = qSchema.schema.parse(rawQuery)
              c.set?.('query', parsedQuery)
              args.push(parsedQuery)
              continue
            }

            const b = bindings.find((x: any) => x.index === i)
            if (b) {
              if (b.source === 'param') args.push(c.req.param(b.name))
              else if (b.source === 'query') args.push(c.req.query(b.name))
              else args.push(undefined)
              continue
            }

            args.push(undefined)
          }

          return boundHandler(...args, c)
        })
      } else {
        ;(app as any)[r.method](fullPath, (c: any) => boundHandler(c))
      }
    }
  }
}