import { defineStore } from 'pinia'
import { computed } from 'vue'

import { generateRoundRobinFixtures } from '@/domain/fixtures'
import { createId, createTimestamp } from '@/domain/identity'
import type { Match, Season, Team } from '@/domain/models'
import { calculateSeasonStandings } from '@/domain/seasonStandings'
import {
  validateCardCount,
  validateLegCount,
  validateName,
  validateScore,
  validateTeamCount,
  type ValidationResult,
} from '@/domain/validation'
import type { SaveResult } from '@/services/storage'

import { useAppStateStore } from './appState'
import type { StoreMutationResult } from './types'

export interface CreateSeasonInput {
  leagueId: string
  name: unknown
  legCount?: unknown
}

export interface CreateSeasonWithFixturesInput extends CreateSeasonInput {
  teamInput: unknown
}

export interface MatchResultInput {
  homeScore?: unknown
  awayScore?: unknown
  homeYellowCards?: unknown
  awayYellowCards?: unknown
  homeRedCards?: unknown
  awayRedCards?: unknown
}

export interface RoundMatchResultInput {
  matchId: string
  result: MatchResultInput
}

export interface RegenerateFixturesInput {
  legCount?: unknown
  teamInput?: unknown
  confirmResultDeletion?: boolean
}

export function parseBulkTeamInput(input: unknown): ValidationResult<string[]> {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Team names must be entered as text' }
  }

  const names = input
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  const teamCountResult = validateTeamCount(names.length)

  if (!teamCountResult.valid) {
    return teamCountResult
  }

  const normalizedNames = new Set<string>()
  const duplicateNames = new Set<string>()

  for (const name of names) {
    const normalizedName = name.toLocaleLowerCase()
    if (normalizedNames.has(normalizedName)) duplicateNames.add(name)
    normalizedNames.add(normalizedName)
  }

  if (duplicateNames.size > 0) {
    return {
      valid: false,
      error: `Duplicate team names are not allowed: ${[...duplicateNames].join(', ')}`,
    }
  }

  return { valid: true, value: names }
}

export const useSeasonStore = defineStore('seasons', () => {
  const appState = useAppStateStore()

  const seasons = computed(() => appState.seasons)
  const isLoaded = computed(() => appState.isLoaded)
  const saveError = computed(() => appState.saveError)
  const isSaving = computed(() => appState.isSaving)

  function load(): void {
    appState.load()
  }

  function seasonsForLeague(leagueId: string): Season[] {
    return appState.seasons.filter((season) => season.leagueId === leagueId)
  }

  function seasonById(seasonId: string): Season | undefined {
    return appState.seasons.find((season) => season.id === seasonId)
  }

  function createSeason(input: CreateSeasonInput): StoreMutationResult<Season> {
    const leagueExists = appState.leagues.some(
      (league) => league.id === input.leagueId,
    )

    if (!leagueExists) {
      return notFound(`League ${input.leagueId} was not found`)
    }

    const nameResult = validateName(input.name, 'Season name')

    if (!nameResult.valid) {
      return {
        success: false,
        reason: 'validation',
        message: nameResult.error,
      }
    }

    const legCountResult = validateLegCount(input.legCount ?? 1)

    if (!legCountResult.valid) {
      return {
        success: false,
        reason: 'validation',
        message: legCountResult.error,
      }
    }

    const timestamp = createTimestamp()
    const season: Season = {
      id: createId(),
      leagueId: input.leagueId,
      name: nameResult.value,
      teams: [],
      matches: [],
      legCount: legCountResult.value,
      randomTiebreakerLocks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    appState.seasons.push(season)

    return {
      success: true,
      value: season,
      saveResult: appState.persist(),
    }
  }

  function createSeasonWithFixtures(
    input: CreateSeasonWithFixturesInput,
  ): StoreMutationResult<Season> {
    const leagueExists = appState.leagues.some(
      (league) => league.id === input.leagueId,
    )

    if (!leagueExists) {
      return notFound(`League ${input.leagueId} was not found`)
    }

    const nameResult = validateName(input.name, 'Season name')
    if (!nameResult.valid) return validationFailure(nameResult.error)

    const namesResult = parseBulkTeamInput(input.teamInput)
    if (!namesResult.valid) return validationFailure(namesResult.error)

    const legCountResult = validateLegCount(input.legCount ?? 1)
    if (!legCountResult.valid) return validationFailure(legCountResult.error)

    const timestamp = createTimestamp()
    const teams = namesResult.value.map((name) => ({ id: createId(), name }))
    const season: Season = {
      id: createId(),
      leagueId: input.leagueId,
      name: nameResult.value,
      teams,
      matches: generateRoundRobinFixtures(teams, legCountResult.value),
      legCount: legCountResult.value,
      randomTiebreakerLocks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    appState.seasons.push(season)

    return persisted(season)
  }

  function renameSeason(
    seasonId: string,
    name: unknown,
  ): StoreMutationResult<Season> {
    const season = appState.seasons.find((item) => item.id === seasonId)

    if (!season) {
      return notFound(`Season ${seasonId} was not found`)
    }

    const nameResult = validateName(name, 'Season name')

    if (!nameResult.valid) {
      return {
        success: false,
        reason: 'validation',
        message: nameResult.error,
      }
    }

    season.name = nameResult.value
    season.updatedAt = createTimestamp()

    return {
      success: true,
      value: season,
      saveResult: appState.persist(),
    }
  }

  function deleteSeason(seasonId: string): StoreMutationResult<Season> {
    const seasonIndex = appState.seasons.findIndex(
      (season) => season.id === seasonId,
    )

    if (seasonIndex === -1) {
      return notFound(`Season ${seasonId} was not found`)
    }

    const [deletedSeason] = appState.seasons.splice(seasonIndex, 1)

    return {
      success: true,
      value: deletedSeason!,
      saveResult: appState.persist(),
    }
  }

  function setTeamsFromBulkInput(
    seasonId: string,
    input: unknown,
  ): StoreMutationResult<Team[]> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)
    if (season.matches.length > 0) {
      return failure(
        'locked',
        'Teams cannot be edited after fixtures have been generated',
      )
    }

    const namesResult = parseBulkTeamInput(input)
    if (!namesResult.valid) return validationFailure(namesResult.error)

    season.teams = namesResult.value.map((name) => ({ id: createId(), name }))
    season.randomTiebreakerLocks = []
    touch(season)

    return persisted(season.teams)
  }

  function generateFixtures(
    seasonId: string,
    legCount: unknown,
  ): StoreMutationResult<Season> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)
    if (season.matches.length > 0) {
      return failure(
        'locked',
        'Fixtures already exist; use regeneration to replace them',
      )
    }

    const legCountResult = validateLegCount(legCount)
    if (!legCountResult.valid) return validationFailure(legCountResult.error)
    const teamCountResult = validateTeamCount(season.teams.length)
    if (!teamCountResult.valid) return validationFailure(teamCountResult.error)

    season.legCount = legCountResult.value
    season.matches = generateRoundRobinFixtures(
      season.teams,
      legCountResult.value,
    )
    season.randomTiebreakerLocks = []
    touch(season)

    return persisted(season)
  }

  function updateMatchResult(
    seasonId: string,
    matchId: string,
    input: MatchResultInput,
  ): StoreMutationResult<Match> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)
    const match = season.matches.find((candidate) => candidate.id === matchId)
    if (!match) return notFound(`Match ${matchId} was not found`)

    const validatedInput = validateMatchResultInput(input)
    if (!validatedInput.valid) return validationFailure(validatedInput.error)

    Object.assign(match, validatedInput.value)
    reconcileRandomTiebreakers(season)
    touch(season)

    return persisted(match)
  }

  function updateRoundResults(
    seasonId: string,
    updates: RoundMatchResultInput[],
  ): StoreMutationResult<Match[]> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)

    const validatedUpdates: Array<{
      match: Match
      result: ValidatedMatchResultInput
    }> = []

    for (const update of updates) {
      const match = season.matches.find(
        (candidate) => candidate.id === update.matchId,
      )
      if (!match) return notFound(`Match ${update.matchId} was not found`)

      const result = validateMatchResultInput(update.result)
      if (!result.valid) return validationFailure(result.error)
      validatedUpdates.push({ match, result: result.value })
    }

    for (const update of validatedUpdates) {
      Object.assign(update.match, update.result)
    }

    reconcileRandomTiebreakers(season)
    touch(season)

    return persisted(validatedUpdates.map((update) => update.match))
  }

  function resetAllResults(seasonId: string): StoreMutationResult<Season> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)

    season.matches.forEach(clearMatchResult)
    season.randomTiebreakerLocks = []
    touch(season)

    return persisted(season)
  }

  function regenerateFixtures(
    seasonId: string,
    input: RegenerateFixturesInput = {},
  ): StoreMutationResult<Season> {
    const season = seasonById(seasonId)

    if (!season) return notFound(`Season ${seasonId} was not found`)
    if (hasRecordedResults(season) && input.confirmResultDeletion !== true) {
      return failure(
        'confirmation-required',
        'Regenerating fixtures will delete existing results and requires confirmation',
      )
    }

    const legCountResult = validateLegCount(input.legCount ?? season.legCount)
    if (!legCountResult.valid) return validationFailure(legCountResult.error)

    let teams = season.teams
    if (input.teamInput !== undefined) {
      const namesResult = parseBulkTeamInput(input.teamInput)
      if (!namesResult.valid) return validationFailure(namesResult.error)
      teams = namesResult.value.map((name) => ({ id: createId(), name }))
    }

    const teamCountResult = validateTeamCount(teams.length)
    if (!teamCountResult.valid) return validationFailure(teamCountResult.error)

    season.teams = teams
    season.legCount = legCountResult.value
    season.matches = generateRoundRobinFixtures(teams, legCountResult.value)
    season.randomTiebreakerLocks = []
    touch(season)

    return persisted(season)
  }

  function persisted<T>(value: T): StoreMutationResult<T> {
    return { success: true, value, saveResult: appState.persist() }
  }

  function savePendingChanges(): Promise<SaveResult> {
    return appState.persist()
  }

  return {
    seasons,
    isLoaded,
    saveError,
    isSaving,
    load,
    seasonsForLeague,
    seasonById,
    createSeason,
    createSeasonWithFixtures,
    renameSeason,
    deleteSeason,
    setTeamsFromBulkInput,
    generateFixtures,
    updateMatchResult,
    updateRoundResults,
    resetAllResults,
    regenerateFixtures,
    savePendingChanges,
    clearSaveError: appState.clearSaveError,
  }
})

type ValidatedMatchResultInput = Partial<
  Pick<
    Match,
    | 'homeScore'
    | 'awayScore'
    | 'homeYellowCards'
    | 'awayYellowCards'
    | 'homeRedCards'
    | 'awayRedCards'
  >
>

function validateMatchResultInput(
  input: MatchResultInput,
): ValidationResult<ValidatedMatchResultInput> {
  const fields: Array<{
    key: keyof MatchResultInput
    label: string
    validate: typeof validateScore | typeof validateCardCount
  }> = [
    { key: 'homeScore', label: 'Home score', validate: validateScore },
    { key: 'awayScore', label: 'Away score', validate: validateScore },
    {
      key: 'homeYellowCards',
      label: 'Home yellow cards',
      validate: validateCardCount,
    },
    {
      key: 'awayYellowCards',
      label: 'Away yellow cards',
      validate: validateCardCount,
    },
    {
      key: 'homeRedCards',
      label: 'Home red cards',
      validate: validateCardCount,
    },
    {
      key: 'awayRedCards',
      label: 'Away red cards',
      validate: validateCardCount,
    },
  ]
  const result: Record<string, number | null> = {}

  for (const field of fields) {
    if (!(field.key in input)) continue
    const validation = field.validate(input[field.key], field.label)
    if (!validation.valid) return validation
    result[field.key] = validation.value
  }

  return { valid: true, value: result }
}

function clearMatchResult(match: Match): void {
  match.homeScore = null
  match.awayScore = null
  match.homeYellowCards = 0
  match.awayYellowCards = 0
  match.homeRedCards = 0
  match.awayRedCards = 0
}

function hasRecordedResults(season: Season): boolean {
  return season.matches.some(
    (match) =>
      match.homeScore !== null ||
      match.awayScore !== null ||
      match.homeYellowCards > 0 ||
      match.awayYellowCards > 0 ||
      match.homeRedCards > 0 ||
      match.awayRedCards > 0,
  )
}

function reconcileRandomTiebreakers(season: Season): void {
  season.randomTiebreakerLocks =
    calculateSeasonStandings(season).randomTiebreakerLocks
}

function touch(season: Season): void {
  season.updatedAt = createTimestamp()
}

function validationFailure(message: string): StoreMutationResult<never> {
  return failure('validation', message)
}

function failure(
  reason: 'validation' | 'locked' | 'confirmation-required',
  message: string,
): StoreMutationResult<never> {
  return { success: false, reason, message }
}

function notFound(message: string): StoreMutationResult<never> {
  return {
    success: false,
    reason: 'not-found',
    message,
  }
}
