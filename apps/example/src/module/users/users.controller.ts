import { ApiResponse, Body, Controller, Get, Injectable, Params, Post, Query } from "@honorer/core"
import type { ExpressionBuilder } from "kysely"
import type { z } from "zod"
import type { DB } from "../../prisma/kysely/types"
import { db } from "../../utils/database"
import { bodySchema, paramsSchema, querySchema } from "./user.schema"

@Injectable
@Controller("/users")
export class UsersController {
	private readonly model = db.createCrudController("User")

	@Get()
	async listAll(@Query(querySchema) q: any) {
		const pageNum = Math.max(1, q.page ?? 1)
		const limitNum = Math.max(1, Math.min(100, q.limit ?? 10))
		const allowedOrderBy = ["id", "email", "createdAt", "updatedAt"] as const
		const ob = allowedOrderBy.includes((q.orderBy ?? "createdAt") as any) ? (q.orderBy ?? "createdAt") : "createdAt"
		const od = q.orderDir === "desc" ? "desc" : "asc"

		let qb = db.selectFrom("User").selectAll()
		qb = (qb.orderBy as any)(ob as any, od as any)
			.limit(limitNum)
			.offset((pageNum - 1) * limitNum)

		const rows = await qb.execute()

		const countRow = await db
			.selectFrom("User")
			.select((eb: ExpressionBuilder<DB, "User">) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirst()

		const total = Number((countRow as any)?.count ?? 0)
		const pageCount = total > 0 ? Math.ceil(total / limitNum) : 0

		return ApiResponse.paginated(rows, {
			page: pageNum,
			limit: limitNum,
			total,
			pageCount,
			hasNext: pageNum < pageCount,
			hasPrev: pageNum > 1,
		})
	}

	@Post("/")
	async create(@Body(bodySchema) b: z.infer<typeof bodySchema>) {
		const { password, email } = b
		const inserted = await db.insertInto("User").values({ email, password }).returningAll().executeTakeFirst()
		return ApiResponse.success(inserted ?? null, { status: 201, message: "Created" })
	}

	@Get("/:id")
	async list(@Params(paramsSchema) p: z.infer<typeof paramsSchema>) {
		const { id } = p
		const data = await this.model.getById(id)
		if (!data) {
			return ApiResponse.error("User not found", { status: 404, code: "USER_NOT_FOUND" })
		}
		return ApiResponse.success(data)
	}
}
