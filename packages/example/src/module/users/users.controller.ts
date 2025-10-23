import { Controller, Get, Injectable, Params, Query } from "@honorer/core";
import type { Context } from "hono";
import { z } from "zod";

export const paramsSchema = z.object({
	id: z.string(),
});
export const querySchema = z.object({
	page: z.coerce.number().optional(),
});
@Injectable
@Controller("/users")
export class UsersController {
	@Get("/:id")
	list(
		@Params(paramsSchema) p: z.infer<typeof paramsSchema>,
		@Query(querySchema) q: z.infer<typeof querySchema>,
		c: Context,
	) {
		const { id } = p;
		return c.json([{ id, page: q.page }]);
	}
}
