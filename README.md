# Honorer

A lightweight, TypeScript-first web framework built on top of [Hono](https://hono.dev). Honorer brings familiar ergonomics—decorators, router registry, and opinionated patterns—similar to NestJS, while staying minimal and fast.

## Highlights

- Auth: Built-in guards, JWT/session strategies, and role-based access patterns.
- Full Type Safety: End-to-end typing for handlers, params, queries, bodies, and responses.
- ORM (Kysely): Fully typed SQL, queries, and schema-safe migrations.
- Zod Validation: Define schemas once; runtime validation with inferred TypeScript types.
- Router Registry: Central route registration with metadata and typed route maps.
- Decorators: Controller- and method-level decorators for routes, guards, and schema binding.
- NestJS-like, Lighter: Familiar DX without heavy DI or module complexity.
- Hono Foundation: Fast, minimal, edge-ready HTTP layer.

## Status

- Core app bootstrap and example usage are available.
- Decorators, router registry, and auth APIs are being iterated (design-first; code coming next).

## Quick Start

- Install dependencies:
  - `pnpm install`
- Build all packages:
  - `pnpm -r run build`
- Run the example server:
  - `pnpm --filter @honorer/example run start`
  - Visit `http://localhost:3001/` and `http://localhost:3001/example`.
- Run the CLI (demo):
  - `pnpm --filter @honorer/cli run build`
  - `pnpm --filter @honorer/cli exec node dist/index.js info`

## Packages

- `@honorer/core`: Core framework primitives and app factory.
- `@honorer/example`: Example app showing how to extend core.
- `@honorer/cli`: Companion CLI for scaffolding and utilities.

## Using Core Today

```ts
// packages/example/src/index.ts
import { createApp } from '@honorer/core'
import { serve } from '@hono/node-server'

const app = createApp()

// Extend routes as needed
app.get('/example', (c) => c.json({ ok: true, message: 'Using @honorer/core' }))

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Example server running on http://localhost:${info.port}`)
})
```

## Design Overview

- App Factory (`createApp`)
  - Starts with a Hono instance and registers core middleware.
- Router Registry
  - Centralized place to register routes with names, paths, schemas, and guards.
  - Enables typed route maps and introspection.
- Decorators (planned)
  - `@Controller('/users')`, `@Get('/')`, `@Post('/')`
  - `@UseGuard(RoleGuard('admin'))`, `@UseSchema(UserSchema)`
- Zod Integration
  - Single source of truth for validation and types via schema binding.
- ORM (Kysely)
  - Type-safe query builder and schema typing for models and migrations.
- Auth
  - Strategies (JWT, session), guards, and helper decorators for protected routes.

## Example: Zod + Handlers (concept)

```ts
import { z } from 'zod'
import { controller, get, useSchema } from '@honorer/core/decorators'

const UserSchema = z.object({ id: z.string().uuid(), name: z.string().min(2) })

@controller('/users')
class UsersController {
  @get('/')
  @useSchema(UserSchema)
  list() {
    return [{ id: crypto.randomUUID(), name: 'Ada' }]
  }
}
```

## Roadmap

- v0.1: Core app factory, example app, CLI basics.
- v0.2: Router registry with typed route maps and metadata.
- v0.3: Decorators for controllers, routes, guards, and schema binding.
- v0.4: Auth strategies and guard helpers.

## Contributing

- Pull requests are welcome. Run `pnpm -r run build` and include docs for new APIs.

## Acknowledgements

- Built on [Hono](https://hono.dev), inspired by the ergonomics of NestJS.
