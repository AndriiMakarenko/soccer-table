import type {
  AppState,
  League,
  Match,
  RandomTiebreakerLock,
  TableMode,
  Season,
  Team,
} from '@/domain/models'
import { createEmptyAppState } from '@/domain/models'

export const STORAGE_VERSION = 1
export const STORAGE_KEY = `round-robin-tournament-manager:v${STORAGE_VERSION}`
export const STORAGE_FULL_MESSAGE =
  'Could not save changes because browser storage is full. Please export or delete old leagues/seasons before continuing.'
export const STORAGE_SAVE_ERROR_MESSAGE =
  'Could not save changes to browser storage. Please try again.'

interface StorageEnvelope {
  version: typeof STORAGE_VERSION
  state: AppState
}

export type SaveResult =
  | { success: true }
  | {
      success: false
      reason: 'quota-exceeded' | 'storage-error'
      message: string
    }

export interface PersistenceService {
  load(): AppState
  save(state: AppState): SaveResult
}

export function createPersistenceService(
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
): PersistenceService {
  return {
    load(): AppState {
      try {
        const serializedState = storage.getItem(STORAGE_KEY)

        if (serializedState === null) {
          return createEmptyAppState()
        }

        const envelope: unknown = JSON.parse(serializedState)

        if (!isStorageEnvelope(envelope)) {
          return createEmptyAppState()
        }

        return envelope.state
      } catch {
        return createEmptyAppState()
      }
    },

    save(state: AppState): SaveResult {
      const envelope: StorageEnvelope = {
        version: STORAGE_VERSION,
        state,
      }

      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
        return { success: true }
      } catch (error) {
        if (isQuotaExceededError(error)) {
          return {
            success: false,
            reason: 'quota-exceeded',
            message: STORAGE_FULL_MESSAGE,
          }
        }

        return {
          success: false,
          reason: 'storage-error',
          message: STORAGE_SAVE_ERROR_MESSAGE,
        }
      }
    },
  }
}

function isStorageEnvelope(value: unknown): value is StorageEnvelope {
  if (!isRecord(value)) {
    return false
  }

  return value.version === STORAGE_VERSION && isAppState(value.state)
}

function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    Array.isArray(value.leagues) &&
    value.leagues.every(isLeague) &&
    Array.isArray(value.seasons) &&
    value.seasons.every(isSeason)
  )
}

function isLeague(value: unknown): value is League {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isSeason(value: unknown): value is Season {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.leagueId) &&
    isString(value.name) &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeam) &&
    Array.isArray(value.matches) &&
    value.matches.every(isMatch) &&
    isIntegerInRange(value.legCount, 1, 4) &&
    Array.isArray(value.randomTiebreakerLocks) &&
    value.randomTiebreakerLocks.every(isRandomTiebreakerLock) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isTeam(value: unknown): value is Team {
  return isRecord(value) && isString(value.id) && isString(value.name)
}

function isMatch(value: unknown): value is Match {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isPositiveInteger(value.leg) &&
    isPositiveInteger(value.round) &&
    isString(value.homeTeamId) &&
    isString(value.awayTeamId) &&
    isNullableNonNegativeInteger(value.homeScore) &&
    isNullableNonNegativeInteger(value.awayScore) &&
    isNonNegativeInteger(value.homeYellowCards) &&
    isNonNegativeInteger(value.awayYellowCards) &&
    isNonNegativeInteger(value.homeRedCards) &&
    isNonNegativeInteger(value.awayRedCards)
  )
}

function isRandomTiebreakerLock(value: unknown): value is RandomTiebreakerLock {
  return (
    isRecord(value) &&
    isTableMode(value.mode) &&
    isStringArray(value.teamIds) &&
    isStringArray(value.orderedTeamIds)
  )
}

function isTableMode(value: unknown): value is TableMode {
  return value === 'overall' || value === 'home' || value === 'away'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value)
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  )
}

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    )
  }

  return (
    isRecord(error) &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

export const persistenceService = createPersistenceService()
