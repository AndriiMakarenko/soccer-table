import type { AppState } from '@/domain/models'
import { createEmptyAppState } from '@/domain/models'

import type { PersistenceService, SaveResult } from './storage'
import {
  NativePersistenceError,
  nativePersistenceService,
  type NativePersistenceService,
} from './tauriPersistence'

export const TAURI_STORAGE_SAVE_ERROR_MESSAGE =
  'Could not save changes to the desktop database. Check available disk space and permissions, then try again.'

export function createTauriPersistenceAdapter(
  service: Pick<
    NativePersistenceService,
    'initialize' | 'load' | 'persist'
  > = nativePersistenceService,
): PersistenceService {
  return {
    async load() {
      await service.initialize()
      return service.load()
    },
    async save(state) {
      try {
        await service.persist(state)
        return { success: true }
      } catch (error) {
        return toSaveFailure(error)
      }
    },
  }
}

export function createMemoryPersistenceAdapter(
  initialState: AppState = createEmptyAppState(),
): PersistenceService & { state(): AppState } {
  let storedState = clone(initialState)

  return {
    async load() {
      return clone(storedState)
    },
    async save(state) {
      storedState = clone(state)
      return { success: true }
    },
    state: () => clone(storedState),
  }
}

export function createFailingPersistenceAdapter(
  error: NativePersistenceError = new NativePersistenceError(
    'io',
    TAURI_STORAGE_SAVE_ERROR_MESSAGE,
  ),
): PersistenceService {
  return {
    async load() {
      throw error
    },
    async save() {
      return toSaveFailure(error)
    },
  }
}

function toSaveFailure(error: unknown): Exclude<SaveResult, { success: true }> {
  if (error instanceof NativePersistenceError) {
    return { success: false, reason: error.code, message: error.message }
  }

  return {
    success: false,
    reason: 'native-exception',
    message: TAURI_STORAGE_SAVE_ERROR_MESSAGE,
  }
}

function clone(state: AppState): AppState {
  return structuredClone(state)
}
