import type { AppState } from '@/domain/models'
import { createEmptyAppState } from '@/domain/models'

import {
  NativePersistenceError,
  nativePersistenceService,
  type NativePersistenceService,
  type PersistenceErrorCode,
} from './tauriPersistence'

export const STORAGE_SAVE_ERROR_MESSAGE =
  'Could not save changes to the desktop database. Check available disk space and permissions, then try again.'
/** @deprecated Kept as a source-compatible alias while browser quota messaging is removed. */
export const STORAGE_FULL_MESSAGE = STORAGE_SAVE_ERROR_MESSAGE

export type SaveResult =
  | { success: true }
  | {
      success: false
      reason: PersistenceErrorCode
      message: string
    }

export interface PersistenceService {
  load(): Promise<AppState>
  save(state: AppState): Promise<SaveResult>
}

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
    STORAGE_SAVE_ERROR_MESSAGE,
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
    message: STORAGE_SAVE_ERROR_MESSAGE,
  }
}

function clone(state: AppState): AppState {
  return structuredClone(state)
}

export const persistenceService = createTauriPersistenceAdapter()
