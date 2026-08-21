import { createId } from './identity'
import type {
  AppState,
  League,
  Match,
  RandomTiebreakerLock,
  Season,
  TableMode,
  Team,
} from './models'

export const INTERCHANGE_VERSION = 1

export interface StateInterchangeEnvelope {
  version: typeof INTERCHANGE_VERSION
  state: AppState
}

export type ImportMode = 'replace' | 'merge'

export interface ImportPlan {
  state: AppState
  importedLeagueNames: string[]
  skippedLeagueNames: string[]
}

export class StateInterchangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StateInterchangeError'
  }
}

export function serializeAppState(state: AppState): string {
  return JSON.stringify({ version: INTERCHANGE_VERSION, state }, null, 2)
}

export function parseAppStateInterchange(serialized: string): AppState {
  let value: unknown

  try {
    value = JSON.parse(serialized)
  } catch {
    throw new StateInterchangeError(
      'This file is not valid JSON. Select an exported tournament data file.',
    )
  }

  if (!isRecord(value) || !('version' in value)) {
    throw new StateInterchangeError(
      'This file is missing its interchange format version.',
    )
  }
  if (value.version !== INTERCHANGE_VERSION) {
    throw new StateInterchangeError(
      `Interchange version ${String(value.version)} is not supported. Expected version ${INTERCHANGE_VERSION}.`,
    )
  }
  if (!hasOnlyKeys(value, ['version', 'state']) || !isAppState(value.state)) {
    throw new StateInterchangeError(
      'The imported file has an invalid or incomplete tournament data structure.',
    )
  }

  const semanticError = validateRelationships(value.state)
  if (semanticError) throw new StateInterchangeError(semanticError)
  return structuredClone(value.state)
}

export function planAppStateImport(
  current: AppState,
  imported: AppState,
  mode: ImportMode,
  idFactory: () => string = createId,
): ImportPlan {
  if (mode === 'replace') {
    return {
      state: structuredClone(imported),
      importedLeagueNames: imported.leagues.map(({ name }) => name),
      skippedLeagueNames: [],
    }
  }

  const existingNames = new Set(current.leagues.map(normalizedLeagueName))
  const accepted = imported.leagues.filter(
    (league) => !existingNames.has(normalizedLeagueName(league)),
  )
  const skipped = imported.leagues.filter((league) =>
    existingNames.has(normalizedLeagueName(league)),
  )
  const state = structuredClone(current)
  const usedLeagueIds = new Set(state.leagues.map(({ id }) => id))
  const usedSeasonIds = new Set(state.seasons.map(({ id }) => id))
  const usedTeamIds = new Set(
    state.seasons.flatMap(({ teams }) => teams.map(({ id }) => id)),
  )
  const usedMatchIds = new Set(
    state.seasons.flatMap(({ matches }) => matches.map(({ id }) => id)),
  )

  for (const sourceLeague of accepted) {
    const leagueId = uniqueId(sourceLeague.id, usedLeagueIds, idFactory)
    state.leagues.push({ ...structuredClone(sourceLeague), id: leagueId })

    for (const sourceSeason of imported.seasons.filter(
      ({ leagueId: parentId }) => parentId === sourceLeague.id,
    )) {
      state.seasons.push(
        remapSeason(
          sourceSeason,
          leagueId,
          usedSeasonIds,
          usedTeamIds,
          usedMatchIds,
          idFactory,
        ),
      )
    }
  }

  return {
    state,
    importedLeagueNames: accepted.map(({ name }) => name),
    skippedLeagueNames: skipped.map(({ name }) => name),
  }
}

function remapSeason(
  season: Season,
  leagueId: string,
  usedSeasonIds: Set<string>,
  usedTeamIds: Set<string>,
  usedMatchIds: Set<string>,
  idFactory: () => string,
): Season {
  const seasonId = uniqueId(season.id, usedSeasonIds, idFactory)
  const teamIds = new Map<string, string>()
  const teams = season.teams.map((team) => {
    const id = uniqueId(team.id, usedTeamIds, idFactory)
    teamIds.set(team.id, id)
    return { ...team, id }
  })
  const mapTeamId = (id: string) => teamIds.get(id)!

  return {
    ...structuredClone(season),
    id: seasonId,
    leagueId,
    teams,
    matches: season.matches.map((match) => ({
      ...match,
      id: uniqueId(match.id, usedMatchIds, idFactory),
      homeTeamId: mapTeamId(match.homeTeamId),
      awayTeamId: mapTeamId(match.awayTeamId),
    })),
    randomTiebreakerLocks: season.randomTiebreakerLocks.map((lock) => ({
      ...lock,
      teamIds: lock.teamIds.map(mapTeamId),
      orderedTeamIds: lock.orderedTeamIds.map(mapTeamId),
    })),
  }
}

function uniqueId(
  preferred: string,
  used: Set<string>,
  idFactory: () => string,
): string {
  let candidate = preferred
  while (used.has(candidate)) candidate = idFactory()
  used.add(candidate)
  return candidate
}

function validateRelationships(state: AppState): string | null {
  const leagueIds = new Set<string>()
  const seasonIds = new Set<string>()
  const teamIds = new Set<string>()
  const matchIds = new Set<string>()

  for (const league of state.leagues) {
    if (leagueIds.has(league.id))
      return `League identifier "${league.id}" is duplicated.`
    leagueIds.add(league.id)
  }

  for (const season of state.seasons) {
    if (seasonIds.has(season.id))
      return `Season identifier "${season.id}" is duplicated.`
    seasonIds.add(season.id)
    if (!leagueIds.has(season.leagueId)) {
      return `Season "${season.name}" refers to a league that is not in the file.`
    }

    const seasonTeamIds = new Set<string>()
    const teamNames = new Set<string>()
    for (const team of season.teams) {
      if (teamIds.has(team.id))
        return `Team identifier "${team.id}" is duplicated.`
      if (teamNames.has(team.name))
        return `Team name "${team.name}" is duplicated in season "${season.name}".`
      teamIds.add(team.id)
      seasonTeamIds.add(team.id)
      teamNames.add(team.name)
    }

    for (const match of season.matches) {
      if (matchIds.has(match.id))
        return `Fixture identifier "${match.id}" is duplicated.`
      matchIds.add(match.id)
      if (match.leg > season.legCount)
        return `Fixture "${match.id}" has a leg outside its season.`
      if (
        match.homeTeamId === match.awayTeamId ||
        !seasonTeamIds.has(match.homeTeamId) ||
        !seasonTeamIds.has(match.awayTeamId)
      ) {
        return `Fixture "${match.id}" has an invalid team relationship.`
      }
    }

    for (const lock of season.randomTiebreakerLocks) {
      const teamSet = new Set(lock.teamIds)
      const orderedSet = new Set(lock.orderedTeamIds)
      if (
        teamSet.size !== lock.teamIds.length ||
        orderedSet.size !== lock.orderedTeamIds.length ||
        teamSet.size !== orderedSet.size ||
        [...teamSet].some((id) => !seasonTeamIds.has(id) || !orderedSet.has(id))
      ) {
        return `Season "${season.name}" has an invalid random tiebreaker lock.`
      }
    }
  }
  return null
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
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
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
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.leagueId) &&
    isNonEmptyString(value.name) &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeam) &&
    Array.isArray(value.matches) &&
    value.matches.every(isMatch) &&
    isIntegerInRange(value.legCount, 1, 4) &&
    Array.isArray(value.randomTiebreakerLocks) &&
    value.randomTiebreakerLocks.every(isRandomTiebreakerLock) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isTeam(value: unknown): value is Team {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
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
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.leg) &&
    isPositiveInteger(value.round) &&
    isNonEmptyString(value.homeTeamId) &&
    isNonEmptyString(value.awayTeamId) &&
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

function normalizedLeagueName({ name }: League): string {
  return name.trim().toLocaleLowerCase()
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
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
