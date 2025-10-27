import { describe, expect, it } from "vitest"
import type { CreateHonorerAppConfig } from "../app/factory"
import { createHonorerApp, honorerFactory } from "../app/factory"

describe("App Factory", () => {
	describe("honorerFactory", () => {
		it("should create a Hono factory instance", () => {
			const factory = honorerFactory()
			expect(factory).toBeDefined()
			expect(typeof factory.createApp).toBe("function")
		})

		it("should create app with custom bindings", () => {
			const factory = honorerFactory<{ Variables: { userId: string } }>()
			const app = factory.createApp()
			expect(app).toBeDefined()
		})
	})

	describe("createHonorerApp", () => {
		it("should create app with default configuration", () => {
			const app = createHonorerApp()
			expect(app).toBeDefined()
		})

		it("should create app with custom configuration", () => {
			const config: CreateHonorerAppConfig = {
				formatResponse: false,
				errorHandler: (err, c) => c.json({ error: "Custom error" }, 500),
			}
			const app = createHonorerApp(config)
			expect(app).toBeDefined()
		})

		it("should apply response envelope middleware when enabled", async () => {
			const app = createHonorerApp({ formatResponse: true })

			// Add a test route that returns plain data
			app.get("/test", (c) => c.json({ message: "test" }))

			const res = await app.request("/test")
			const data = await res.json()

			// Should be wrapped in response envelope
			expect(data).toHaveProperty("success")
			expect(data).toHaveProperty("data")
		})

		it("should not apply response envelope when disabled", async () => {
			const app = createHonorerApp({ formatResponse: false })

			// Add a test route that returns plain data
			app.get("/test", (c) => c.json({ message: "test" }))

			const res = await app.request("/test")
			const data = await res.json()

			// Should not be wrapped
			expect(data).toEqual({ message: "test" })
		})

		it("should use custom error handler", async () => {
			const customErrorHandler = (err: Error, c: any) => {
				return c.json({ customError: true, message: err.message }, 500)
			}

			const app = createHonorerApp({ errorHandler: customErrorHandler })

			// Add a route that throws an error
			app.get("/error", () => {
				throw new Error("Test error")
			})

			const res = await app.request("/error")
			expect(res.status).toBe(500)

			const data = await res.json()
			expect(data).toEqual({
				customError: true,
				message: "Test error",
			})
		})
	})
})
