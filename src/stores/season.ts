import { defineStore } from 'pinia'
import { computed } from 'vue'

import { createId, createTimestamp } from '@/domain/identity'
import type { Season } from '@/domain/models'
import { validateLegCount, validateName } from '@/domain/validation'

import { useAppStateStore } from './appState'
import type { StoreMutationResult } from './types'

export interface CreateSeasonInput {
  leagueId: string
  name: unknown
  legCount?: unknown
}

export const useSeasonStore = defineStore('seasons', () => {
  const appState = useAppStateStore()

  const seasons = computed(() => appState.seasons)
  const isLoaded = computed(() => appState.isLoaded)
  const saveError = computed(() => appState.saveError)

  function load(): void {
    appState.load()
  }

  function seasonsForLeague(leagueId: string): Season[] {
    return appState.seasons.filter((season) => season.leagueId === leagueId)
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

  return {
    seasons,
    isLoaded,
    saveError,
    load,
    seasonsForLeague,
    createSeason,
    renameSeason,
    deleteSeason,
    clearSaveError: appState.clearSaveError,
  }
})

function notFound(message: string): StoreMutationResult<never> {
  return {
    success: false,
    reason: 'not-found',
    message,
  }
}
