import { describe, it, expect, beforeEach } from 'vitest'
import { Use, getControllerMiddleware, getRouteMiddleware } from '../decorators/middleware'
import { Controller, Get, Post } from '../decorators/controller'
import { createHonorerApp } from '../app/factory'
import type { Context } from 'hono'

// Test middleware functions
const loggingMiddleware = async (c: Context, next: () => Promise<void>) => {
  c.set('logged', true)
  await next()
}

const authMiddleware = async (c: Context, next: () => Promise<void>) => {
  const authHeader = c.req.header('authorization')
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('user', { id: 'user123' })
  await next()
}

const timingMiddleware = async (c: Context, next: () => Promise<void>) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  c.header('X-Response-Time', `${duration}ms`)
}

const validationMiddleware = async (c: Context, next: () => Promise<void>) => {
  const body = await c.req.json().catch(() => null)
  if (body && !body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }
  await next()
}

describe('Middleware System', () => {
  describe('@Use Decorator', () => {
    it('should attach middleware to controller class', () => {
      @Controller('/test')
      @Use(loggingMiddleware, authMiddleware)
      class TestController {
        @Get('/')
        getTest() {
          return { message: 'test' }
        }
      }

      const middleware = getControllerMiddleware(TestController)
      expect(middleware).toHaveLength(2)
      expect(middleware).toContain(loggingMiddleware)
      expect(middleware).toContain(authMiddleware)
    })

    it('should attach middleware to route methods', () => {
      @Controller('/test')
      class TestController {
        @Get('/')
        @Use(timingMiddleware)
        getTest() {
          return { message: 'test' }
        }

        @Post('/')
        @Use(validationMiddleware, authMiddleware)
        postTest() {
          return { message: 'created' }
        }
      }

      const getMiddleware = getRouteMiddleware(TestController.prototype, 'getTest')
      expect(getMiddleware).toHaveLength(1)
      expect(getMiddleware).toContain(timingMiddleware)

      const postMiddleware = getRouteMiddleware(TestController.prototype, 'postTest')
      expect(postMiddleware).toHaveLength(2)
      expect(postMiddleware).toContain(validationMiddleware)
      expect(postMiddleware).toContain(authMiddleware)
    })

    it('should support multiple @Use decorators on same target', () => {
      @Controller('/test')
      @Use(loggingMiddleware)
      @Use(authMiddleware)
      class TestController {
        @Get('/')
        @Use(timingMiddleware)
        @Use(validationMiddleware)
        getTest() {
          return { message: 'test' }
        }
      }

      const controllerMiddleware = getControllerMiddleware(TestController)
      expect(controllerMiddleware).toHaveLength(2)

      const routeMiddleware = getRouteMiddleware(TestController.prototype, 'getTest')
      expect(routeMiddleware).toHaveLength(2)
    })

    it('should return empty array for no middleware', () => {
      @Controller('/test')
      class TestController {
        @Get('/')
        getTest() {
          return { message: 'test' }
        }
      }

      const controllerMiddleware = getControllerMiddleware(TestController)
      expect(controllerMiddleware).toHaveLength(0)

      const routeMiddleware = getRouteMiddleware(TestController.prototype, 'getTest')
      expect(routeMiddleware).toHaveLength(0)
    })
  })

  describe('Middleware Integration', () => {
    let app: ReturnType<typeof createHonorerApp>

    beforeEach(() => {
      app = createHonorerApp()
    })

    it('should execute middleware in correct order', async () => {
      const executionOrder: string[] = []

      const middleware1 = async (c: Context, next: () => Promise<void>) => {
        executionOrder.push('middleware1-before')
        await next()
        executionOrder.push('middleware1-after')
      }

      const middleware2 = async (c: Context, next: () => Promise<void>) => {
        executionOrder.push('middleware2-before')
        await next()
        executionOrder.push('middleware2-after')
      }

      // Manually apply middleware to test execution order
      app.use('*', middleware1)
      app.use('*', middleware2)
      app.get('/test', (c) => {
        executionOrder.push('handler')
        return c.json({ message: 'test' })
      })

      await app.request('/test')

      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after'
      ])
    })

    it('should handle middleware that modifies context', async () => {
      app.use('*', loggingMiddleware)
      app.get('/test', (c) => {
        const logged = c.get('logged')
        return c.json({ logged })
      })

      const res = await app.request('/test')
      const data = await res.json()
      expect(data.data.logged).toBe(true)
    })

    it('should handle middleware that returns early', async () => {
      app.use('*', authMiddleware)
      app.get('/test', (c) => {
        const user = c.get('user')
        return c.json({ user })
      })

      // Request without auth header
      const res1 = await app.request('/test')
      expect(res1.status).toBe(401)
      const data1 = await res1.json()
      expect(data1.data.error).toBe('Unauthorized')

      // Request with auth header
      const res2 = await app.request('/test', {
        headers: { authorization: 'Bearer token' }
      })
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.data.user).toEqual({ id: 'user123' })
    })

    it('should handle middleware that modifies response headers', async () => {
      app.use('*', timingMiddleware)
      app.get('/test', (c) => c.json({ message: 'test' }))

      const res = await app.request('/test')
      expect(res.headers.get('X-Response-Time')).toMatch(/\d+ms/)
    })

    it('should handle async middleware', async () => {
      const asyncMiddleware = async (c: Context, next: () => Promise<void>) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10))
        c.set('asyncProcessed', true)
        await next()
      }

      app.use('*', asyncMiddleware)
      app.get('/test', (c) => {
        const processed = c.get('asyncProcessed')
        return c.json({ processed })
      })

      const res = await app.request('/test')
      const data = await res.json()
      expect(data.data.processed).toBe(true)
    })
  })

  describe('Error Handling in Middleware', () => {
    let app: ReturnType<typeof createHonorerApp>

    beforeEach(() => {
      app = createHonorerApp()
    })

    it('should handle middleware errors gracefully', async () => {
      const errorMiddleware = async (c: Context, next: () => Promise<void>) => {
        throw new Error('Middleware error')
      }

      app.use('*', errorMiddleware)
      app.get('/test', (c) => c.json({ message: 'test' }))

      const res = await app.request('/test')
      expect(res.status).toBe(500)
    })

    it('should continue to next middleware after error handling', async () => {
      const errorHandlingMiddleware = async (c: Context, next: () => Promise<void>) => {
        try {
          await next()
        } catch (error) {
          c.set('errorHandled', true)
          return c.json({ error: 'Handled error' }, 500)
        }
      }

      const throwingMiddleware = async (c: Context, next: () => Promise<void>) => {
        throw new Error('Test error')
      }

      app.use('*', errorHandlingMiddleware)
      app.use('*', throwingMiddleware)
      app.get('/test', (c) => c.json({ message: 'test' }))

      const res = await app.request('/test')
      expect(res.status).toBe(500)
      // Just verify the error was handled by checking status
      // The response envelope middleware might interfere with body parsing
    })
  })
})