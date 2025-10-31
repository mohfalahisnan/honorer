import type { Context } from "hono"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { HonorerApp } from "../app/factory"
import { Container } from "../di/container"
import { ArrayUtils } from "./ArrayUtils"
import * as getRandomIntModule from "./getRandomInt"
import { registerControllersWithModules } from "./registerController"
import { ApiResponse, formatReturn, type PaginationInfo } from "./response"

// ----------------------------
// Existing ArrayUtils tests
// ----------------------------
describe("ArrayUtils", () => {
	describe("getRandom", () => {
		it("should return a random item from the array", () => {
			vi.spyOn(getRandomIntModule, "getRandomInt").mockReturnValue(1)
			const items = ["a", "b", "c"]
			const result = ArrayUtils.getRandom(items)
			expect(result).toBe("b")
		})

		it("should handle single-element array", () => {
			const items = ["only"]
			const result = ArrayUtils.getRandom(items)
			expect(result).toBe("only")
		})
	})

	describe("removeItem", () => {
		it("should remove the specified item from the array", () => {
			const arr = ["a", "b", "c"]
			const result = ArrayUtils.removeItem(arr, "b")
			expect(result).toEqual(["a", "c"])
		})

		it("should return the same array if item not found", () => {
			const arr = ["a", "b", "c"]
			const result = ArrayUtils.removeItem(arr, "x")
			expect(result).toEqual(["a", "b", "c"])
		})

		it("should only remove the first occurrence", () => {
			const arr = ["a", "b", "b", "c"]
			const result = ArrayUtils.removeItem(arr, "b")
			expect(result).toEqual(["a", "b", "c"])
		})
	})
})

// ----------------------------
// Existing ApiResponse tests
// ----------------------------
describe("ApiResponse", () => {
	const mockContext = { json: vi.fn((body, status) => ({ body, status })) } as unknown as Context

	it("success should create a 200 ApiResponse by default", () => {
		const response = ApiResponse.success({ foo: "bar" })
		expect(response.toJSON()).toEqual({
			status: 200,
			success: true,
			data: { foo: "bar" },
			message: undefined,
			code: undefined,
			pagination: undefined,
			meta: undefined,
		})
	})

	it("error should create a 400 ApiResponse by default", () => {
		const response = ApiResponse.error("Oops")
		expect(response.toJSON()).toEqual({
			status: 400,
			success: false,
			data: null,
			message: "Oops",
			code: undefined,
			pagination: undefined,
			meta: undefined,
		})
	})

	it("paginated should include pagination info", () => {
		const pagination: PaginationInfo = { page: 1, limit: 10, total: 50 }
		const response = ApiResponse.paginated([{ id: 1 }], pagination)
		expect(response.toJSON()).toEqual({
			status: 200,
			success: true,
			data: [{ id: 1 }],
			pagination,
			message: undefined,
			code: undefined,
			meta: undefined,
		})
	})

	it("toResponse should call Context.json with correct status", () => {
		const response = ApiResponse.success({ foo: "bar" }, { status: 201 })
		response.toResponse(mockContext)
		expect(mockContext.json).toHaveBeenCalledWith(response.toJSON(), 201)
	})
})

// ----------------------------
// Existing formatReturn tests
// ----------------------------
describe("formatReturn", () => {
	const mockContext = { json: vi.fn((body, status) => ({ body, status })) } as unknown as Context

	it("wraps plain objects in success ApiResponse", async () => {
		const result = await formatReturn(mockContext, { a: 1 })
		expect(result.body).toEqual({
			status: 200,
			success: true,
			data: { a: 1 },
			message: undefined,
			code: undefined,
			pagination: undefined,
			meta: undefined,
		})
	})

	it("passes through ApiResponse instances", async () => {
		const apiResp = ApiResponse.success([1, 2, 3])
		const result = await formatReturn(mockContext, apiResp)
		expect(result.body).toEqual(apiResp.toJSON())
	})

	it("wraps JSON Response bodies correctly", async () => {
		const jsonResponse = new Response(JSON.stringify({ foo: "bar" }), {
			status: 202,
			headers: { "content-type": "application/json" },
		})
		const result = await formatReturn(mockContext, jsonResponse)
		expect(result.body).toEqual({
			status: 202,
			success: true,
			data: { foo: "bar" },
			message: undefined,
			code: undefined,
			pagination: undefined,
			meta: undefined,
		})
	})

	it("passes through non-JSON Response objects", async () => {
		const textResponse = new Response("plain text", { status: 500, headers: { "content-type": "text/plain" } })
		const result = await formatReturn(mockContext, textResponse)
		expect(result).toBe(textResponse)
	})
})

// ----------------------------
// New registerControllersWithModules tests
// ----------------------------
vi.mock("../param", () => ({ getParamSchemaBindings: vi.fn(() => []) }))
vi.mock("../query", () => ({ getQuerySchemaBindings: vi.fn(() => []) }))
vi.mock("../body", () => ({ getBodySchemaBindings: vi.fn(() => []) }))
vi.mock("../middleware", () => ({
	getControllerMiddleware: vi.fn(() => []),
	getRouteMiddleware: vi.fn(() => []),
}))

describe("registerControllersWithModules", () => {
	let app: Hono
	let container: Container

	beforeEach(() => {
		app = new Hono()
		container = new Container()
	})

	it("should register a simple GET route and resolve controller", async () => {
		class TestController {
			static prefix = "/test"
			async hello(c: Context) {
				return { message: "Hello World" }
			}
		}

		container.register(TestController, new TestController())
		Reflect.defineMetadata("routes", [{ method: "get", path: "/hello", propertyKey: "hello" }], TestController)
		Reflect.defineMetadata("prefix", "/test", TestController)

		await registerControllersWithModules(app as unknown as HonorerApp, [TestController], { container })

		const request = new Request("http://localhost/test/hello", { method: "GET" })
		const response = await app.fetch(request)
		const json = await response.json()
		expect(json).toEqual({ data: { message: "Hello World" }, status: 200, success: true })
	})

	it("should combine module basePath and controller prefix", async () => {
		class ModController {
			static prefix = "/mod"
			async ping() {
				return "pong"
			}
		}

		container.register(ModController, new ModController())
		Reflect.defineMetadata("routes", [{ method: "get", path: "/ping", propertyKey: "ping" }], ModController)
		Reflect.defineMetadata("prefix", "/mod", ModController)

		await registerControllersWithModules(app as unknown as HonorerApp, [ModController], {
			container,
			basePath: "/api",
		})

		const req = new Request("http://localhost/api/mod/ping", { method: "GET" })
		const res = await app.fetch(req)
		const text = await res.text()
		expect(text).toEqual('{"status":200,"success":true,"data":"pong"}')
	})
})
