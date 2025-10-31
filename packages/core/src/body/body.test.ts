import { describe, expect, it } from "vitest"
import "reflect-metadata"
import { Body, Controller, createApp, Injectable, Post } from "@honorer/core"
import type { Context } from "hono"
import { z } from "zod"
import { bodyOf } from "./decorator"

const CreateUserDto = z.object({
	name: z.string(),
	email: z.string().email(),
})

@Injectable
@Controller("/users")
class UserController {
	// ✅ Test decorator-based injection
	@Post("/")
	async create(@Body(CreateUserDto) body: z.infer<typeof CreateUserDto>, c: Context) {
		return c.json({ ok: true, user: body })
	}

	// ✅ Test helper-based validation inside handler
	@Post("/helper")
	async createViaHelper(c: Context) {
		const body = await bodyOf(c, CreateUserDto)
		return c.json({ ok: true, user: body })
	}
}

describe("Body decorator and bodyOf() helper", () => {
	it("validates and injects parsed body using @Body decorator", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [UserController] })
		const res = await app.request("/users", {
			method: "POST",
			body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
			headers: { "Content-Type": "application/json" },
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({
			ok: true,
			user: { name: "Alice", email: "alice@example.com" },
		})
	})

	it("validates and parses body using bodyOf() helper", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [UserController] })
		const res = await app.request("/users/helper", {
			method: "POST",
			body: JSON.stringify({ name: "Bob", email: "bob@example.com" }),
			headers: { "Content-Type": "application/json" },
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({
			ok: true,
			user: { name: "Bob", email: "bob@example.com" },
		})
	})

	it("returns 400 for invalid body (missing email)", async () => {
		const app = createApp({ controllers: [UserController] }) // default formatResponse=true
		const res = await app.request("/users", {
			method: "POST",
			body: JSON.stringify({ name: "NoEmail" }),
			headers: { "Content-Type": "application/json" },
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.success).toBe(false)
		expect(body.code).toBe("VALIDATION_ERROR")
		expect(body.message).toBe("Request validation failed")
		expect(Array.isArray(body.meta?.issues)).toBe(true)
	})

	it("returns 400 for invalid body in helper route", async () => {
		const app = createApp({ controllers: [UserController] })
		const res = await app.request("/users/helper", {
			method: "POST",
			body: JSON.stringify({ name: "Charlie", email: "not-an-email" }),
			headers: { "Content-Type": "application/json" },
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.success).toBe(false)
		expect(body.code).toBe("VALIDATION_ERROR")
		expect(body.message).toBe("Request validation failed")
		expect(Array.isArray(body.meta?.issues)).toBe(true)
	})
})
