import type { AppState } from '@/domain/models'
import {
  createSelectedPersistenceAdapter,
  selectedPersistenceBackend,
} from '@/services/selectedPersistence'

import type { PersistenceErrorCode } from './tauriPersistence'

export type PersistenceBackend = 'browser' | 'tauri'

export type SaveFailureReason =
  PersistenceErrorCode | 'quota-exceeded' | 'storage-error'

export type SaveResult =
  | { success: true }
  | {
      success: false
      reason: SaveFailureReason
      message: string
    }

export interface PersistenceService {
  load(): Promise<AppState>
  save(state: AppState): Promise<SaveResult>
}

export { selectedPersistenceBackend as persistenceBackend }
export const persistenceService: PersistenceService =
  createSelectedPersistenceAdapter()
