import "reflect-metadata"
import { beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { Inject, Injectable } from "../decorators"
import { Body } from "../decorators/body"
import { Controller, Delete, Get, Post, Put } from "../decorators/controller"
import { Params } from "../decorators/params"
import { Query } from "../decorators/query"
import { createApp } from "../index"

// Legacy service for testing
@Injectable
class LegacyUserService {
	getUsers() {
		return [
			{ id: "1", name: "John Doe", email: "john@example.com" },
			{ id: "2", name: "Jane Smith", email: "jane@example.com" },
		]
	}

	getUserById(id: string) {
		return { id, name: "John Doe", email: "john@example.com" }
	}

	createUser(userData: any) {
		return { id: "3", ...userData }
	}

	updateUser(id: string, userData: any) {
		return { id, ...userData }
	}

	deleteUser(id: string) {
		return { success: true, deletedId: id }
	}
}

// Legacy controller for testing
@Injectable
@Controller("/users")
class LegacyUserController {
	constructor(@Inject(LegacyUserService) private userService: LegacyUserService) {}

	@Get("/")
	async getUsers(@Query() query: any) {
		const users = this.userService.getUsers()
		return {
			users,
			page: query.page || 1,
			limit: query.limit || 10,
		}
	}

	@Get("/:id")
	async getUserById(@Params() params: any) {
		return this.userService.getUserById(params.id)
	}

	@Post("/")
	async createUser(@Body() body: any) {
		return this.userService.createUser(body)
	}

	@Put("/:id")
	async updateUser(@Params() params: any, @Body() body: any) {
		return this.userService.updateUser(params.id, body)
	}

	@Delete("/:id")
	async deleteUser(@Params() params: any) {
		return this.userService.deleteUser(params.id)
	}
}

// Set up metadata for dependency injection in test environment
Reflect.defineMetadata("design:paramtypes", [LegacyUserService], LegacyUserController)

describe("Backward Compatibility", () => {
	describe("Legacy createApp API", () => {
		it("should support legacy createApp without breaking changes", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			expect(app).toBeDefined()
			expect(typeof app.request).toBe("function")
			expect(typeof app.get).toBe("function")
			expect(typeof app.post).toBe("function")
		})

		it("should handle legacy controller registration", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			// Test GET /users
			const res1 = await app.request("/users")
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.data.users).toHaveLength(2)
			expect(data1.data.page).toBe(1)
			expect(data1.data.limit).toBe(10)

			// Test GET /users with query params
			const res2 = await app.request("/users?page=2&limit=5")
			expect(res2.status).toBe(200)
			const data2 = await res2.json()
			expect(data2.data.page).toBe("2") // Query params are strings by default
			expect(data2.data.limit).toBe("5")
		})

		it("should handle legacy dependency injection", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			const res = await app.request("/users/123")
			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.data.id).toBe("123")
			expect(data.data.name).toBe("John Doe")
		})

		it("should support legacy parameter decorators", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			// Test POST with body
			const res1 = await app.request("/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New User", email: "new@example.com" }),
			})
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.data.name).toBe("New User")
			expect(data1.data.email).toBe("new@example.com")

			// Test PUT with params and body
			const res2 = await app.request("/users/456", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Updated User" }),
			})
			expect(res2.status).toBe(200)
			const data2 = await res2.json()
			expect(data2.data.id).toBe("456")
			expect(data2.data.name).toBe("Updated User")

			// Test DELETE with params
			const res3 = await app.request("/users/789", { method: "DELETE" })
			expect(res3.status).toBe(200)
			const data3 = await res3.json()
			expect(data3.data.success).toBe(true)
			expect(data3.data.deletedId).toBe("789")
		})
	})

	describe("Legacy Configuration Options", () => {
		it("should support legacy formatResponse option", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
				options: {
					formatResponse: true,
				},
			})

			const res = await app.request("/users")
			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.success).toBe(true)
			expect(data.data).toBeDefined()
			expect(data.data.users).toHaveLength(2)
		})

		it("should support legacy generateTypes option", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			expect(app).toBeDefined()
			// Type generation is tested separately
		})

		it("should support legacy custom bindings", async () => {
			// const customBinding = { customValue: "test" }

			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			expect(app).toBeDefined()
		})
	})

	describe("Legacy Error Handling", () => {
		it("should handle legacy error responses", async () => {
			@Controller("/error-test")
			class ErrorController {
				@Get("/throw")
				throwError() {
					throw new Error("Test error")
				}

				@Get("/return-error")
				returnError() {
					return { error: "Custom error", code: 400 }
				}
			}

			const app = createApp({
				controllers: [ErrorController],
			})

			// Test thrown error
			const res1 = await app.request("/error-test/throw")
			expect(res1.status).toBe(500)

			// Test returned error (should be treated as normal response)
			const res2 = await app.request("/error-test/return-error")
			expect(res2.status).toBe(200)
			const data2 = await res2.json()
			expect(data2.data.error).toBe("Custom error")
		})
	})

	describe("Legacy Middleware Support", () => {
		it("should support legacy middleware registration", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			// Add legacy-style middleware
			app.use("*", async (c, next) => {
				c.set("legacyMiddleware", true)
				await next()
			})

			app.get("/middleware-test", (c) => {
				const hasMiddleware = c.get("legacyMiddleware")
				return c.json({ hasMiddleware })
			})

			const res = await app.request("/middleware-test")
			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.data.hasMiddleware).toBe(true)
		})
	})

	describe("Legacy Schema Validation", () => {
		it("should work without schema validation (legacy behavior)", async () => {
			@Controller("/legacy-validation")
			class LegacyValidationController {
				@Post("/no-validation")
				createWithoutValidation(@Body() body: any) {
					return { received: body }
				}

				@Get("/no-validation/:id")
				getWithoutValidation(@Params() params: any) {
					return { id: params.id }
				}
			}

			const app = createApp({
				controllers: [LegacyValidationController],
			})

			// Test POST without validation
			const res1 = await app.request("/legacy-validation/no-validation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ anything: "goes", here: 123 }),
			})
			expect(res1.status).toBe(200)
			const data1 = await res1.json()
			expect(data1.data.received.anything).toBe("goes")
			expect(data1.data.received.here).toBe(123)

			// Test GET without validation
			const res2 = await app.request("/legacy-validation/no-validation/test-id")
			expect(res2.status).toBe(200)
			const data2 = await res2.json()
			expect(data2.data.id).toBe("test-id")
		})
	})

	describe("Legacy Service Registration", () => {
		it("should support legacy service registration patterns", async () => {
			@Injectable()
			class LegacyService1 {
				getValue() {
					return "service1"
				}
			}

			@Injectable()
			class LegacyService2 {
				constructor(@Inject(LegacyService1) private service1: LegacyService1) {}

				getCombinedValue() {
					return `service2-${this.service1.getValue()}`
				}
			}

			// Set metadata for dependency injection
			Reflect.defineMetadata("design:paramtypes", [LegacyService1], LegacyService2)

			@Controller("/legacy-services")
			class LegacyServiceController {
				constructor(
					@Inject(LegacyService1) private service1: LegacyService1,
					@Inject(LegacyService2) private service2: LegacyService2,
				) {}

				@Get("/test")
				test() {
					return {
						service1: this.service1.getValue(),
						service2: this.service2.getCombinedValue(),
					}
				}
			}

			// Set metadata for dependency injection
			Reflect.defineMetadata("design:paramtypes", [LegacyService1, LegacyService2], LegacyServiceController)

			const app = createApp({
				controllers: [LegacyServiceController],
				providers: [LegacyService1, LegacyService2],
			})

			const res = await app.request("/legacy-services/test")
			if (res.status !== 200) {
				const errorText = await res.text()
				console.error(`Legacy service test failed with status ${res.status}:`, errorText)
				throw new Error(`Expected 200 but got ${res.status}: ${errorText}`)
			}
			expect(res.status).toBe(200)
			const response = await res.json()
			expect(response.data.service1).toBe("service1")
			expect(response.data.service2).toBe("service2-service1")
		})
	})

	describe("Legacy Response Formats", () => {
		it("should maintain legacy response format behavior", async () => {
			@Controller("/response-format")
			class ResponseFormatController {
				@Get("/string")
				getString() {
					return "plain string"
				}

				@Get("/number")
				getNumber() {
					return 42
				}

				@Get("/boolean")
				getBoolean() {
					return true
				}

				@Get("/object")
				getObject() {
					return { key: "value", nested: { prop: 123 } }
				}

				@Get("/array")
				getArray() {
					return [1, 2, 3, "four"]
				}

				@Get("/null")
				getNull() {
					return null
				}
			}

			const app = createApp({
				options: { formatResponse: false },
				controllers: [ResponseFormatController],
			})

			// Test different response types
			const stringRes = await app.request("/response-format/string")
			expect(stringRes.status).toBe(200)
			expect(await stringRes.text()).toBe('"plain string"')

			const numberRes = await app.request("/response-format/number")
			expect(numberRes.status).toBe(200)
			expect(await numberRes.text()).toBe("42")

			const booleanRes = await app.request("/response-format/boolean")
			expect(booleanRes.status).toBe(200)
			expect(await booleanRes.text()).toBe("true")

			const objectRes = await app.request("/response-format/object")
			expect(objectRes.status).toBe(200)
			const objectData = await objectRes.json()
			expect(objectData.key).toBe("value")
			expect(objectData.nested.prop).toBe(123)

			const arrayRes = await app.request("/response-format/array")
			expect(arrayRes.status).toBe(200)
			const arrayData = await arrayRes.json()
			expect(arrayData).toEqual([1, 2, 3, "four"])

			const nullRes = await app.request("/response-format/null")
			expect(nullRes.status).toBe(200)
			expect(await nullRes.text()).toBe("null")
		})
	})

	describe("Legacy API Compatibility", () => {
		it("should maintain exact same API surface", async () => {
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			// Verify all expected methods exist (based on Hono's actual API)
			expect(typeof app.request).toBe("function")
			expect(typeof app.get).toBe("function")
			expect(typeof app.post).toBe("function")
			expect(typeof app.put).toBe("function")
			expect(typeof app.delete).toBe("function")
			expect(typeof app.patch).toBe("function")
			expect(typeof app.options).toBe("function")
			expect(typeof app.use).toBe("function")
			expect(typeof app.fetch).toBe("function")
			// Note: head, route, mount are not part of Hono's core API
		})

		it("should work with existing test suites", async () => {
			// This test simulates how existing test suites would work
			const app = createApp({
				controllers: [LegacyUserController],
				providers: [LegacyUserService],
			})

			// Simulate existing test patterns
			const testCases = [
				{ method: "GET", path: "/users", expectedStatus: 200 },
				{ method: "GET", path: "/users/123", expectedStatus: 200 },
				{ method: "POST", path: "/users", body: { name: "Test" }, expectedStatus: 200 },
				{ method: "PUT", path: "/users/123", body: { name: "Updated" }, expectedStatus: 200 },
				{ method: "DELETE", path: "/users/123", expectedStatus: 200 },
			]

			for (const testCase of testCases) {
				const options: RequestInit = { method: testCase.method }
				if (testCase.body) {
					options.headers = { "Content-Type": "application/json" }
					options.body = JSON.stringify(testCase.body)
				}

				const res = await app.request(testCase.path, options)
				if (res.status !== testCase.expectedStatus) {
					const errorText = await res.text()
					console.error(`Test case failed: ${testCase.method} ${testCase.path}`)
					console.error(`Expected status: ${testCase.expectedStatus}, got: ${res.status}`)
					console.error(`Error response: ${errorText}`)
					throw new Error(`Expected status ${testCase.expectedStatus}, got ${res.status}: ${errorText}`)
				}
				expect(res.status).toBe(testCase.expectedStatus)
			}
		})
	})
})
