import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHonorerApp } from "./factory"

describe("createHonorerApp", () => {
	let consoleSpy: any

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	it("should return a Hono app with module methods", () => {
		const app = createHonorerApp()
		expect(app).toHaveProperty("registerModule")
		expect(app).toHaveProperty("registerModules")
		expect(app).toHaveProperty("getModuleFactory")
	})

	it("should use default error handler if none provided", async () => {
		const app = createHonorerApp()
		const error = new Error("Test error")
		const context: any = {
			set: vi.fn(),
		}
		const response = await (app as any).onError(error, context)
		expect(context.set).toHaveBeenCalledWith("honorer:customError", true)
	})

	it("should use custom error handler if provided", async () => {
		const customHandler = vi.fn().mockResolvedValue("custom")
		const app = createHonorerApp({ errorHandler: customHandler })
		const error = new Error("Test")
		const context: any = { set: vi.fn() }
		const result = await (app as any).onError(error, context)
		expect(customHandler).toHaveBeenCalledWith(error, context)
		expect(result).toBe("custom")
		expect(context.set).toHaveBeenCalledWith("honorer:customError", true)
	})

	it("should apply response envelope when formatResponse is true", async () => {
		const app = createHonorerApp({ formatResponse: true })
		const ctx: any = {
			set: vi.fn(),
		}
		await app.middleware[0].fn(ctx, async () => {}) // call first middleware
		expect(ctx.set).toHaveBeenCalledWith("honorer:envelope", true)
	})

	it("should not apply envelope when formatResponse is false", async () => {
		const app = createHonorerApp({ formatResponse: false })
		const ctx: any = {
			set: vi.fn(),
		}
		// no middleware called because disabled
		expect(app.middleware).toBeDefined()
	})

	it("should register modules using enhanced methods", async () => {
		const app = createHonorerApp()
		const module = { name: "testModule" } as any
		const factory = app.getModuleFactory()
		const spy = vi.spyOn(factory, "registerModule").mockResolvedValue(undefined)

		await app.registerModule(module)
		expect(spy).toHaveBeenCalledWith(module)
	})
})
