import { Controller, Get, Injectable } from "@honorer/core";

@Injectable
@Controller("/users")
export class UsersController {
	@Get("/")
	async list() {
		return { users: [{ id: 1, name: "Alice" }] };
	}
}
