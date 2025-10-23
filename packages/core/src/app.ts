import { Hono } from 'hono'
import 'reflect-metadata'
import { resolve } from './decorators/inject'

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

export function registerControllers(app: Hono, controllers: ControllerClass[]) {
  for (const Controller of controllers) {
    const prefix: string = Reflect.getMetadata('prefix', Controller) || ''
    const routes: RouteRecord[] = Reflect.getMetadata('routes', Controller) || []
    const instance = resolve(Controller)

    for (const r of routes) {
      const fullPath = normalizeRoutePath(prefix, r.path)
      const propertyKey = r.propertyKey
      const methodFn: any = propertyKey ? (instance as any)[propertyKey] : r.handler
      const boundHandler = methodFn!.bind(instance)
      const bindings: any[] = propertyKey ? (Reflect.getMetadata('route:params', Controller.prototype, propertyKey) || []) : []

      if (bindings.length > 0) {
        ;(app as any)[r.method](fullPath, async (c: any) => {
          const ordered = [...bindings].sort((a, b) => a.index - b.index)
          const args = ordered.map((b: any) => {
            if (b.source === 'param') return c.req.param(b.name)
            if (b.source === 'query') return c.req.query(b.name)
            return undefined
          })
          return boundHandler(...args, c)
        })
      } else {
        ;(app as any)[r.method](fullPath, (c: any) => boundHandler(c))
      }
    }
  }
}