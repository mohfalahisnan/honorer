import type { MiddlewareFn } from "@honorer/core"
import { AuthService } from "./auth.service"

export const authMiddleware: MiddlewareFn = async (ctx, next) => {
	// const token = ctx.req.header("authorization")
	// //@ts-expect-error
	// // const auth = ctx.container.get(AuthService)
	// if (!auth.validateToken(token)) {
	// 	return ctx.json({ error: "Unauthorized" }, 401)
	// }
	await next()
}
