import { type MiddlewareFn, rootContainer } from "@honorer/core"
import { AuthService } from "./auth.service"

export const authMiddleware: MiddlewareFn = async (ctx, next) => {
	const _token = ctx.req.header("authorization")
	const auth = rootContainer.resolve(AuthService) as AuthService
	if (!auth.validateToken("valid-token")) {
		return ctx.json({ error: "Unauthorized" }, 401)
	}
	await next()
}
