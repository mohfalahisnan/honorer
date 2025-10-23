import { describe, expect, it } from 'vitest'
import 'reflect-metadata'
import { Controller, createApp, Get, Injectable, Params, paramsOf, Query, queryOf } from '@honorer/core'
import type { Context } from 'hono'
import { z } from 'zod'

const paramsSchema = z.object({
	id: z.string(),
})

const querySchema = z.object({
	page: z.coerce.number().optional(),
})

@Injectable
@Controller('/t')
class TestController {
	@Get('/:id')
	decoratedRoute(
		@Params(paramsSchema) p: z.infer<typeof paramsSchema>,
		@Query(querySchema) q: z.infer<typeof querySchema>,
		c: Context,
	) {
		const { id } = p
		return c.json({ id, page: q.page ?? null })
	}

	@Get('/helper/:id')
	helperRoute(c: Context) {
		const p = paramsOf(c, paramsSchema)
		const q = queryOf(c, querySchema)
		return c.json({ id: p.id, page: q.page ?? null })
	}
}

describe('createApp + Params/Query decorators', () => {
	it('injects parsed params and query into handler arguments', async () => {
		const app = createApp([TestController])
		const res = await app.request('/t/abc?page=2')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'abc', page: 2 })
	})

	it('paramsOf/queryOf helpers parse values from context', async () => {
		const app = createApp([TestController])
		const res = await app.request('/t/helper/xyz?page=5')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'xyz', page: 5 })
	})
})
