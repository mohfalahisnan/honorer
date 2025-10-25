import "reflect-metadata"
import { ApiResponse, Controller, createApp, Get } from "@honorer/core"
import { describe, expect, it } from "vitest"

@Controller("/plain")
class PlainController {
	@Get("/")
	list() {
		return { ok: true }
	}
}

@Controller("/array")
class ArrayController {
	@Get("/")
	list() {
		return [{ id: 1 }, { id: 2 }]
	}
}

@Controller("/resp-json-ok")
class ResponseJsonOkController {
	@Get("/")
	handle() {
		return new Response(JSON.stringify({ hello: "world" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		})
	}
}

@Controller("/resp-json-err")
class ResponseJsonErrController {
	@Get("/")
	handle() {
		return new Response(JSON.stringify({ message: "Not found" }), {
			status: 404,
			headers: { "content-type": "application/json" },
		})
	}
}

@Controller("/envelope")
class EnvelopeController {
	@Get("/")
	handle(c: any) {
		return ApiResponse.success({ value: 1 }).toResponse(c)
	}
}

@Controller("/text")
class TextController {
	@Get("/")
	handle() {
		return new Response("ok", { status: 201, headers: { "content-type": "text/plain" } })
	}
}

@Controller("/string")
class StringController {
	@Get("/")
	handle() {
		return "hello"
	}
}

@Controller("/undef")
class UndefinedController {
	@Get("/")
	handle() {
		return undefined
	}
}

async function getJSON(app: any, path: string) {
	const res = await app.fetch(new Request(`http://localhost${path}`))
	const body = await res.json().catch(async () => await res.text())
	return { status: res.status, body, headers: res.headers }
}

describe("createApp formatResponse=true (default)", () => {
	it("wraps plain object in envelope", async () => {
		const app = createApp({ controllers: [PlainController] })
		const { status, body } = await getJSON(app, "/plain")
		expect(status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data).toEqual({ ok: true })
	})

	it("wraps array in envelope", async () => {
		const app = createApp({ controllers: [ArrayController] })
		const { status, body } = await getJSON(app, "/array")
		expect(status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data).toEqual([{ id: 1 }, { id: 2 }])
	})

	it("normalizes Response JSON success to envelope", async () => {
		const app = createApp({ controllers: [ResponseJsonOkController] })
		const { status, body } = await getJSON(app, "/resp-json-ok")
		expect(status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data).toEqual({ hello: "world" })
	})

	it("normalizes Response JSON error to envelope", async () => {
		const app = createApp({ controllers: [ResponseJsonErrController] })
		const { status, body } = await getJSON(app, "/resp-json-err")
		expect(status).toBe(404)
		expect(body.success).toBe(false)
		expect(body.message).toBe("Not found")
		expect(body.data).toEqual({ message: "Not found" })
	})

	it("passes through existing envelope Response unchanged", async () => {
		const app = createApp({ controllers: [EnvelopeController] })
		const { status, body } = await getJSON(app, "/envelope")
		expect(status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data).toEqual({ value: 1 })
	})

	it("passes through non-JSON Response unchanged", async () => {
		const app = createApp({ controllers: [TextController] })
		const res = await app.fetch(new Request("http://localhost/text"))
		const txt = await res.text()
		expect(res.status).toBe(201)
		expect(txt).toBe("ok")
	})

	it("wraps string and undefined as envelope data", async () => {
		const app = createApp({ controllers: [StringController, UndefinedController] })
		const s = await getJSON(app, "/string")
		expect(s.status).toBe(200)
		expect(s.body.success).toBe(true)
		expect(s.body.data).toBe("hello")

		const u = await getJSON(app, "/undef")
		expect(u.status).toBe(200)
		expect(u.body.success).toBe(true)
		expect(u.body.data).toBe(null)
	})
})

describe("createApp formatResponse=false", () => {
	it("returns plain object directly", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [PlainController] })
		const { status, body } = await getJSON(app, "/plain")
		expect(status).toBe(200)
		expect(body).toEqual({ ok: true })
	})

	it("returns array directly", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [ArrayController] })
		const { status, body } = await getJSON(app, "/array")
		expect(status).toBe(200)
		expect(body).toEqual([{ id: 1 }, { id: 2 }])
	})

	it("passes through Response JSON unchanged", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [ResponseJsonOkController] })
		const { status, body } = await getJSON(app, "/resp-json-ok")
		expect(status).toBe(200)
		expect(body).toEqual({ hello: "world" })
	})

	it("passes through Response error unchanged", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [ResponseJsonErrController] })
		const { status, body } = await getJSON(app, "/resp-json-err")
		expect(status).toBe(404)
		expect(body).toEqual({ message: "Not found" })
	})

	it("passes through envelope Response unchanged", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [EnvelopeController] })
		const { status, body } = await getJSON(app, "/envelope")
		expect(status).toBe(200)
		// Envelope is preserved
		expect(body).toEqual({ status: 200, success: true, data: { value: 1 } })
	})

	it("passes through non-JSON Response unchanged", async () => {
		const app = createApp({ options: { formatResponse: false }, controllers: [TextController] })
		const res = await app.fetch(new Request("http://localhost/text"))
		const txt = await res.text()
		expect(res.status).toBe(201)
		expect(txt).toBe("ok")
	})

	it("returns string and undefined as direct JSON", async () => {
		const app = createApp({
			options: { formatResponse: false },
			controllers: [StringController, UndefinedController],
		})
		const s = await getJSON(app, "/string")
		expect(s.status).toBe(200)
		expect(s.body).toBe("hello")

		const uRes = await app.fetch(new Request("http://localhost/undef"))
		// undefined is coerced to null in our implementation
		const uBody = await uRes.json()
		expect(uRes.status).toBe(200)
		expect(uBody).toBe(null)
	})
})
