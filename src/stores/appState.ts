import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { AppState, League, Season } from '@/domain/models'
import { persistenceService, type SaveResult } from '@/services/storage'

export const useAppStateStore = defineStore('app-state', () => {
  const leagues = ref<League[]>([])
  const seasons = ref<Season[]>([])
  const isLoaded = shallowRef(false)
  const saveError = shallowRef<string | null>(null)

  function load(): void {
    const persistedState = persistenceService.load()
    const leagueIds = new Set(persistedState.leagues.map((league) => league.id))

    leagues.value = persistedState.leagues
    seasons.value = persistedState.seasons.filter((season) =>
      leagueIds.has(season.leagueId),
    )
    isLoaded.value = true
    saveError.value = null
  }

  function persist(): SaveResult {
    const state: AppState = {
      leagues: leagues.value,
      seasons: seasons.value,
    }
    const result = persistenceService.save(state)

    saveError.value = result.success ? null : result.message

    return result
  }

  function clearSaveError(): void {
    saveError.value = null
  }

  return {
    leagues,
    seasons,
    isLoaded,
    saveError,
    load,
    persist,
    clearSaveError,
  }
})
