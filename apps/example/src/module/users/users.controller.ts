import { ApiResponse, Body, Controller, Get, Inject, Params, Post } from "@honorer/core"
import type { Context } from "hono"
import z from "zod"
import { UserService } from "./user.service"

const getUserParamsSchema = z.object({ id: z.string() })

const createUserBodySchema = z.object({
	name: z.string(),
	email: z.string().email(),
	password: z.string(),
})

// Parent Module: UsersModule is using formatReponse: true (default)
@Controller("/users")
export class UserController {
	constructor(@Inject(UserService) private userService: UserService) {}

	@Get("/")
	async listUsers() {
		const users = await this.userService.listUsers()
		return users // option 1: will be converted into json response automatically
	}

	@Get("/:id")
	async getUser(@Params(getUserParamsSchema) params: z.infer<typeof getUserParamsSchema>, c: Context) {
		const user = await this.userService.getUser(params.id)
		return c.json(user) // option 2: explicit json response
	}

	@Post("/")
	async createUser(@Body(createUserBodySchema) body: z.infer<typeof createUserBodySchema>) {
		const user = await this.userService.createUser(body)
		return ApiResponse.success(user) // option 3: explicit json response with ApiResponse
	}
}
