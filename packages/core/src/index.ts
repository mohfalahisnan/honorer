import { Hono } from 'hono'

export function createApp() {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello From Honorer!')
  })

  return app
}
