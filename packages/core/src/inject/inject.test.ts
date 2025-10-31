import { beforeEach, describe, expect, it, vi } from "vitest"
import "reflect-metadata"
import { rootContainer } from "../di/container"
import { diResolve, Inject, Injectable, InjectProperty, override, resetContainer, resolve } from "./decorator"

vi.mock("../di/container", () => {
	const registry = new Map()
	return {
		rootContainer: {
			register: vi.fn((token) => registry.set(token, token)),
			has: vi.fn((token) => registry.has(token)),
			resolve: vi.fn((token) => {
				const value = registry.get(token)
				return typeof value === "object" ? value : new value()
			}),
			override: vi.fn((token, value) => registry.set(token, value)),
			clear: vi.fn(() => registry.clear()),
		},
	}
})

describe("Dependency Injection decorators and helpers", () => {
	beforeEach(() => {
		resetContainer()
		vi.clearAllMocks()
	})

	it("marks a class as injectable and registers it in the root container", () => {
		@Injectable
		class ServiceA {}
		expect(Reflect.getMetadata("di:injectable", ServiceA)).toBe(true)
		expect(rootContainer.register).toHaveBeenCalledWith(ServiceA)
	})

	it("works when called as @Injectable()", () => {
		@Injectable()
		class ServiceB {}
		expect(Reflect.getMetadata("di:injectable", ServiceB)).toBe(true)
		expect(rootContainer.register).toHaveBeenCalledWith(ServiceB)
	})

	it("injects dependencies via @Inject decorator", () => {
		@Injectable
		class Engine {
			start() {
				return "vroom"
			}
		}

		@Injectable
		class Car {
			constructor(@Inject(Engine) public engine: Engine) {}
		}

		// Force legacy resolution branch
		vi.mocked(rootContainer.has).mockReturnValue(false)

		const car = resolve(Car)
		expect(car).toBeInstanceOf(Car)
		expect(car.engine).toBeInstanceOf(Engine)
		expect(car.engine.start()).toBe("vroom")
	})

	it("records property injection metadata with InjectProperty", () => {
		class Logger {}

		@Injectable
		class ServiceC {
			@InjectProperty(Logger)
			logger!: Logger
		}

		const props = Reflect.getMetadata("di:props", ServiceC)
		expect(props).toEqual([{ key: "logger", token: Logger }])
	})

	it("resolves dependencies recursively when not in rootContainer", () => {
		@Injectable
		class Repo {
			id = 42
		}

		@Injectable
		class Controller {
			constructor(@Inject(Repo) public repo: Repo) {}
		}

		// Force legacy branch again
		vi.mocked(rootContainer.has).mockReturnValue(false)

		const instance = resolve(Controller)
		expect(instance.repo).toBeInstanceOf(Repo)
		expect(instance.repo.id).toBe(42)
	})

	it("allows overriding registered dependencies with mocks", () => {
		@Injectable
		class ApiClient {
			get() {
				return "real"
			}
		}

		const mock = { get: () => "mock" }
		override(ApiClient, mock as any)

		// Ensure rootContainer.resolve returns overridden object
		const instance = resolve(ApiClient)
		expect(rootContainer.override).toHaveBeenCalledWith(ApiClient, mock)
		expect(instance.get()).toBe("mock")
	})

	it("clears all containers on resetContainer()", () => {
		resetContainer()
		expect(rootContainer.clear).toHaveBeenCalled()
	})

	it("diResolve is an alias for resolve()", () => {
		expect(diResolve).toBe(resolve)
	})
})
