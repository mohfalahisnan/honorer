import "reflect-metadata"
import { describe, expect, it } from "vitest"
import { Controller, Delete, Get, Post, Put } from "./decorator"

describe("Controller & HTTP method decorators", () => {
	it("should store the controller prefix metadata", () => {
		@Controller("/users")
		class UserController {}

		const prefix = Reflect.getMetadata("prefix", UserController)
		expect(prefix).toBe("/users")
	})

	it("should default prefix to empty string when not provided", () => {
		@Controller()
		class DefaultController {}

		const prefix = Reflect.getMetadata("prefix", DefaultController)
		expect(prefix).toBe("")
	})

	it("should register GET route metadata", () => {
		@Controller("/test")
		class TestController {
			@Get("/:id")
			getItem() {
				return "item"
			}
		}

		const routes = Reflect.getMetadata("routes", TestController)
		expect(routes).toHaveLength(1)
		expect(routes[0]).toMatchObject({
			method: "get",
			path: "/:id",
			propertyKey: "getItem",
		})
		expect(typeof routes[0].handler).toBe("function")
	})

	it("should register POST route metadata", () => {
		@Controller("/test")
		class TestController {
			@Post("/")
			createItem() {
				return "created"
			}
		}

		const routes = Reflect.getMetadata("routes", TestController)
		expect(routes).toHaveLength(1)
		expect(routes[0]).toMatchObject({
			method: "post",
			path: "/",
			propertyKey: "createItem",
		})
	})

	it("should register PUT route metadata", () => {
		@Controller("/test")
		class TestController {
			@Put("/:id")
			updateItem() {
				return "updated"
			}
		}

		const routes = Reflect.getMetadata("routes", TestController)
		expect(routes).toHaveLength(1)
		expect(routes[0]).toMatchObject({
			method: "put",
			path: "/:id",
			propertyKey: "updateItem",
		})
	})

	it("should register DELETE route metadata", () => {
		@Controller("/test")
		class TestController {
			@Delete("/:id")
			deleteItem() {
				return "deleted"
			}
		}

		const routes = Reflect.getMetadata("routes", TestController)
		expect(routes).toHaveLength(1)
		expect(routes[0]).toMatchObject({
			method: "delete",
			path: "/:id",
			propertyKey: "deleteItem",
		})
	})

	it("should accumulate multiple routes on the same controller", () => {
		@Controller("/multi")
		class MultiController {
			@Get("/")
			getAll() {}
			@Post("/")
			create() {}
			@Put("/:id")
			update() {}
			@Delete("/:id")
			remove() {}
		}

		const routes = Reflect.getMetadata("routes", MultiController)
		expect(routes).toHaveLength(4)
		expect(routes.map((r: any) => r.method)).toEqual(["get", "post", "put", "delete"])
	})
})
