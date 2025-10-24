import { serve } from '@hono/node-server'
import { createApp } from '@honorer/core'
import { UsersController } from '@/controllers/users.controller'

const app = createApp({ controllers: [UsersController] })

app.get('/example', (c) => c.json({ ok: true, message: 'Using @honorer/core' }))

serve({ fetch: app.fetch, port: 3001 }, (info) => {
	console.log(`Server running on http://localhost:${info.port}`)
})
