import { createTauriPersistenceAdapter } from './tauriPersistenceAdapter'

export const selectedPersistenceBackend: 'browser' | 'tauri' = 'tauri'
export const createSelectedPersistenceAdapter = createTauriPersistenceAdapter
