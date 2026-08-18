import { invoke } from '@tauri-apps/api/core'

import type { AppState, Match } from '@/domain/models'

export interface RoundResultUpdate {
  matchId: string
  homeScore: number | null
  awayScore: number | null
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
}

export interface UpdateRoundResultsRequest {
  seasonId: string
  leg: number
  round: number
  updates: RoundResultUpdate[]
}

export interface CommandSuccess {
  success: true
}

export type PersistenceErrorCode =
  | 'validation'
  | 'constraint'
  | 'busy'
  | 'disk-full'
  | 'permission-denied'
  | 'corrupt'
  | 'io'
  | 'not-found'
  | 'unexpected'
  | 'bridge-unavailable'
  | 'native-exception'

export class NativePersistenceError extends Error {
  readonly code: PersistenceErrorCode

  constructor(code: PersistenceErrorCode, message: string) {
    super(message)
    this.name = 'NativePersistenceError'
    this.code = code
  }
}

export interface NativePersistenceService {
  load(): Promise<AppState>
  persist(state: AppState): Promise<CommandSuccess>
  deleteLeague(leagueId: string): Promise<CommandSuccess>
  deleteSeason(seasonId: string): Promise<CommandSuccess>
  regenerateFixtures(
    seasonId: string,
    matches: Match[],
  ): Promise<CommandSuccess>
  updateRoundResults(
    request: UpdateRoundResultsRequest,
  ): Promise<CommandSuccess>
  resetResults(seasonId: string): Promise<CommandSuccess>
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

const errorCodes = new Set<PersistenceErrorCode>([
  'validation',
  'constraint',
  'busy',
  'disk-full',
  'permission-denied',
  'corrupt',
  'io',
  'not-found',
  'unexpected',
])

export function createNativePersistenceService(
  invokeCommand: Invoke = invoke,
): NativePersistenceService {
  async function call<T>(command: string, request?: object): Promise<T> {
    try {
      return await invokeCommand<T>(
        command,
        request === undefined ? undefined : { request },
      )
    } catch (error) {
      throw normalizeInvokeError(error)
    }
  }

  return {
    load: () => call<AppState>('load_app_state'),
    persist: (state) => call('persist_app_state', { state }),
    deleteLeague: (leagueId) => call('delete_league', { id: leagueId }),
    deleteSeason: (seasonId) => call('delete_season', { id: seasonId }),
    regenerateFixtures: (seasonId, matches) =>
      call('regenerate_fixtures', { seasonId, matches }),
    updateRoundResults: (request) => call('update_round_results', request),
    resetResults: (seasonId) => call('reset_results', { id: seasonId }),
  }
}

function normalizeInvokeError(error: unknown): NativePersistenceError {
  if (isRecord(error) && isPersistenceErrorCode(error.code)) {
    return new NativePersistenceError(
      error.code,
      typeof error.message === 'string'
        ? error.message
        : 'The native persistence operation failed.',
    )
  }

  const message = error instanceof Error ? error.message : String(error)
  if (
    /command .* not found|unknown command|not available|__TAURI__/i.test(
      message,
    )
  ) {
    return new NativePersistenceError(
      'bridge-unavailable',
      'The desktop persistence bridge is unavailable. Launch the application through Tauri.',
    )
  }

  return new NativePersistenceError(
    'native-exception',
    'The desktop host could not complete the persistence operation. Try again.',
  )
}

function isPersistenceErrorCode(value: unknown): value is PersistenceErrorCode {
  return (
    typeof value === 'string' && errorCodes.has(value as PersistenceErrorCode)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const nativePersistenceService = createNativePersistenceService()
