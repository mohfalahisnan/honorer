# Honorer → Hono-aligned Architecture RFC (v1)

This RFC proposes refactoring Honorer to align with Hono’s best practices while preserving backward compatibility and improving type safety, middleware composition, and developer ergonomics.

## Goals
- Adopt Hono’s factory pattern for app creation and typed context.
- Align decorators with Hono middleware composition and `validator`-driven parsing.
- Preserve existing controller/decorator APIs with a compatibility layer.
- Keep automatic route type generation and envelope formatting.
- Improve testing, error handling, and performance benchmarks.

## Principles
- Composition over reflection: prefer explicit middleware pipes over implicit parameter injection.
- Types first: carry parsed `params/query/body` via typed context variables.
- Incremental migration: maintain the current API while enabling new patterns.
- Single source of truth: schemas drive validation, types, and docs.

## Proposed App Factory
```ts
// app/factory.ts
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'

// Customize per project as needed
export type AppBindings = { DB?: unknown }
export type AppVariables = {
  params?: unknown
  query?: unknown
  body?: unknown
}

export const honorerFactory = createFactory<{ Bindings: AppBindings; Variables: AppVariables }>()

export type HonorerApp = Hono<{ Bindings: AppBindings; Variables: AppVariables }>

export function createHonorerApp({ formatResponse = true }: { formatResponse?: boolean } = {}): HonorerApp {
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()
  app.onError(onErrorHandler)
  if (formatResponse) app.use('*', responseEnvelopeMiddleware())
  return app
}
```
- Uses Hono’s factory to type `Bindings` and `Variables` and standardize app creation.
- `createHonorerApp` replaces `createApp` internally; export both to preserve compatibility.

## Decorator Alignment
- Re-implement `@Params/@Query/@Body` using Hono’s `validator` middleware.
- Composition order: `validator(params) → validator(query) → validator(json) → handler`.
- Store parsed values in `c.set('params'|'query'|'body')` with strong types.
- Keep legacy parameter injection for methods, but implement via composed middlewares rather than positional argument binding.

Example route composition under the hood:
```ts
honorerFactory.createHandlers([
  validator('param', paramsSchema),
  validator('query', querySchema),
  validator('json', bodySchema),
  (c) => controllerMethod(c.get('params'), c.get('query'), c.get('body'), c)
])
```

## Middleware Composition
- Encourage `app.use('/prefix/*', ...)` for module-level middlewares.
- Support per-controller middleware arrays via `@Controller({ use: [...] })`.
- Ensure validators run before handlers; non-validator middlewares remain order-preserving.

## Error Handling
- Centralize in `onError` and normalize to the envelope format.
- Convert Zod `validator` errors to `400 VALIDATION_ERROR` with `issues` in `meta`.
- Preserve pass-through behavior for raw `Response` and custom `ApiResponse`.

## Types and Context
- Maintain `.honorer/index.d.ts` route types generation.
- Context variables carry parsed shapes: `c.get('params'|'query'|'body')`.
- Provide helpers: `paramsOf(c, schema)`, `queryOf(c, schema)`, `bodyOf(c, schema)` using the same types.

## Backward Compatibility Plan
- Keep `createApp` exported; internally delegate to `createHonorerApp`.
- Preserve decorators: `@Controller`, `@Get/@Post/@Put/@Delete`, `@Params/@Query/@Body`.
- Maintain `registerControllers(app, { controllers, options })` API, but compose Hono middlewares rather than reflection-based argument binding.
- No breaking changes to example app usage; deprecate positional argument injection in documentation, recommend context-first handlers.

## Migration Strategy
- Phase 1: Introduce factory, keep existing APIs; wire decorators to `validator`.
- Phase 2: Update docs and examples to prefer context variables and `factory.createHandlers`.
- Phase 3: Expand type generator to include response data typing when schemas exist.
- Phase 4: Optional deprecation warnings for positional argument injection (log-only).

## Testing Strategy
- Unit tests: factory creation, middleware order, validator error mapping, envelope formatting.
- Integration tests: controller registration, schema parsing, `.honorer` type emission.
- Type tests: generic types for `Bindings`/`Variables`, `params/query/body` inference.
- Snapshot tests: example `.honorer/index.d.ts` output.

## Performance Benchmarks
- Use `autocannon` against a local dev server.
- Scenarios: simple JSON, validation-heavy route, error path, paginated response.
- Metrics: latency (p95), RPS, memory.
- Compare before/after refactor; target ≤ 5% overhead vs baseline.

## Deliverables & Timeline
- Week 1: RFC review, finalize design; land factory and internal wiring.
- Week 2: Decorator updates, validator composition, compatibility layer, tests.
- Week 3: Docs, example updates, benchmarks, polish.

## Open Questions
- Should we allow per-route response schema for data typing in `.honorer`?
- How should `Bindings` be configured across environments (e.g., Cloudflare Workers vs Node)?
- Do we formalize a DI container, or keep the lightweight `Injectable/resolve`?

---
References:
- Hono Best Practices – https://hono.dev/docs/guides/best-practices

## NestJS-style Module Architecture (Hono-aligned)
- Objective: provide clear modular boundaries with controllers, services, and module-scoped middleware while retaining Hono’s lightweight performance and composability.
- Each module is self-contained and registers its routes, middleware, and providers via a factory pattern and decorators.

### Module Meta & Decorator
```ts
// core/module.ts
export type ProviderToken<T = unknown> = new (...args: any[]) => T | symbol
export type MiddlewareFn = (c: import('hono').Context, next: () => Promise<void>) => Promise<void>

export type ModuleMeta = {
  prefix?: string
  controllers: ControllerClass[]
  providers?: ProviderToken[] // services or tokens
  middlewares?: MiddlewareFn[] // module-level middlewares
}

export function Module(meta: ModuleMeta): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('module:meta', meta, target)
  }
}
```
- `Module` groups controllers, providers, and module-level middleware; `prefix` scopes routes.

### Controller, Service, and Middleware
```ts
// core/decorators additions
export function Use(...mws: MiddlewareFn[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    if (propertyKey) {
      const existing = Reflect.getMetadata('route:use', target, propertyKey) || []
      Reflect.defineMetadata('route:use', [...existing, ...mws], target, propertyKey)
    } else {
      const existing = Reflect.getMetadata('controller:use', target) || []
      Reflect.defineMetadata('controller:use', [...existing, ...mws], target)
    }
  }
}

export function Injectable(target: any) {
  Reflect.defineMetadata('di:injectable', true, target)
}

export function Inject(token: ProviderToken): PropertyDecorator {
  return (target, key) => {
    const existing = Reflect.getMetadata('di:props', target.constructor) || []
    Reflect.defineMetadata('di:props', [...existing, { key, token }], target.constructor)
  }
}
```
- `Use` applies middleware at controller or route level; middleware order is deterministic.
- `Injectable` marks services; `Inject` performs property-based injection for testability.

### Module Registration Factory
```ts
// core/registerModule.ts
import { Hono } from 'hono'
import { honorerFactory } from './app/factory' // Hono factory setup

export function registerModule(
  app: Hono,
  ModuleClass: new () => any,
  rootContainer: Container,
) {
  const meta: ModuleMeta = Reflect.getMetadata('module:meta', ModuleClass) || { controllers: [] }
  const modulePrefix = meta.prefix ?? ''
  const moduleUse = meta.middlewares ?? []

  // child DI container per module
  const container = rootContainer.child()
  for (const p of meta.providers ?? []) container.register(p)

  for (const Controller of meta.controllers) {
    const ctrlPrefix: string = Reflect.getMetadata('prefix', Controller) || ''
    const ctrlUse: MiddlewareFn[] = Reflect.getMetadata('controller:use', Controller) || []
    const routes: RouteRecord[] = Reflect.getMetadata('routes', Controller) || []

    const instance = container.resolve(Controller)
    const diProps = Reflect.getMetadata('di:props', Controller) || []
    for (const { key, token } of diProps) (instance as any)[key] = container.resolve(token)

    for (const r of routes) {
      const methodUse: MiddlewareFn[] = Reflect.getMetadata('route:use', Controller.prototype, r.propertyKey!) || []

      // validators (params/query/body) still driven by route decorators
      const paramSchema = getParamSchemaBindings(Controller.prototype, r.propertyKey!).at(0)?.schema
      const querySchema = getQuerySchemaBindings(Controller.prototype, r.propertyKey!).at(0)?.schema
      const bodySchema = getBodySchemaBindings(Controller.prototype, r.propertyKey!).at(0)?.schema

      const handlers = [
        ...moduleUse,
        ...ctrlUse,
        ...methodUse,
        paramSchema && validator('param', paramSchema),
        querySchema && validator('query', querySchema),
        bodySchema && validator('json', bodySchema),
        async (c) => {
          const bound = r.propertyKey
            ? (instance as any)[r.propertyKey!].bind(instance)
            : r.handler!.bind(instance)
          return await bound(c)
        },
      ].filter(Boolean)

      const fullPath = normalizeRoutePath(modulePrefix + ctrlPrefix, r.path)
      ;(app as any)[r.method](fullPath, ...handlers)
    }
  }
}
```
- Registers controllers, composes module/controller/route middlewares, and attaches validators before handlers.
- Preserves Hono’s performance by composing native middlewares without heavy wrappers.

### Route Decorators (Hono-backed)
- `@Get`, `@Post`, `@Put`, `@Delete` continue to register routes and their handlers.
- `@Params(schema)`, `@Query(schema)`, `@Body(schema)` use Hono `validator` to parse and type values.
- `@Use(...)` attaches module/controller/route middleware deterministically.

Composition order:
- `module.use → controller.use → route.use → validator(params) → validator(query) → validator(json) → handler`

### Dependency Injection
- Lightweight hierarchical container: root → module → controller scope, supporting overrides for tests.
- Providers registered via `@Module({ providers: [...] })`; resolution via `Injectable`, `Inject`, and `container.resolve`.
- Testability: `override(token, impl)` to swap providers in tests; reset with `resetContainer()`.

### Example Usage
```ts
@Module({
  prefix: '/users',
  controllers: [UsersController],
  providers: [UsersService],
  middlewares: [authMiddleware],
})
export class UsersModule {}

@Controller()
export class UsersController {
  constructor(@Inject(UsersService) private svc: UsersService) {}

  @Use(listUsersMiddleware)
  @Get('/')
  async list(@Query(querySchema) q: z.infer<typeof querySchema>, c: Context) {
    return this.svc.list(q)
  }

  @Post('/')
  async create(@Body(bodySchema) b: z.infer<typeof bodySchema>, c: Context) {
    return this.svc.create(b)
  }
}

// bootstrap
const app = createHonorerApp()
registerModule(app, UsersModule, rootContainer)
```

### Scalability & Separation of Concerns
- Modules encapsulate controllers, services, and middleware; prefixes provide clear routing boundaries.
- DI enables swapping implementations and isolating side effects.
- Middleware layering keeps cross-cutting concerns localized to modules or controllers.

### Performance Characteristics
- Middleware and validators are composed directly in Hono—no reflection at runtime on request path.
- DI resolution occurs at registration time; request-time handlers are thin.
- Benchmarks aim for ≤ 5% overhead relative to Hono baseline.

### Compatibility & Migration
- `createApp` delegates to `createHonorerApp`; existing controllers continue working.
- New `Module` and `Use` decorators are additive; legacy argument injection remains but docs prefer context-first.
- Type generation `.honorer/index.d.ts` remains intact; enhanced to include module prefixes.