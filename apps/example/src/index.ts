import { serve } from "@hono/node-server";
import { createApp } from "@honorer/core";
import { Hono } from "hono";
import { UsersController } from "./module/users/users.controller";

const rootApp = new Hono();

// Use the core app and extend it with additional routes
const app = createApp({
	controllers: [UsersController],
});

const tenant = createApp({
	controllers: [UsersController],
});

rootApp.route("/api", app);
rootApp.route("/tenant", tenant);

serve(
	{
		fetch: rootApp.fetch,
		port: 3001,
	},
	(info) => {
		console.log(`Example server running on http://localhost:${info.port}`);
	},
);
