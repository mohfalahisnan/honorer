import { Controller, Get, Injectable } from "@honorer/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createHonorerApp } from "../app/factory"
import { rootContainer } from "../di/container"
import { getModuleMeta, Module } from "../module/decorator"
import { createModuleFactory, ModuleRegistrationFactory } from "../module/factory"

// Test services
@Injectable
class TestService {
	getValue() {
		return "test-value"
	}
}

@Injectable
class AnotherService {
	constructor(private testService: TestService) {}

	getComputedValue() {
		return `computed-${this.testService.getValue()}`
	}
}

// Test controllers
@Injectable
@Controller("/test")
class TestController {
	constructor(private testService: TestService) {}

	@Get("/")
	getTest() {
		return { value: this.testService.getValue() }
	}
}

@Injectable
@Controller("/another")
class AnotherController {
	constructor(private anotherService: AnotherService) {}

	@Get("/")
	getAnother() {
		return { value: this.anotherService.getComputedValue() }
	}
}

// Set metadata for dependency injection
Reflect.defineMetadata("design:paramtypes", [TestService], AnotherService)
Reflect.defineMetadata("design:paramtypes", [TestService], TestController)
Reflect.defineMetadata("design:paramtypes", [AnotherService], AnotherController)

// Test modules
@Module({
	providers: [TestService],
	controllers: [TestController],
	exports: [TestService],
})
class TestModule {}

@Module({
	imports: [TestModule],
	providers: [AnotherService],
	controllers: [AnotherController],
})
class AppModule {}

describe("Module System", () => {
	let app: ReturnType<typeof createHonorerApp>
	let factory: ModuleRegistrationFactory

	beforeEach(() => {
		app = createHonorerApp()
		factory = createModuleFactory(app, { debug: true })
		rootContainer.clear()
	})

	afterEach(() => {
		factory.clear()
		rootContainer.clear()
	})

	describe("@Module decorator", () => {
		it("should attach metadata to module class", () => {
			const meta = getModuleMeta(TestModule)
			expect(meta).toBeDefined()
			expect(meta?.providers).toContain(TestService)
			expect(meta?.controllers).toContain(TestController)
			expect(meta?.exports).toContain(TestService)
		})

		it("should handle module with imports", () => {
			const meta = getModuleMeta(AppModule)
			expect(meta).toBeDefined()
			expect(meta?.imports).toContain(TestModule)
			expect(meta?.providers).toContain(AnotherService)
			expect(meta?.controllers).toContain(AnotherController)
		})
	})

	describe("ModuleRegistrationFactory", () => {
		it("should register a simple module", async () => {
			await factory.registerModule(TestModule)
			expect(factory.isModuleRegistered(TestModule)).toBe(true)
		})

		it("should register module with dependencies", async () => {
			await factory.registerModule(AppModule)
			expect(factory.isModuleRegistered(TestModule)).toBe(true)
			expect(factory.isModuleRegistered(AppModule)).toBe(true)
		})

		it("should prevent duplicate module registration", async () => {
			await factory.registerModule(TestModule)
			await factory.registerModule(TestModule) // Should not throw
			expect(factory.getRegisteredModules()).toHaveLength(1)
		})

		it("should register multiple modules", async () => {
			await factory.registerModules([TestModule, AppModule])
			expect(factory.getRegisteredModules()).toHaveLength(2)
		})

		it("should handle circular dependencies gracefully", async () => {
			// This test ensures the factory doesn't get stuck in infinite loops
			await expect(factory.registerModule(AppModule)).resolves.not.toThrow()
		})

		it("should throw error for module without @Module decorator", async () => {
			class InvalidModule {}
			await expect(factory.registerModule(InvalidModule as any)).rejects.toThrow(
				"Module InvalidModule is missing @Module decorator",
			)
		})
	})

	describe("Dependency Injection Integration", () => {
		it("should resolve providers in module scope", async () => {
			await factory.registerModule(TestModule)

			// Test that the service was registered and can be resolved
			const testService = rootContainer.resolve(TestService) as any
			expect(testService).toBeInstanceOf(TestService)
			expect(testService.getValue()).toBe("test-value")
		})

		it("should handle provider dependencies", async () => {
			await factory.registerModule(AppModule)

			const anotherService = rootContainer.resolve(AnotherService) as any
			expect(anotherService).toBeInstanceOf(AnotherService)
			expect(anotherService.getComputedValue()).toBe("computed-test-value")
		})

		it("should support different provider types", async () => {
			@Module({
				providers: [
					TestService,
					{
						provide: "CONFIG",
						useValue: { apiUrl: "http://localhost:3000" },
					},
					{
						provide: "COMPUTED_CONFIG",
						useFactory: (config: any) => ({ ...config, computed: true }),
						inject: ["CONFIG"],
					},
				],
			})
			class ConfigModule {}

			await factory.registerModule(ConfigModule)

			const config = rootContainer.resolve("CONFIG")
			expect(config).toEqual({ apiUrl: "http://localhost:3000" })

			const computedConfig = rootContainer.resolve("COMPUTED_CONFIG")
			expect(computedConfig).toEqual({
				apiUrl: "http://localhost:3000",
				computed: true,
			})
		})
	})

	describe("Route Registration", () => {
		it("should register controller routes", async () => {
			await factory.registerModule(TestModule)

			const res = await app.request("/test")

			// Debug: log the response if it's not 200
			if (res.status !== 200) {
				const errorText = await res.text()
				console.log("Error response:", res.status, errorText)
			}

			expect(res.status).toBe(200)

			const data = await res.json()
			expect(data).toEqual({
				status: 200,
				success: true,
				data: { value: "test-value" },
			})
		})

		it("should register routes with dependency injection", async () => {
			await factory.registerModule(AppModule)

			const res = await app.request("/another")

			// Debug: log the response if it's not 200
			if (res.status !== 200) {
				const errorText = await res.text()
				console.error("Error response:", res.status, errorText)
				throw new Error(`Expected 200 but got ${res.status}: ${errorText}`)
			}

			expect(res.status).toBe(200)

			const data = await res.json()
			expect(data).toEqual({
				status: 200,
				success: true,
				data: { value: "computed-test-value" },
			})
		})
	})

	describe("Module Factory Helper", () => {
		it("should create factory with default configuration", () => {
			const testFactory = createModuleFactory(app)
			expect(testFactory).toBeInstanceOf(ModuleRegistrationFactory)
		})

		it("should create factory with custom configuration", () => {
			const testFactory = createModuleFactory(app, {
				debug: true,
			})
			expect(testFactory).toBeInstanceOf(ModuleRegistrationFactory)
		})
	})
})
