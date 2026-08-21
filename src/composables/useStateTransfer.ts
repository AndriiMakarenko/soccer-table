import { computed, shallowRef } from 'vue'

import {
  parseAppStateInterchange,
  serializeAppState,
  type ImportMode,
} from '@/domain/stateInterchange'
import {
  stateTransferFileAdapter,
  type StateTransferFileAdapter,
} from '@/services/stateTransferFiles'
import type { useAppStateStore } from '@/stores/appState'

type AppStateStore = ReturnType<typeof useAppStateStore>

export function useStateTransfer(
  store: AppStateStore,
  files: StateTransferFileAdapter = stateTransferFileAdapter,
) {
  const isPending = shallowRef(false)
  const selectedImport = shallowRef<string | null>(null)
  const message = shallowRef<string | null>(null)
  const isError = shallowRef(false)
  const skippedLeagueNames = shallowRef<string[]>([])
  const isImportChoiceVisible = shallowRef(false)
  const isReplaceConfirmationVisible = shallowRef(false)
  const controlsDisabled = computed(() => isPending.value || store.isSaving)

  function present(text: string, error = false, skipped: string[] = []) {
    message.value = text
    isError.value = error
    skippedLeagueNames.value = skipped
  }

  function clearMessage(): void {
    message.value = null
    isError.value = false
    skippedLeagueNames.value = []
  }

  async function beginImport(): Promise<void> {
    if (controlsDisabled.value) return
    isPending.value = true
    present('Selecting an import file…')
    try {
      selectedImport.value = await files.pickImportFile()
      if (selectedImport.value) {
        message.value = null
        isImportChoiceVisible.value = true
      } else message.value = null
    } catch (error) {
      present(
        error instanceof Error
          ? error.message
          : 'The import file could not be read.',
        true,
      )
    } finally {
      isPending.value = false
    }
  }

  function chooseImportMode(mode: ImportMode): void {
    isImportChoiceVisible.value = false
    if (mode === 'replace') isReplaceConfirmationVisible.value = true
    else void applyImport('merge', false)
  }

  async function applyImport(
    mode: ImportMode,
    confirmed: boolean,
  ): Promise<void> {
    const serialized = selectedImport.value
    if (!serialized) return
    isReplaceConfirmationVisible.value = false
    isPending.value = true
    present('Importing tournament data…')
    try {
      const state = parseAppStateInterchange(serialized)
      const result = await store.importState(state, mode, confirmed)
      present(result.message, !result.success, result.skippedLeagueNames)
    } catch (error) {
      present(
        error instanceof Error
          ? error.message
          : 'Tournament data could not be imported.',
        true,
      )
    } finally {
      selectedImport.value = null
      isPending.value = false
    }
  }

  function cancelImport(): void {
    selectedImport.value = null
    isImportChoiceVisible.value = false
    isReplaceConfirmationVisible.value = false
  }

  async function exportState(): Promise<void> {
    if (controlsDisabled.value) return
    isPending.value = true
    present('Preparing tournament data…')
    try {
      if (!(await store.waitForPendingSaves())) {
        throw new Error(
          'Finish resolving the current save error before exporting.',
        )
      }
      const saved = await files.saveExportFile(
        serializeAppState(store.exportState()),
      )
      message.value = saved ? 'Tournament data exported successfully.' : null
    } catch (error) {
      present(
        error instanceof Error
          ? error.message
          : 'Tournament data could not be exported.',
        true,
      )
    } finally {
      isPending.value = false
    }
  }

  return {
    isPending,
    controlsDisabled,
    message,
    isError,
    skippedLeagueNames,
    isImportChoiceVisible,
    isReplaceConfirmationVisible,
    beginImport,
    chooseImportMode,
    applyImport,
    cancelImport,
    clearMessage,
    exportState,
  }
}
