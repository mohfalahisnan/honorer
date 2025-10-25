import { type Context, Hono } from "hono"
import { beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import {
	createBodyValidator,
	createParamsValidator,
	createParamValidator,
	createQueryValidator,
} from "../validators/factory"

describe("Validator Factory", () => {
	let app: Hono

	beforeEach(() => {
		// Use plain Hono app without response envelope for testing validators
		app = new Hono()
	})

	describe("createParamValidator", () => {
		it("should validate route parameters", async () => {
			const schema = z.object({
				id: z.string().uuid(),
				category: z.string().min(1),
			})

			const validator = createParamValidator(schema)

			app.get("/items/:category/:id", validator, (c: Context) => {
				const params = c.get("validatedParams")
				return c.json({ params })
			})

			// Valid params
			const validId = "123e4567-e89b-12d3-a456-426614174000"
			const res1 = await app.request(`/items/electronics/${validId}`)
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.params).toEqual({
				id: validId,
				category: "electronics",
			})

			// Invalid UUID
			const res2 = await app.request("/items/electronics/invalid-uuid")
			expect(res2.status).toBe(400)
			const data2 = await res2.json()
			expect(data2.error).toBe("Invalid parameters")
			expect(data2.details).toBeDefined()
		})

		it("should handle missing required parameters", async () => {
			const schema = z.object({
				id: z.string(),
				category: z.string(),
			})

			const validator = createParamValidator(schema)

			app.get("/items/:category", validator, (c: Context) => {
				const params = c.get("validatedParams")
				return c.json({ params })
			})

			const res = await app.request("/items/electronics")
			expect(res.status).toBe(400)
			const data = await res.json()
			expect(data.error).toBe("Invalid parameters")
		})
	})

	describe("createQueryValidator", () => {
		it("should validate query parameters", async () => {
			const schema = z.object({
				page: z.string().transform(Number).pipe(z.number().min(1)),
				limit: z.string().transform(Number).pipe(z.number().min(1).max(100)),
				search: z.string().optional(),
				active: z
					.string()
					.transform((val) => val === "true")
					.optional(),
			})

			const validator = createQueryValidator(schema)

			app.get("/items", validator, (c: Context) => {
				const query = c.get("validatedQuery")
				return c.json({ query })
			})

			// Valid query
			const res1 = await app.request("/items?page=1&limit=10&search=test&active=true")
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.query).toEqual({
				page: 1,
				limit: 10,
				search: "test",
				active: true,
			})

			// Invalid page number
			const res2 = await app.request("/items?page=0&limit=10")
			expect(res2.status).toBe(400)
			const data2 = await res2.json()
			expect(data2.error).toBe("Invalid query parameters")

			// Missing required parameters
			const res3 = await app.request("/items")
			expect(res3.status).toBe(400)
		})

		it("should handle optional query parameters", async () => {
			const schema = z.object({
				page: z.string().transform(Number).pipe(z.number().min(1)).default(1),
				search: z.string().optional(),
			})

			const validator = createQueryValidator(schema)

			app.get("/items", validator, (c: Context) => {
				const query = c.get("validatedQuery")
				return c.json({ query })
			})

			const res = await app.request("/items?page=1")
			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.query).toEqual({ page: 1 })
		})
	})

	describe("createBodyValidator", () => {
		it("should validate request body", async () => {
			const schema = z.object({
				name: z.string().min(1),
				email: z.string().email(),
				age: z.number().min(18).max(120),
				tags: z.array(z.string()).optional(),
			})

			const validator = createBodyValidator(schema)

			app.post("/users", validator, (c: Context) => {
				const body = c.get("validatedBody")
				return c.json({ user: body })
			})

			// Valid body
			const validBody = {
				name: "John Doe",
				email: "john@example.com",
				age: 25,
				tags: ["developer", "javascript"],
			}

			const res1 = await app.request("/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			})
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.user).toEqual(validBody)

			// Invalid email
			const invalidBody = {
				name: "John Doe",
				email: "invalid-email",
				age: 25,
			}

			const res2 = await app.request("/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidBody),
			})
			expect(res2.status).toBe(400)
			const data2 = await res2.json()
			expect(data2.error).toBe("Invalid request body")
			expect(data2.details).toBeDefined()
		})

		it("should handle malformed JSON", async () => {
			const schema = z.object({
				name: z.string(),
			})

			const validator = createBodyValidator(schema)

			app.post("/users", validator, (c: Context) => {
				const body = c.get("validatedBody")
				return c.json({ user: body })
			})

			const res = await app.request("/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "invalid json",
			})
			expect(res.status).toBe(400)
			// For malformed JSON, Hono might return a different error format
			const responseText = await res.text()
			expect(responseText).toContain("Malformed")
		})

		it("should handle missing content-type", async () => {
			const schema = z.object({
				name: z.string(),
			})

			const validator = createBodyValidator(schema)

			app.post("/users", validator, (c: Context) => {
				const body = c.get("validatedBody")
				return c.json({ user: body })
			})

			const res = await app.request("/users", {
				method: "POST",
				body: JSON.stringify({ name: "John" }),
			})
			expect(res.status).toBe(400)
		})
	})

	describe("createParamsValidator (Legacy)", () => {
		it("should validate combined parameters", async () => {
			const schema = z.object({
				id: z.string().uuid(),
				page: z.string().transform(Number).pipe(z.number().min(1)),
				name: z.string().min(1),
			})

			const validator = createParamsValidator(schema)

			app.post("/items/:id", validator, (c: Context) => {
				const params = c.get("validatedParams")
				return c.json({ params })
			})

			const validId = "123e4567-e89b-12d3-a456-426614174000"
			const res1 = await app.request(`/items/${validId}?page=1`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test Item" }),
			})
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.params).toEqual({
				id: validId,
				page: 1,
				name: "Test Item",
			})

			// Invalid combined validation
			const res2 = await app.request(`/items/invalid-uuid?page=0`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "" }),
			})
			expect(res2.status).toBe(400)
			const data2 = await res2.json()
			expect(data2.error).toBe("Invalid parameters")
		})
	})

	describe("Validator Integration", () => {
		it("should work with multiple validators", async () => {
			const paramSchema = z.object({
				id: z.string().uuid(),
			})

			const querySchema = z.object({
				include: z.string().optional(),
			})

			const bodySchema = z.object({
				name: z.string().min(1),
			})

			const paramValidator = createParamValidator(paramSchema)
			const queryValidator = createQueryValidator(querySchema)
			const bodyValidator = createBodyValidator(bodySchema)

			app.put("/items/:id", paramValidator, queryValidator, bodyValidator, (c: Context) => {
				const params = c.get("validatedParams")
				const query = c.get("validatedQuery")
				const body = c.get("validatedBody")
				return c.json({ params, query, body })
			})

			const validId = "123e4567-e89b-12d3-a456-426614174000"
			const res = await app.request(`/items/${validId}?include=details`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Updated Item" }),
			})
			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.params).toEqual({ id: validId })
			expect(data.query).toEqual({ include: "details" })
			expect(data.body).toEqual({ name: "Updated Item" })
		})

		it("should handle validation errors from any validator", async () => {
			const paramSchema = z.object({
				id: z.string().uuid(),
			})

			const bodySchema = z.object({
				name: z.string().min(1),
			})

			const paramValidator = createParamValidator(paramSchema)
			const bodyValidator = createBodyValidator(bodySchema)

			app.put("/items/:id", paramValidator, bodyValidator, (c: Context) => {
				return c.json({ success: true })
			})

			// Invalid param, valid body
			const res1 = await app.request("/items/invalid-uuid", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Valid Name" }),
			})
			expect(res1.status).toBe(400)

			// Valid param, invalid body
			const validId = "123e4567-e89b-12d3-a456-426614174000"
			const res2 = await app.request(`/items/${validId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "" }),
			})
			expect(res2.status).toBe(400)
		})
	})

	describe("Error Response Format", () => {
		it("should return consistent error format", async () => {
			const schema = z.object({
				email: z.string().email(),
				age: z.number().min(18),
			})

			const validator = createBodyValidator(schema)

			app.post("/users", validator, (c: Context) => c.json({ success: true }))

			const res = await app.request("/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "invalid", age: 16 }),
			})

			expect(res.status).toBe(400)
			const data = await res.json()
			expect(data).toHaveProperty("error")
			expect(data).toHaveProperty("details")
			expect(Array.isArray(data.details)).toBe(true)
			expect(data.details.length).toBeGreaterThan(0)
		})
	})
})
