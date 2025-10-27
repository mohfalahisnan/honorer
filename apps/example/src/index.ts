import { serve } from "@hono/node-server"
import { createModularApp, Module } from "@honorer/core"
import { AuthModule } from "./module/auth/auth.module"
import { UserModule } from "./module/users/user.module"

// Compose feature modules into a single AppModule
@Module({
	imports: [UserModule, AuthModule],
})
export class AppModule {}

// Bootstrap the app and start a Node server
async function main() {
	// Create app and register modules (response envelope enabled by default)
	const app = await createModularApp({
		options: { formatResponse: true, debug: true },
		modules: [AppModule],
	})

	// Simple health route
	app.get("/", (c) => c.text("Hello Hono!"))

	// Example route showing plain usage alongside module system
	app.get("/example", (c) => c.json({ ok: true, message: "Using @honorer/core" }))

    // Start server on configurable port
    const port = Number(process.env.PORT ?? 3001)
    serve({ fetch: app.fetch, port })
    console.log(`Server listening on http://localhost:${port}`)
}

main().catch((err) => {
	console.error("Failed to start example app:", err)
	process.exit(1)
})
