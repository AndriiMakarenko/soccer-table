export type PersistenceBackend = 'browser' | 'tauri'

export function resolvePersistenceBackend(mode: string): PersistenceBackend {
  return mode === 'tauri' ? 'tauri' : 'browser'
}
