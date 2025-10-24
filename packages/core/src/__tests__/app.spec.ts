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
		const app = createApp({ options: { formatResponse: false }, controllers: [TestController] })
		const res = await app.request('/t/abc?page=2')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'abc', page: 2 })
	})

	it('paramsOf/queryOf helpers parse values from context', async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [TestController] })
		const res = await app.request('/t/helper/xyz?page=5')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'xyz', page: 5 })
	})

	// Additional edge cases

	it('handles missing query param gracefully (page -> null)', async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [TestController] })
		const res = await app.request('/t/abc')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'abc', page: null })
	})

	it('coerces numeric-like query strings (page=0)', async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [TestController] })
		// z.coerce.number() with empty string becomes 0; explicit '0' should be 0
		const res = await app.request('/t/abc?page=0')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'abc', page: 0 })
	})

	it('ignores extra query keys not defined in schema', async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [TestController] })
		const res = await app.request('/t/abc?page=3&extra=foo')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ id: 'abc', page: 3 })
	})

	it('returns 400 envelope for invalid query type (page=NaN)', async () => {
		const app = createApp({ controllers: [TestController] }) // default formatResponse=true to assert envelope
		const res = await app.request('/t/abc?page=NaN')
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.success).toBe(false)
		expect(body.code).toBe('VALIDATION_ERROR')
		expect(body.message).toBe('Request validation failed')
		expect(Array.isArray(body.meta?.issues)).toBe(true)
	})

	it('returns 400 envelope for invalid query type in helper route (page=foo)', async () => {
		const app = createApp({ controllers: [TestController] }) // default formatResponse=true
		const res = await app.request('/t/helper/abc?page=foo')
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.success).toBe(false)
		expect(body.code).toBe('VALIDATION_ERROR')
		expect(body.message).toBe('Request validation failed')
		expect(Array.isArray(body.meta?.issues)).toBe(true)
	})
})
