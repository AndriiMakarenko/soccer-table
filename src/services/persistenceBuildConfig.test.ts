import { describe, expect, it } from 'vitest'

import { resolvePersistenceBackend } from './persistenceBackendConfig'

describe('persistence build configuration', () => {
  /**
   * GIVEN the ordinary development, test, or production Vite mode
   * WHEN the build-time persistence backend is resolved
   * THEN the renderer selects browser localStorage persistence
   */
  it.each(['development', 'test', 'production'])(
    'selects browser persistence for %s mode',
    (mode) => {
      expect(resolvePersistenceBackend(mode)).toBe('browser')
    },
  )

  /**
   * GIVEN the explicit Tauri Vite mode used by native development and builds
   * WHEN the build-time persistence backend is resolved
   * THEN the renderer selects only the Tauri SQLite adapter
   */
  it('selects Tauri persistence for Tauri mode', () => {
    expect(resolvePersistenceBackend('tauri')).toBe('tauri')
  })
})
