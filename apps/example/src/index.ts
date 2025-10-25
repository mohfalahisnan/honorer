import { serve } from "@hono/node-server"
import { createApp } from "@honorer/core"
import { Hono } from "hono"
import { TodoController } from "./module/todo/todo.controller"
import { UsersController } from "./module/users/users.controller"

const rootApp = new Hono()

// Use the core app and extend it with additional routes
const app = createApp({
	controllers: [UsersController, TodoController],
})

rootApp.route("/api", app)

serve(
	{
		fetch: rootApp.fetch,
		port: 3001,
	},
	(info) => {
		console.log(`Example server running on http://localhost:${info.port}`)
	},
)
