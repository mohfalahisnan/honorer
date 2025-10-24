import { describe, expect, it } from "vitest";
import "reflect-metadata";
import { createApp } from "@honorer/core";
import { UsersController } from "../module/users/users.controller";
import type { Context } from "hono";

describe("Example app routes", () => {
	it("returns typed params and query from UsersController", async () => {
		const app = createApp({ controllers: [UsersController] });
		const res = await app.request("/users/42?page=2");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual([{ id: "42", page: 2 }]);
	});

	it("returns ok from /example route", async () => {
		const app = createApp({ controllers: [UsersController] });
		app.get("/example", (c: Context) => c.json({ ok: true, message: "Using @honorer/core" }));
		const res = await app.request("/example");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ ok: true, message: "Using @honorer/core" });
	});
});
