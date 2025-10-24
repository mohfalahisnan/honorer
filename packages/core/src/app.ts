import { Hono } from "hono";
import "reflect-metadata";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { getBodySchemaBindings } from "./decorators/body";
import { resolve } from "./decorators/inject";
import { getParamSchemaBindings } from "./decorators/params";
import { getQuerySchemaBindings } from "./decorators/query";
import { ApiResponse, formatReturn } from "./utils/response";

export type ControllerClass<T = any> = new (...args: any[]) => T;
export type RouteRecord = {
	method: string;
	path: string;
	handler?: Function;
	propertyKey?: string | symbol;
};

function normalizeRoutePath(prefix: string, path: string): string {
	const combined = `${prefix}${path}`.replace(/\/{2,}/g, "/");
	if (combined.length > 1 && combined.endsWith("/")) return combined.slice(0, -1);
	return combined;
}

export type CreateAppConfig = {
	options?: {
		formatResponse?: boolean;
	};
	controllers?: ControllerClass[];
};

export function createApp({ options = { formatResponse: true }, controllers = [] }: CreateAppConfig = {}) {
	const app = new Hono();

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return err.getResponse();
		}
		if (err instanceof ZodError) {
			return ApiResponse.error("Request validation failed", {
				status: 400,
				code: "VALIDATION_ERROR",
				meta: { issues: err.issues },
			}).toResponse(c);
		}
		if (err instanceof SyntaxError) {
			return ApiResponse.error("Malformed JSON in request body", {
				status: 400,
				code: "INVALID_JSON",
			}).toResponse(c);
		}
		return ApiResponse.error(err?.message || "Unexpected server error", {
			status: 500,
			code: "INTERNAL_SERVER_ERROR",
			meta: process.env.NODE_ENV === "development" ? { stack: (err as any)?.stack } : undefined,
		}).toResponse(c);
	});

	app.get("/", (c) => {
		return c.text("Hello From Honorer!");
	});

	if (controllers.length) {
		// Use the full config so registerControllers can read options.formatResponse
		registerControllers(app, { options, controllers });
	}

	return app;
}

function registerControllers(app: Hono, { options = { formatResponse: true }, controllers = [] }: CreateAppConfig) {
	const { formatResponse } = options;
	for (const Controller of controllers) {
		const prefix: string = Reflect.getMetadata("prefix", Controller) || "";
		const routes: RouteRecord[] = Reflect.getMetadata("routes", Controller) || [];
		const instance = resolve(Controller);

		for (const r of routes) {
			const fullPath = normalizeRoutePath(prefix, r.path);
			const propertyKey = r.propertyKey;
			const methodFn: any = propertyKey ? (instance as any)[propertyKey] : r.handler;
			const boundHandler = methodFn!.bind(instance);
			const bindings: any[] = propertyKey
				? Reflect.getMetadata("route:params", Controller.prototype, propertyKey) || []
				: [];

			const paramSchemaBindings = propertyKey ? getParamSchemaBindings(Controller.prototype, propertyKey) : [];

			const querySchemaBindings = propertyKey ? getQuerySchemaBindings(Controller.prototype, propertyKey) : [];

			const bodySchemaBindings = propertyKey ? getBodySchemaBindings(Controller.prototype, propertyKey) : [];

			if (
				bindings.length > 0 ||
				paramSchemaBindings.length > 0 ||
				querySchemaBindings.length > 0 ||
				bodySchemaBindings.length > 0
			) {
				(app as any)[r.method](fullPath, async (c: any) => {
					const maxIndex = Math.max(
						...bindings.map((b: any) => b.index),
						...paramSchemaBindings.map((s: any) => s.index),
						...querySchemaBindings.map((s: any) => s.index),
						...bodySchemaBindings.map((s: any) => s.index),
						-1,
					);

					let bodyRaw: any | undefined;
					const args: any[] = [];
					for (let i = 0; i <= maxIndex; i++) {
						const pSchema = paramSchemaBindings.find((s: any) => s.index === i);
						if (pSchema) {
							const rawParams = { ...c.req.param() };
							const parsedParams = pSchema.schema.parse(rawParams);
							c.set?.("params", parsedParams);
							args.push(parsedParams);
							continue;
						}

						const qSchema = querySchemaBindings.find((s: any) => s.index === i);
						if (qSchema) {
							const rawQuery = { ...c.req.query() };
							const parsedQuery = qSchema.schema.parse(rawQuery);
							c.set?.("query", parsedQuery);
							args.push(parsedQuery);
							continue;
						}

						const bSchema = bodySchemaBindings.find((s: any) => s.index === i);
						if (bSchema) {
							if (bodyRaw === undefined) bodyRaw = await c.req.json();
							const parsedBody = bSchema.schema.parse(bodyRaw);
							c.set?.("body", parsedBody);
							args.push(parsedBody);
							continue;
						}

						const b = bindings.find((x: any) => x.index === i);
						if (b) {
							if (b.source === "param") args.push(c.req.param(b.name));
							else if (b.source === "query") args.push(c.req.query(b.name));
							else args.push(undefined);
							continue;
						}

						args.push(undefined);
					}

					const result = await boundHandler(...args, c);
					if (formatResponse) {
						return await formatReturn(c, result);
					}
					if (result instanceof Response) return result;
					if (result instanceof ApiResponse) return result.toResponse(c);
					return c.json(result);
				});
			} else {
				(app as any)[r.method](fullPath, async (c: any) => {
					const result = await boundHandler(c);
					if (formatResponse) {
						return await formatReturn(c, result);
					}
					if (result instanceof Response) return result;
					if (result instanceof ApiResponse) return result.toResponse(c);
					return c.json(result);
				});
			}
		}
	}
}
