export type { 
  ModuleMeta, 
  ModuleClass, 
  ProviderToken, 
  MiddlewareFn,
  Provider,
  ClassProvider,
  ValueProvider,
  FactoryProvider
} from './types'
export { Module, getModuleMeta } from './decorator'
export { Container, rootContainer } from '../di/container'
export { ModuleRegistrationFactory, createModuleFactory } from './factory'
export type { ModuleRegistrationConfig } from './factory'