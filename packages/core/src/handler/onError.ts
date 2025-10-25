import { HTTPException } from "hono/http-exception"
import { ZodError } from "zod"
import { ApiResponse } from "../utils"

function onErrorHandler(err: any, c: any) {
	if (err instanceof HTTPException) {
		return err.getResponse()
	}
	if (err instanceof ZodError) {
		return ApiResponse.error("Request validation failed", {
			status: 400,
			code: "VALIDATION_ERROR",
			meta: { issues: err.issues },
		}).toResponse(c)
	}
	if (err instanceof SyntaxError) {
		return ApiResponse.error("Malformed JSON in request body", {
			status: 400,
			code: "INVALID_JSON",
		}).toResponse(c)
	}
	return ApiResponse.error(err?.message || "Unexpected server error", {
		status: 500,
		code: "INTERNAL_SERVER_ERROR",
		meta: process.env.NODE_ENV === "development" ? { stack: (err as any)?.stack } : undefined,
	}).toResponse(c)
}
export default onErrorHandler
