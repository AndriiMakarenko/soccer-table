import { defineStore } from 'pinia'
import { computed } from 'vue'

import { createId, createTimestamp } from '@/domain/identity'
import type { League } from '@/domain/models'
import { validateName } from '@/domain/validation'

import { useAppStateStore } from './appState'
import type { StoreMutationResult } from './types'

export const useLeagueStore = defineStore('leagues', () => {
  const appState = useAppStateStore()

  const leagues = computed(() => appState.leagues)
  const isLoaded = computed(() => appState.isLoaded)
  const saveError = computed(() => appState.saveError)
  const isSaving = computed(() => appState.isSaving)

  function load(): void {
    appState.load()
  }

  function createLeague(name: unknown): StoreMutationResult<League> {
    const nameResult = validateName(name, 'League name')

    if (!nameResult.valid) {
      return {
        success: false,
        reason: 'validation',
        message: nameResult.error,
      }
    }

    const timestamp = createTimestamp()
    const league: League = {
      id: createId(),
      name: nameResult.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    appState.leagues.push(league)

    return {
      success: true,
      value: league,
      saveResult: appState.persist(),
    }
  }

  function renameLeague(
    leagueId: string,
    name: unknown,
  ): StoreMutationResult<League> {
    const league = appState.leagues.find((item) => item.id === leagueId)

    if (!league) {
      return notFound(`League ${leagueId} was not found`)
    }

    const nameResult = validateName(name, 'League name')

    if (!nameResult.valid) {
      return {
        success: false,
        reason: 'validation',
        message: nameResult.error,
      }
    }

    league.name = nameResult.value
    league.updatedAt = createTimestamp()

    return {
      success: true,
      value: league,
      saveResult: appState.persist(),
    }
  }

  function deleteLeague(leagueId: string): StoreMutationResult<League> {
    const leagueIndex = appState.leagues.findIndex(
      (league) => league.id === leagueId,
    )

    if (leagueIndex === -1) {
      return notFound(`League ${leagueId} was not found`)
    }

    const [deletedLeague] = appState.leagues.splice(leagueIndex, 1)

    appState.seasons = appState.seasons.filter(
      (season) => season.leagueId !== leagueId,
    )

    return {
      success: true,
      value: deletedLeague!,
      saveResult: appState.persist(),
    }
  }

  return {
    leagues,
    isLoaded,
    saveError,
    isSaving,
    load,
    createLeague,
    renameLeague,
    deleteLeague,
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
