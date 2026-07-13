import type { InjectionKey } from 'vue'

export const globalPersistenceErrorHostKey: InjectionKey<boolean> = Symbol(
  'global-persistence-error-host',
)
