import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { AppState, League, Season } from '@/domain/models'
import { planAppStateImport, type ImportMode } from '@/domain/stateInterchange'
import {
  persistenceBackend,
  persistenceService,
  type SaveResult,
} from '@/services/storage'
import {
  NativePersistenceError,
  type PersistenceErrorCode,
} from '@/services/tauriPersistence'

export const useAppStateStore = defineStore('app-state', () => {
  const leagues = ref<League[]>([])
  const seasons = ref<Season[]>([])
  const isLoaded = shallowRef(false)
  const isLoading = shallowRef(false)
  const pendingSaves = shallowRef(0)
  const isSaving = computed(() => pendingSaves.value > 0)
  const lastSaveSucceeded = shallowRef<boolean | null>(null)
  const saveError = shallowRef<string | null>(null)
  const startupError = shallowRef<string | null>(null)
  const startupErrorCode = shallowRef<PersistenceErrorCode | null>(null)
  let writeQueue = Promise.resolve()

  async function load(): Promise<void> {
    if (isLoading.value || isLoaded.value) return
    isLoading.value = true
    startupError.value = null
    startupErrorCode.value = null
    try {
      const persistedState = await persistenceService.load()
      const leagueIds = new Set(
        persistedState.leagues.map((league) => league.id),
      )

      leagues.value = persistedState.leagues
      seasons.value = persistedState.seasons.filter((season) =>
        leagueIds.has(season.leagueId),
      )
      isLoaded.value = true
      saveError.value = null
    } catch (error) {
      startupError.value =
        error instanceof Error
          ? error.message
          : persistenceBackend === 'tauri'
            ? 'The desktop database could not be loaded.'
            : 'Browser storage could not be loaded.'
      startupErrorCode.value =
        error instanceof NativePersistenceError ? error.code : 'unexpected'
    } finally {
      isLoading.value = false
    }
  }

  function persist(): Promise<SaveResult> {
    const snapshot = JSON.parse(
      JSON.stringify({ leagues: leagues.value, seasons: seasons.value }),
    ) as AppState
    pendingSaves.value += 1
    lastSaveSucceeded.value = null

    const operation = writeQueue.then(() => persistenceService.save(snapshot))
    writeQueue = operation.then(
      () => undefined,
      () => undefined,
    )

    return operation
      .catch((): SaveResult => ({
        success: false,
        reason: 'native-exception',
        message:
          persistenceBackend === 'tauri'
            ? 'Could not save changes to the desktop database. Please try again.'
            : 'Could not save changes to browser storage. Please try again.',
      }))
      .then((result) => {
        saveError.value = result.success ? null : result.message
        lastSaveSucceeded.value = result.success
        return result
      })
      .finally(() => {
        pendingSaves.value -= 1
      })
  }

  function clearSaveError(): void {
    saveError.value = null
  }

  async function waitForPendingSaves(): Promise<boolean> {
    await writeQueue
    return pendingSaves.value === 0 && saveError.value === null
  }

  function exportState(): AppState {
    return JSON.parse(
      JSON.stringify({ leagues: leagues.value, seasons: seasons.value }),
    ) as AppState
  }

  interface ImportResult {
    success: boolean
    importedLeagueNames: string[]
    skippedLeagueNames: string[]
    message: string
  }

  async function importState(
    importedState: AppState,
    mode: ImportMode,
    replacementConfirmed = false,
  ): Promise<ImportResult> {
    if (mode === 'replace' && !replacementConfirmed) {
      return {
        success: false,
        importedLeagueNames: [],
        skippedLeagueNames: [],
        message: 'Replacement was cancelled. No tournament data was changed.',
      }
    }

    await writeQueue
    const previous = JSON.parse(
      JSON.stringify({ leagues: leagues.value, seasons: seasons.value }),
    ) as AppState
    const plan = planAppStateImport(previous, importedState, mode)
    leagues.value = plan.state.leagues
    seasons.value = plan.state.seasons
    const saveResult = await persist()

    if (!saveResult.success) {
      leagues.value = previous.leagues
      seasons.value = previous.seasons
      return {
        success: false,
        importedLeagueNames: [],
        skippedLeagueNames: [],
        message: `${saveResult.message} The previous tournament data was restored.`,
      }
    }

    return {
      success: true,
      importedLeagueNames: plan.importedLeagueNames,
      skippedLeagueNames: plan.skippedLeagueNames,
      message:
        plan.skippedLeagueNames.length === 0
          ? 'Tournament data imported successfully.'
          : `${plan.importedLeagueNames.length} league(s) imported; ${plan.skippedLeagueNames.length} league(s) skipped because their names already exist.`,
    }
  }

  return {
    leagues,
    seasons,
    isLoaded,
    isLoading,
    isSaving,
    lastSaveSucceeded,
    saveError,
    startupError,
    startupErrorCode,
    load,
    persist,
    waitForPendingSaves,
    exportState,
    importState,
    clearSaveError,
  }
})
