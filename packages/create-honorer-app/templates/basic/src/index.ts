import { serve } from "@hono/node-server"
import { createModularApp, Injectable, Module } from "@honorer/core"
import { Hono } from "hono"
import { TodoController } from "./module/todo/todo.controller"
import { UsersController } from "./module/users/users.controller"

const rootApp = new Hono()

@Injectable()
class UsersService {
	findAll() {
		return [{ id: "1", name: "Ada" }]
	}
}
@Module({
	providers: [UsersService],
	controllers: [UsersController, TodoController],
})
class AppModule {}

const app = await createModularApp({ modules: [AppModule] })

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
