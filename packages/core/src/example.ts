import type { Context } from "hono"
import type { BlankEnv } from "hono/types"
import { Controller, Get, Put } from "./controller"
import { Injectable } from "./inject"

type Ctx<T extends string> = Context<BlankEnv, T>

@Injectable
@Controller("/todo")
export class TodoController {
	@Get("/:id")
	list(c: Ctx<"/:id">) {
		return c.json([{ id: "1", name: "Ada" }])
	}
	@Put("/:id")
	update(c: Context) {
		return c.json({ id: "1", name: "Ada" })
	}
}
