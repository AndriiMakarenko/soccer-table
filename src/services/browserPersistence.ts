import type {
  AppState,
  League,
  Match,
  RandomTiebreakerLock,
  Season,
  TableMode,
  Team,
} from '@/domain/models'
import { createEmptyAppState } from '@/domain/models'

import type { PersistenceService } from './storage'

export const STORAGE_VERSION = 1
export const STORAGE_KEY = `round-robin-tournament-manager:v${STORAGE_VERSION}`
export const STORAGE_FULL_MESSAGE =
  'Could not save changes because browser storage is full. Please export or delete old leagues/seasons before continuing.'
export const STORAGE_SAVE_ERROR_MESSAGE =
  'Could not save changes to browser storage. Check that browser storage is enabled, then try again.'

interface StorageEnvelope {
  version: typeof STORAGE_VERSION
  state: AppState
}

export function createBrowserPersistenceAdapter(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PersistenceService {
  return {
    async load() {
      try {
        const serializedState = (storage ?? window.localStorage).getItem(
          STORAGE_KEY,
        )
        if (serializedState === null) return createEmptyAppState()

        const envelope: unknown = JSON.parse(serializedState)
        return isStorageEnvelope(envelope)
          ? clone(envelope.state)
          : createEmptyAppState()
      } catch {
        return createEmptyAppState()
      }
    },

    async save(state) {
      const envelope: StorageEnvelope = {
        version: STORAGE_VERSION,
        state,
      }

      try {
        ;(storage ?? window.localStorage).setItem(
          STORAGE_KEY,
          JSON.stringify(envelope),
        )
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
  return (
    isRecord(value) &&
    value.version === STORAGE_VERSION &&
    isAppState(value.state)
  )
}

function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['leagues', 'seasons']) &&
    Array.isArray(value.leagues) &&
    value.leagues.every(isLeague) &&
    Array.isArray(value.seasons) &&
    value.seasons.every(isSeason)
  )
}

function isLeague(value: unknown): value is League {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name', 'createdAt', 'updatedAt']) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isSeason(value: unknown): value is Season {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'id',
      'leagueId',
      'name',
      'teams',
      'matches',
      'legCount',
      'randomTiebreakerLocks',
      'createdAt',
      'updatedAt',
    ]) &&
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
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name']) &&
    isString(value.id) &&
    isString(value.name)
  )
}

function isMatch(value: unknown): value is Match {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'id',
      'leg',
      'round',
      'homeTeamId',
      'awayTeamId',
      'homeScore',
      'awayScore',
      'homeYellowCards',
      'awayYellowCards',
      'homeRedCards',
      'awayRedCards',
    ]) &&
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
    hasOnlyKeys(value, ['mode', 'teamIds', 'orderedTeamIds']) &&
    isTableMode(value.mode) &&
    isStringArray(value.teamIds) &&
    isStringArray(value.orderedTeamIds)
  )
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isTableMode(value: unknown): value is TableMode {
  return value === 'overall' || value === 'home' || value === 'away'
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
  return (
    isRecord(error) &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

function clone(state: AppState): AppState {
  return structuredClone(state)
}
