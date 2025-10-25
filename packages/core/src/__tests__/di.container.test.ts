import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Container, rootContainer } from '../di/container'
import { Injectable, Inject, InjectProperty } from '../decorators/inject'

// Test classes
@Injectable
class SimpleService {
  getValue() {
    return 'simple'
  }
}

@Injectable
class DependentService {
  constructor(private simpleService: SimpleService) {}
  
  getComputedValue() {
    return `dependent-${this.simpleService.getValue()}`
  }
}

@Injectable
class PropertyInjectionService {
  @InjectProperty(SimpleService)
  private simpleService!: SimpleService
  
  getValue() {
    return `property-${this.simpleService.getValue()}`
  }
}

// Set metadata for test classes
Reflect.defineMetadata('design:paramtypes', [SimpleService], DependentService)

class TokenBasedService {
  constructor(private config: any) {}
  
  getConfig() {
    return this.config
  }
}

describe('DI Container', () => {
  let container: Container

  beforeEach(() => {
    container = new Container()
    rootContainer.clear()
  })

  afterEach(() => {
    container.clear()
    rootContainer.clear()
  })

  describe('Basic Container Operations', () => {
    it('should register and resolve a simple class', () => {
      container.register(SimpleService, SimpleService)
      const instance = container.resolve(SimpleService)
      
      expect(instance).toBeInstanceOf(SimpleService)
      expect(instance.getValue()).toBe('simple')
    })

    it('should return the same instance for singleton registration', () => {
      container.register(SimpleService, SimpleService)
      const instance1 = container.resolve(SimpleService)
      const instance2 = container.resolve(SimpleService)
      
      expect(instance1).toBe(instance2)
    })

    it('should resolve dependencies automatically', () => {
      container.register(SimpleService, SimpleService)
      container.register(DependentService, DependentService)
      
      const instance = container.resolve(DependentService)
      expect(instance).toBeInstanceOf(DependentService)
      expect(instance.getComputedValue()).toBe('dependent-simple')
    })

    it('should handle token-based registration', () => {
      const config = { apiUrl: 'http://localhost:3000' }
      container.register('CONFIG', () => config)
      
      const resolvedConfig = container.resolve('CONFIG')
      expect(resolvedConfig).toEqual(config)
    })

    it('should handle factory registration', () => {
      container.register(SimpleService, SimpleService)
      container.register(TokenBasedService, () => {
        const config = { fromFactory: true }
        return new TokenBasedService(config)
      })
      
      const instance = container.resolve(TokenBasedService)
      expect(instance.getConfig()).toEqual({ fromFactory: true })
    })

    it('should check if token exists', () => {
      container.register(SimpleService, SimpleService)
      
      expect(container.has(SimpleService)).toBe(true)
      expect(container.has(DependentService)).toBe(false)
      expect(container.has('NON_EXISTENT')).toBe(false)
    })

    it('should get all registered tokens', () => {
      container.register(SimpleService, SimpleService)
      container.register('CONFIG', () => ({}))
      
      const tokens = container.getTokens()
      expect(tokens).toContain(SimpleService)
      expect(tokens).toContain('CONFIG')
      expect(tokens).toHaveLength(2)
    })

    it('should clear all registrations', () => {
      container.register(SimpleService, SimpleService)
      container.register('CONFIG', () => ({}))
      
      expect(container.getTokens()).toHaveLength(2)
      
      container.clear()
      expect(container.getTokens()).toHaveLength(0)
    })

    it('should override existing registrations', () => {
      container.register(SimpleService, SimpleService)
      const originalInstance = container.resolve(SimpleService)
      
      // Override with a different implementation
      container.override(SimpleService, () => {
        const service = new SimpleService()
        service.getValue = () => 'overridden'
        return service
      })
      
      const newInstance = container.resolve(SimpleService)
      expect(newInstance.getValue()).toBe('overridden')
      expect(newInstance).not.toBe(originalInstance)
    })
  })

  describe('Hierarchical Container', () => {
    it('should create child containers', () => {
      const child = container.child()
      expect(child).toBeInstanceOf(Container)
      expect(child).not.toBe(container)
    })

    it('should inherit from parent container', () => {
      container.register(SimpleService, SimpleService)
      const child = container.child()
      
      const instance = child.resolve(SimpleService)
      expect(instance).toBeInstanceOf(SimpleService)
    })

    it('should allow child to override parent registrations', () => {
      container.register(SimpleService, SimpleService)
      const child = container.child()
      
      // Override in child
      child.override(SimpleService, () => {
        const service = new SimpleService()
        service.getValue = () => 'child-override'
        return service
      })
      
      const parentInstance = container.resolve(SimpleService)
      const childInstance = child.resolve(SimpleService)
      
      expect(parentInstance.getValue()).toBe('simple')
      expect(childInstance.getValue()).toBe('child-override')
    })

    it('should not affect parent when child is modified', () => {
      container.register(SimpleService, SimpleService)
      const child = container.child()
      
      child.register('CHILD_ONLY', () => 'child-value')
      
      expect(child.has('CHILD_ONLY')).toBe(true)
      expect(container.has('CHILD_ONLY')).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unregistered token', () => {
      expect(() => container.resolve('UNREGISTERED'))
        .toThrow('No provider found for token: UNREGISTERED')
    })

    it('should throw error for circular dependencies', () => {
      // Create circular dependency scenario
      class ServiceA {
        constructor(serviceB: ServiceB) {}
      }
      
      class ServiceB {
        constructor(serviceA: ServiceA) {}
      }
      
      // Manually set metadata for circular dependency test
      Reflect.defineMetadata('design:paramtypes', [ServiceB], ServiceA)
      Reflect.defineMetadata('design:paramtypes', [ServiceA], ServiceB)
      
      container.register(ServiceA, ServiceA)
      container.register(ServiceB, ServiceB)
      
      expect(() => container.resolve(ServiceA))
        .toThrow('Circular dependency detected')
    })
  })

  describe('Property Injection', () => {
    it('should support property injection', () => {
      container.register(SimpleService, SimpleService)
      container.register(PropertyInjectionService, PropertyInjectionService)
      
      const instance = container.resolve(PropertyInjectionService)
      expect(instance.getValue()).toBe('property-simple')
    })
  })

  describe('Root Container', () => {
    it('should have a global root container', () => {
      expect(rootContainer).toBeInstanceOf(Container)
    })

    it('should allow registration in root container', () => {
      rootContainer.register(SimpleService, SimpleService)
      const instance = rootContainer.resolve(SimpleService)
      
      expect(instance).toBeInstanceOf(SimpleService)
    })
  })

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with legacy inject system', async () => {
      // Test that the legacy system still works
      const { resolve, override, resetContainer, Injectable: LegacyInjectable } = await import('../decorators/inject')
      
      @LegacyInjectable
      class LegacyService {
        getValue() {
          return 'legacy'
        }
      }
      
      const instance = resolve(LegacyService)
      expect(instance).toBeInstanceOf(LegacyService)
      expect(instance.getValue()).toBe('legacy')
    })
  })
})