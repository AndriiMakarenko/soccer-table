import { createBrowserPersistenceAdapter } from './browserPersistence'

export const selectedPersistenceBackend: 'browser' | 'tauri' = 'browser'
export const createSelectedPersistenceAdapter = createBrowserPersistenceAdapter
