# Honorer Core Refactoring Implementation Plan

## Executive Summary

This document outlines a comprehensive implementation plan for refactoring the `honorer/core` module to align with the NestJS-style modular architecture defined in the RFC while maintaining Hono's lightweight performance characteristics and ensuring backward compatibility.

## 1. Current Implementation Analysis

### 1.1 Existing Architecture Overview

**Current Structure:**
```
packages/core/src/
├── app.ts                    # Basic Hono app creation
├── decorators/               # Route and DI decorators
│   ├── controller.ts         # @Controller, @Get, @Post, etc.
│   ├── inject.ts            # @Injectable, @Inject, resolve()
│   ├── params.ts            # @Params decorator
│   ├── query.ts             # @Query decorator
│   └── body.ts              # @Body decorator
├── utils/
│   ├── registerController.ts # Controller registration logic
│   └── response.ts          # Response formatting
└── types/                   # Type definitions
```

**Current Capabilities:**
- Basic Hono app creation via `createApp()`
- Class-based controllers with route decorators
- Simple DI container with singleton scope
- Schema-based validation for params/query/body
- Automatic type generation for routes
- Response envelope formatting

### 1.2 Gap Analysis vs RFC Requirements

**Missing Components:**
1. **Module System**: No `@Module` decorator or module registration
2. **Factory Pattern**: No Hono factory with typed context
3. **Middleware Composition**: No `@Use` decorator for middleware layering
4. **Hierarchical DI**: Current DI is flat, needs module-scoped containers
5. **Validator Integration**: Not using Hono's `validator` middleware
6. **Context Variables**: Not leveraging `c.set()`/`c.get()` for type safety

**Architectural Misalignments:**
- Reflection-based parameter injection vs middleware composition
- Monolithic controller registration vs modular approach
- Basic DI container vs hierarchical module containers
- Manual schema parsing vs Hono validator integration

## 2. Implementation Roadmap

### 2.1 Phase 1: Foundation & Factory Pattern (Week 1)

#### 2.1.1 App Factory Implementation
**File: `src/app/factory.ts`**
```typescript
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'

export type AppBindings = { 
  DB?: unknown
  [key: string]: unknown 
}

export type AppVariables = {
  params?: unknown
  query?: unknown
  body?: unknown
  [key: string]: unknown
}

export const honorerFactory = createFactory<{ 
  Bindings: AppBindings
  Variables: AppVariables 
}>()

export type HonorerApp = Hono<{ 
  Bindings: AppBindings
  Variables: AppVariables 
}>

export function createHonorerApp(config: {
  formatResponse?: boolean
  generateTypes?: boolean
} = {}): HonorerApp {
  const { formatResponse = true } = config
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()
  
  app.onError(onErrorHandler)
  if (formatResponse) {
    app.use('*', responseEnvelopeMiddleware())
  }
  
  return app
}
```

#### 2.1.2 Backward Compatibility Layer
**File: `src/app.ts` (Updated)**
```typescript
import { createHonorerApp } from './app/factory'
import { registerControllers } from './utils/registerController'

// Maintain existing API
export function createApp(config: CreateAppConfig = {}): HonorerApp {
  const { options = {}, controllers = [] } = config
  const app = createHonorerApp(options)
  
  if (controllers.length) {
    registerControllers(app, { options, controllers })
  }
  
  return app
}
```

#### 2.1.3 Response Envelope Middleware
**File: `src/middleware/responseEnvelope.ts`**
```typescript
import type { MiddlewareHandler } from 'hono'
import { formatReturn } from '../utils/response'

export function responseEnvelopeMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    
    if (c.res.headers.get('content-type')?.includes('application/json')) {
      const body = await c.res.json()
      const formatted = await formatReturn(c, body)
      c.res = formatted
    }
  }
}
```

### 2.2 Phase 2: Module System & DI Container (Week 1-2)

#### 2.2.1 Module Decorator & Types
**File: `src/module/types.ts`**
```typescript
import type { Context } from 'hono'

export type ProviderToken<T = unknown> = new (...args: any[]) => T | symbol
export type MiddlewareFn = (c: Context, next: () => Promise<void>) => Promise<void>

export interface ModuleMeta {
  prefix?: string
  controllers: ControllerClass[]
  providers?: ProviderToken[]
  middlewares?: MiddlewareFn[]
  imports?: ModuleClass[]
  exports?: ProviderToken[]
}

export type ModuleClass = new (...args: any[]) => any
```

**File: `src/module/decorator.ts`**
```typescript
import 'reflect-metadata'
import type { ModuleMeta } from './types'

export function Module(meta: ModuleMeta): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('module:meta', meta, target)
  }
}
```

#### 2.2.2 Hierarchical DI Container
**File: `src/di/container.ts`**
```typescript
export class Container {
  private instances = new Map<any, any>()
  private parent?: Container

  constructor(parent?: Container) {
    this.parent = parent
  }

  register<T>(token: new (...args: any[]) => T, instance?: T): void {
    if (instance) {
      this.instances.set(token, instance)
    } else if (!this.instances.has(token)) {
      this.instances.set(token, this.resolve(token))
    }
  }

  resolve<T>(token: new (...args: any[]) => T): T {
    if (this.instances.has(token)) {
      return this.instances.get(token)
    }

    if (this.parent?.has(token)) {
      return this.parent.resolve(token)
    }

    // Resolve dependencies and create instance
    const injections = Reflect.getMetadata('inject:params', token) || []
    const paramTypes = Reflect.getMetadata('design:paramtypes', token) || []
    
    const params = paramTypes.map((type: any, index: number) => {
      const injection = injections.find((inj: any) => inj.index === index)
      const resolveToken = injection?.token ?? type
      return this.resolve(resolveToken)
    })

    const instance = new token(...params)
    this.instances.set(token, instance)
    return instance
  }

  child(): Container {
    return new Container(this)
  }

  has(token: any): boolean {
    return this.instances.has(token) || (this.parent?.has(token) ?? false)
  }

  override<T>(token: new (...args: any[]) => T, instance: T): void {
    this.instances.set(token, instance)
  }

  clear(): void {
    this.instances.clear()
  }
}

export const rootContainer = new Container()
```

#### 2.2.3 Enhanced DI Decorators
**File: `src/decorators/inject.ts` (Updated)**
```typescript
import 'reflect-metadata'
import type { ProviderToken } from '../module/types'

export function Injectable(target: any) {
  Reflect.defineMetadata('di:injectable', true, target)
  return target
}

export function Inject(token: ProviderToken): PropertyDecorator {
  return (target, propertyKey) => {
    const existing = Reflect.getMetadata('di:props', target.constructor) || []
    Reflect.defineMetadata('di:props', [...existing, { key: propertyKey, token }], target.constructor)
  }
}

// Keep existing parameter decorator for backward compatibility
export const InjectParam = <T>(token: new (...args: any[]) => T): ParameterDecorator => {
  return (target: Object, _key: string | symbol | undefined, index: number) => {
    const existing = Reflect.getMetadata("inject:params", target) || []
    existing.push({ index, token })
    Reflect.defineMetadata("inject:params", existing, target)
  }
}
```

### 2.3 Phase 3: Middleware System & Validator Integration (Week 2)

#### 2.3.1 Use Decorator for Middleware
**File: `src/decorators/middleware.ts`**
```typescript
import 'reflect-metadata'
import type { MiddlewareFn } from '../module/types'

export function Use(...middlewares: MiddlewareFn[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    if (propertyKey) {
      // Method-level middleware
      const existing = Reflect.getMetadata('route:use', target, propertyKey) || []
      Reflect.defineMetadata('route:use', [...existing, ...middlewares], target, propertyKey)
    } else {
      // Controller-level middleware
      const existing = Reflect.getMetadata('controller:use', target) || []
      Reflect.defineMetadata('controller:use', [...existing, ...middlewares], target)
    }
  }
}
```

#### 2.3.2 Hono Validator Integration
**File: `src/validators/factory.ts`**
```typescript
import { validator } from 'hono/validator'
import type { ZodSchema } from 'zod'

export function createParamValidator(schema: ZodSchema) {
  return validator('param', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        meta: { issues: result.error.issues }
      }, 400)
    }
    c.set('params', result.data)
    return result.data
  })
}

export function createQueryValidator(schema: ZodSchema) {
  return validator('query', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        success: false,
        code: 'VALIDATION_ERROR', 
        message: 'Request validation failed',
        meta: { issues: result.error.issues }
      }, 400)
    }
    c.set('query', result.data)
    return result.data
  })
}

export function createBodyValidator(schema: ZodSchema) {
  return validator('json', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      return c.json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed', 
        meta: { issues: result.error.issues }
      }, 400)
    }
    c.set('body', result.data)
    return result.data
  })
}
```

### 2.4 Phase 4: Module Registration Factory (Week 2)

#### 2.4.1 Module Registration Implementation
**File: `src/module/registerModule.ts`**
```typescript
import type { Hono } from 'hono'
import { Container } from '../di/container'
import { getBodySchemaBindings, getParamSchemaBindings, getQuerySchemaBindings } from '../decorators'
import { createParamValidator, createQueryValidator, createBodyValidator } from '../validators/factory'
import { normalizeRoutePath } from '../utils/path'
import type { ModuleClass, ModuleMeta, MiddlewareFn } from './types'
import type { RouteRecord } from '../app'

export function registerModule(
  app: Hono,
  ModuleClass: ModuleClass,
  rootContainer: Container
): void {
  const meta: ModuleMeta = Reflect.getMetadata('module:meta', ModuleClass) || { controllers: [] }
  const modulePrefix = meta.prefix ?? ''
  const moduleMiddlewares = meta.middlewares ?? []

  // Create child container for module scope
  const moduleContainer = rootContainer.child()
  
  // Register module providers
  for (const provider of meta.providers ?? []) {
    moduleContainer.register(provider)
  }

  // Process each controller in the module
  for (const Controller of meta.controllers) {
    registerController(app, Controller, moduleContainer, {
      modulePrefix,
      moduleMiddlewares
    })
  }
}

function registerController(
  app: Hono,
  Controller: any,
  container: Container,
  context: { modulePrefix: string; moduleMiddlewares: MiddlewareFn[] }
) {
  const controllerPrefix = Reflect.getMetadata('prefix', Controller) || ''
  const controllerMiddlewares = Reflect.getMetadata('controller:use', Controller) || []
  const routes: RouteRecord[] = Reflect.getMetadata('routes', Controller) || []

  // Resolve controller instance with DI
  const instance = container.resolve(Controller)
  
  // Inject properties
  const diProps = Reflect.getMetadata('di:props', Controller) || []
  for (const { key, token } of diProps) {
    (instance as any)[key] = container.resolve(token)
  }

  // Register each route
  for (const route of routes) {
    const routeMiddlewares = Reflect.getMetadata('route:use', Controller.prototype, route.propertyKey!) || []
    
    // Get schema bindings
    const paramSchema = getParamSchemaBindings(Controller.prototype, route.propertyKey!).at(0)?.schema
    const querySchema = getQuerySchemaBindings(Controller.prototype, route.propertyKey!).at(0)?.schema  
    const bodySchema = getBodySchemaBindings(Controller.prototype, route.propertyKey!).at(0)?.schema

    // Compose middleware chain: module → controller → route → validators → handler
    const handlers = [
      ...context.moduleMiddlewares,
      ...controllerMiddlewares,
      ...routeMiddlewares,
      paramSchema && createParamValidator(paramSchema),
      querySchema && createQueryValidator(querySchema),
      bodySchema && createBodyValidator(bodySchema),
      async (c) => {
        const boundHandler = route.propertyKey
          ? (instance as any)[route.propertyKey!].bind(instance)
          : route.handler!.bind(instance)
        return await boundHandler(c)
      }
    ].filter(Boolean)

    const fullPath = normalizeRoutePath(context.modulePrefix + controllerPrefix, route.path)
    ;(app as any)[route.method](fullPath, ...handlers)
  }
}
```

### 2.5 Phase 5: Enhanced Type Generation (Week 2-3)

#### 2.5.1 Module-aware Type Generator
**File: `src/types/generator.ts`**
```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ModuleMeta, RouteMeta } from './types'

export function generateModuleTypes(modules: { module: any; meta: ModuleMeta }[]): void {
  const allRoutes: RouteMeta[] = []
  
  for (const { module, meta } of modules) {
    const modulePrefix = meta.prefix ?? ''
    
    for (const Controller of meta.controllers) {
      const controllerPrefix = Reflect.getMetadata('prefix', Controller) || ''
      const routes = Reflect.getMetadata('routes', Controller) || []
      
      for (const route of routes) {
        const fullPath = normalizeRoutePath(modulePrefix + controllerPrefix, route.path)
        allRoutes.push({
          key: `${route.method.toUpperCase()} ${fullPath}`,
          method: route.method.toUpperCase(),
          path: fullPath,
          module: module.name,
          controller: Controller.name,
          // ... schema extraction logic
        })
      }
    }
  }
  
  emitRouteTypes(allRoutes)
}
```

## 3. Backward Compatibility Strategy

### 3.1 API Preservation
- **`createApp()`**: Maintained as wrapper around `createHonorerApp()`
- **Existing decorators**: All current decorators remain functional
- **Controller registration**: `registerControllers()` continues to work
- **DI system**: Existing `@Injectable`, `@Inject` preserved with enhanced functionality

### 3.2 Migration Path
1. **Phase 1**: Introduce new APIs alongside existing ones
2. **Phase 2**: Update documentation to recommend new patterns
3. **Phase 3**: Add deprecation warnings (log-only, non-breaking)
4. **Phase 4**: Optional breaking changes in major version

### 3.3 Compatibility Testing
```typescript
// Ensure existing apps continue to work
describe('Backward Compatibility', () => {
  it('should support legacy createApp API', () => {
    const app = createApp({
      controllers: [LegacyController],
      options: { formatResponse: true }
    })
    // ... test existing functionality
  })
  
  it('should support legacy DI patterns', () => {
    @Injectable
    class LegacyService {}
    
    @Controller()
    class LegacyController {
      constructor(@Inject(LegacyService) private service: LegacyService) {}
    }
    // ... verify DI still works
  })
})
```

## 4. Testing Strategy

### 4.1 Unit Tests

#### 4.1.1 Factory & App Creation
```typescript
describe('App Factory', () => {
  it('should create typed Hono app with factory', () => {
    const app = createHonorerApp()
    expect(app).toBeInstanceOf(Hono)
  })
  
  it('should apply response envelope middleware when enabled', () => {
    const app = createHonorerApp({ formatResponse: true })
    // ... verify middleware is applied
  })
})
```

#### 4.1.2 Module System
```typescript
describe('Module Registration', () => {
  it('should register module with controllers and providers', () => {
    @Module({
      controllers: [TestController],
      providers: [TestService]
    })
    class TestModule {}
    
    const app = createHonorerApp()
    registerModule(app, TestModule, rootContainer)
    // ... verify registration
  })
})
```

#### 4.1.3 DI Container
```typescript
describe('Hierarchical DI Container', () => {
  it('should resolve dependencies from parent container', () => {
    const parent = new Container()
    const child = parent.child()
    
    parent.register(ParentService)
    const resolved = child.resolve(ChildService) // depends on ParentService
    expect(resolved).toBeInstanceOf(ChildService)
  })
})
```

#### 4.1.4 Middleware Composition
```typescript
describe('Middleware Composition', () => {
  it('should apply middleware in correct order', async () => {
    const order: string[] = []
    
    const moduleMiddleware = async (c, next) => {
      order.push('module')
      await next()
    }
    
    const controllerMiddleware = async (c, next) => {
      order.push('controller') 
      await next()
    }
    
    // ... test middleware order
    expect(order).toEqual(['module', 'controller', 'validator', 'handler'])
  })
})
```

### 4.2 Integration Tests

#### 4.2.1 End-to-End Module Testing
```typescript
describe('Module Integration', () => {
  it('should handle complete request flow through module', async () => {
    @Injectable
    class UserService {
      getUser(id: string) {
        return { id, name: 'Test User' }
      }
    }
    
    @Controller('/users')
    class UserController {
      constructor(@Inject(UserService) private userService: UserService) {}
      
      @Get('/:id')
      getUser(@Params(paramsSchema) params: { id: string }, c: Context) {
        return this.userService.getUser(params.id)
      }
    }
    
    @Module({
      controllers: [UserController],
      providers: [UserService]
    })
    class UserModule {}
    
    const app = createHonorerApp()
    registerModule(app, UserModule, rootContainer)
    
    const res = await app.request('/users/123')
    expect(res.status).toBe(200)
    // ... verify response
  })
})
```

### 4.3 Type Tests
```typescript
describe('Type Safety', () => {
  it('should provide correct context variable types', () => {
    const handler = (c: Context<{ Variables: AppVariables }>) => {
      const params = c.get('params') // Should be typed
      const query = c.get('query')   // Should be typed
      const body = c.get('body')     // Should be typed
      return c.json({ params, query, body })
    }
  })
})
```

### 4.4 Snapshot Tests
```typescript
describe('Type Generation', () => {
  it('should generate correct .honorer/index.d.ts', () => {
    // ... setup modules and controllers
    generateModuleTypes(modules)
    
    const generated = fs.readFileSync('.honorer/index.d.ts', 'utf-8')
    expect(generated).toMatchSnapshot()
  })
})
```

## 5. Performance Benchmarking Plan

### 5.1 Benchmark Setup
```typescript
// benchmark/setup.ts
import autocannon from 'autocannon'
import { createApp } from '../src/app' // legacy
import { createHonorerApp, registerModule } from '../src' // new

export async function runBenchmark(name: string, app: any) {
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    duration: 30,
    requests: [
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users', body: JSON.stringify({ name: 'test' }) },
      { method: 'GET', path: '/users/123' }
    ]
  })
  
  return {
    name,
    latency: result.latency,
    requests: result.requests,
    throughput: result.throughput
  }
}
```

### 5.2 Benchmark Scenarios

#### 5.2.1 Simple JSON Response
```typescript
describe('Simple JSON Benchmark', () => {
  it('should maintain performance for basic routes', async () => {
    const legacyApp = createApp({ controllers: [SimpleController] })
    const newApp = createHonorerApp()
    registerModule(newApp, SimpleModule, rootContainer)
    
    const legacyResults = await runBenchmark('legacy-simple', legacyApp)
    const newResults = await runBenchmark('new-simple', newApp)
    
    // Should be within 5% of legacy performance
    expect(newResults.requests.mean).toBeGreaterThan(legacyResults.requests.mean * 0.95)
  })
})
```

#### 5.2.2 Validation-Heavy Routes
```typescript
describe('Validation Benchmark', () => {
  it('should improve performance with Hono validators', async () => {
    // Test routes with complex schema validation
    const legacyResults = await runBenchmark('legacy-validation', legacyApp)
    const newResults = await runBenchmark('new-validation', newApp)
    
    // New implementation should be faster due to Hono validators
    expect(newResults.latency.p95).toBeLessThan(legacyResults.latency.p95)
  })
})
```

#### 5.2.3 Error Path Performance
```typescript
describe('Error Handling Benchmark', () => {
  it('should handle errors efficiently', async () => {
    // Test error scenarios (validation failures, 404s, etc.)
    const results = await runBenchmark('error-handling', app)
    
    // Error responses should still be fast
    expect(results.latency.p95).toBeLessThan(100) // ms
  })
})
```

### 5.3 Performance Metrics
- **Latency**: p50, p95, p99 response times
- **Throughput**: Requests per second
- **Memory**: Heap usage during load
- **CPU**: CPU utilization under load

### 5.4 Performance Targets
- **Latency overhead**: ≤ 5% vs baseline Hono
- **Memory overhead**: ≤ 10% vs current implementation  
- **Throughput**: ≥ 95% of baseline performance
- **Error handling**: ≤ 2x latency of success path

## 6. Documentation Updates

### 6.1 API Documentation
- Update JSDoc comments for all new APIs
- Add usage examples for module system
- Document migration patterns from legacy to new APIs

### 6.2 Architecture Guide
- Create comprehensive guide explaining module system
- Document DI container usage and best practices
- Provide middleware composition examples

### 6.3 Migration Guide
- Step-by-step migration from legacy to module-based architecture
- Code examples showing before/after patterns
- Performance optimization tips

## 7. Deliverables & Timeline

### Week 1: Foundation
- [ ] App factory implementation
- [ ] Backward compatibility layer
- [ ] Basic module system
- [ ] Hierarchical DI container
- [ ] Unit tests for core components

### Week 2: Integration
- [ ] Module registration factory
- [ ] Middleware composition system
- [ ] Hono validator integration
- [ ] Enhanced decorators
- [ ] Integration tests

### Week 3: Polish & Optimization
- [ ] Performance benchmarking
- [ ] Type generation enhancements
- [ ] Documentation updates
- [ ] Migration guide
- [ ] Final testing and validation

## 8. Risk Mitigation

### 8.1 Breaking Changes
- **Risk**: Accidental breaking changes to existing APIs
- **Mitigation**: Comprehensive backward compatibility tests

### 8.2 Performance Regression
- **Risk**: New architecture introduces performance overhead
- **Mitigation**: Continuous benchmarking and optimization

### 8.3 Type Safety
- **Risk**: Loss of type safety in new system
- **Mitigation**: Extensive type tests and TypeScript strict mode

### 8.4 Complexity
- **Risk**: Over-engineering the solution
- **Mitigation**: Incremental implementation with regular reviews

## Conclusion

This implementation plan provides a comprehensive roadmap for refactoring honorer/core to align with the RFC architecture while maintaining backward compatibility and Hono's performance characteristics. The phased approach ensures minimal disruption to existing users while enabling the new modular architecture for future development.