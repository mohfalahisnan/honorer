import "reflect-metadata"

vi.mock("./factory", () => ({
	createHonorerApp: vi.fn(() => ({
		registerModules: vi.fn(),
	})),
}))

import { beforeEach, describe, expect, it, vi } from "vitest"
import * as UtilsModule from "../utils"
import { createApp, createModularApp } from "./app"
import * as FactoryModule from "./factory"

describe("createApp / createModularApp", () => {
	let mockApp: any

	beforeEach(() => {
		mockApp = {
			registerModules: vi.fn().mockResolvedValue(undefined),
		}
		vi.spyOn(FactoryModule, "createHonorerApp").mockReturnValue(mockApp)
		vi.spyOn(UtilsModule, "registerControllers").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	it("should create an app with default options", () => {
		const app = createApp()
		expect(FactoryModule.createHonorerApp).toHaveBeenCalledWith({
			formatResponse: true,
			debug: false,
		})
		expect(app).toBe(mockApp)
	})

	it("should register legacy controllers if provided", () => {
		class MyController {}
		const controllers = [MyController]
		const providers: any[] = []

		createApp({ controllers, providers })

		expect(UtilsModule.registerControllers).toHaveBeenCalledWith(mockApp, {
			options: { formatResponse: true, debug: false },
			controllers,
			providers,
		})
	})

	it("should call registerModules if modules are provided", async () => {
		const modules = [{}] as any
		createApp({ modules })

		expect(mockApp.registerModules).toHaveBeenCalledWith(modules)
	})

	it("should handle errors from registerModules gracefully", async () => {
		const error = new Error("fail")
		const mockRegister = vi.fn().mockRejectedValueOnce(error)
		const mockApp = { registerModules: mockRegister }
		;(FactoryModule.createHonorerApp as unknown as any).mockReturnValue(mockApp)

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// @ts-expect-error
		createApp({ modules: [{}] })

		// wait for the Promise rejection to trigger the catch
		await new Promise(process.nextTick)

		expect(consoleSpy).toHaveBeenCalledWith("Failed to register modules:", error)

		consoleSpy.mockRestore()
	})

	it("createModularApp should await module registration", async () => {
		const modules = [{}] as any
		const app = await createModularApp({ modules })
		expect(mockApp.registerModules).toHaveBeenCalledWith(modules)
		expect(app).toBe(mockApp)
	})

	it("createModularApp should also register legacy controllers after modules", async () => {
		class MyController {}
		const controllers = [MyController]
		const providers: any[] = []

		await createModularApp({ modules: [{}] as any, controllers, providers })

		expect(UtilsModule.registerControllers).toHaveBeenCalledWith(mockApp, {
			options: { formatResponse: true, debug: false },
			controllers,
			providers,
		})
	})
})
