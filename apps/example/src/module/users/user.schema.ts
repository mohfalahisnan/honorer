import z from "zod";

export const paramsSchema = z.object({
	id: z.string(),
});
export const querySchema = z.object({
	page: z.coerce.number().optional(),
	limit: z.coerce.number().optional(),
	orderBy: z.string().optional(),
	orderDir: z.enum(["asc", "desc"]).optional(),
});
export const bodySchema = z.object({
	email: z.string(),
	password: z.string(),
});
