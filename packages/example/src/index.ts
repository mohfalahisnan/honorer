import { serve } from '@hono/node-server'
import { createApp } from '@honorer/core'

// Use the core app and extend it with additional routes
const app = createApp()

app.get('/example', (c) => c.json({ ok: true, message: 'Using @honorer/core' }))

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Example server running on http://localhost:${info.port}`)
})
