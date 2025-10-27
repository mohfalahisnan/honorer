import { Controller, Get, Injectable } from "@honorer/core"
import type { Context } from "hono"

@Injectable
@Controller("/todo")
export class TodoController {
	@Get("/:id")
	list(c: Context) {
		return c.json([{ id: "1", name: "Ada" }])
	}
}
