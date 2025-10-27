# @honorer/core

A small toolkit around Hono that adds TypeScript decorators, Zod-powered validation, lightweight DI, a module system, and response helpers for building clean HTTP APIs.

## Features
- Decorator-based controllers and routes (`@Controller`, `@Get`, `@Post`, ...)
- Zod validation for route params, query, and body (`@Params`, `@Query`, `@Body`)
- Simple dependency injection (`@Injectable`, `@Inject`)
- Module system with dependency-aware registration (`@Module` + `createModularApp`)
- Consistent response envelope (`ApiResponse`) and result normalization (`formatReturn`)

## Install
- In a generated app: already included
- Standalone: `pnpm add @honorer/core hono`

## Quick Start (Controllers)
```ts
import { serve } from '@hono/node-server'
import { createApp, Controller, Get } from '@honorer/core'
import type { Context } from 'hono'

@Controller('/users')
class UsersController {
  @Get('/')
  list(c: Context) {
    return c.json([{ id: '1', name: 'Ada' }])
  }
}

// Register legacy controllers (object config)
const app = createApp({ controllers: [UsersController] })
serve({ fetch: app.fetch, port: 3001 })
```

## Module-First Usage
```ts
import { serve } from "@hono/node-server"
import { createModularApp, Module } from "@honorer/core"
import { AuthModule } from "./module/auth/auth.module"
import { UserModule } from "./module/users/user.module"

// Compose feature modules into a single AppModule
@Module({
	imports: [UserModule, AuthModule],
	prefix: "/api",
})
export class AppModule {}

// Bootstrap the app and start a Node server
async function main() {
	// Create app and register modules (response envelope enabled by default)
	const app = await createModularApp({
		options: { formatResponse: true, debug: false },
		modules: [AppModule],
	})

	// Example route showing plain usage alongside module system
	app.get("/", (c) => c.json({ ok: true, message: "Using @honorer/core" })) // formatResponse will be applied

	// Simple health route
	app.get("/health", (c) => c.text("Hello Hono!")) // will be response as text

	// Start server on configurable port
	const port = Number(process.env.PORT ?? 3001)
	serve({ fetch: app.fetch, port })
	console.log(`Server listening on http://localhost:${port}`)
}

main().catch((err) => {
	console.error("Failed to start example app:", err)
	process.exit(1)
})
```

## Validation with Zod
```ts
import { z } from 'zod'
import { Controller, Get, Params, Query, Body } from '@honorer/core'
import type { Context } from 'hono'

const UserParams = z.object({ id: z.string().uuid() })
const ListQuery = z.object({ page: z.coerce.number().int().min(1).default(1) })
const CreateBody = z.object({ name: z.string(), email: z.string().email() })

@Controller('/users')
class UsersController {
  @Get('/:id')
  get(@Params(UserParams) p: z.infer<typeof UserParams>, c: Context) {
    return c.json({ id: p.id })
  }

  @Get('/')
  list(@Query(ListQuery) q: z.infer<typeof ListQuery>, c: Context) {
    return c.json({ page: q.page, items: [] })
  }

  @Get('/create')
  async create(@Body(CreateBody) body: z.infer<typeof CreateBody>, c: Context) {
    return c.json({ created: body })
  }
}
```
- Helpers: `paramsOf(c, schema)`, `queryOf(c, schema)`, `bodyOf(c, schema)` to fetch parsed data manually.
- Invalid input automatically returns a 400 with details via `ZodError` handling.

## Dependency Injection
```ts
import { Injectable, Inject } from '@honorer/core'

@Injectable()
class UsersService { findAll() { return [{ id: '1' }] } }

class UsersController {
  constructor(@Inject(UsersService) private svc: UsersService) {}
}
```

## Responses
- Return plain values, `Response`, or `ApiResponse.success/error/paginated` — `formatReturn` normalizes for consistency.
- Errors thrown as `HTTPException` or `ZodError` are mapped to `ApiResponse.error`.

```ts
import { ApiResponse } from '@honorer/core'

return ApiResponse.success({ data: { id: '1' } })
```

## Configuration
- `createHonorerApp({ formatResponse?: boolean; debug?: boolean; errorHandler?: (err, c) => Response })`
- `createApp({ options, controllers, providers, modules })` registers legacy controllers and can also kick off module registration.
- `createModularApp({ options, modules, controllers?, providers? })` prefers modules first.

## Notes on Type Generation
- The previous type generator and `.honorer` output have been removed. No generator configuration or type emission is performed by the core.

## Requirements
- Node `>=20.6` recommended (works with `>=18.19`)
- TypeScript with decorators: enable `experimentalDecorators` and `emitDecoratorMetadata`
- Hono `^4`

## See Also
- Scaffold a new app: `npx create-honorer-app my-app` or `pnpm dlx create-honorer-app my-app`
- Example app in this repo: `apps/example`
