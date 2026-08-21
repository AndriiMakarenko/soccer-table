import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppState } from '@/domain/models'
import { persistenceService } from '@/services/storage'

import { useAppStateStore } from './appState'

describe('application state import', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  /**
   * GIVEN existing data and a valid replacement import
   * WHEN replacement is not explicitly confirmed
   * THEN the operation is cancelled without changing or persisting state
   */
  it('cancels replacement unless it is explicitly confirmed', async () => {
    const current = state('current', 'Current')
    vi.spyOn(persistenceService, 'load').mockResolvedValue(current)
    const save = vi.spyOn(persistenceService, 'save')
    const store = useAppStateStore()
    await store.load()

    const result = await store.importState(
      state('imported', 'Imported'),
      'replace',
    )

    expect(result).toMatchObject({
      success: false,
      message: expect.stringContaining('cancelled'),
    })
    expect(store.leagues).toEqual(current.leagues)
    expect(save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN existing data and a valid replacement import
   * WHEN replacement is explicitly confirmed
   * THEN the complete state is replaced and persisted exactly once
   */
  it('atomically persists a confirmed replacement once', async () => {
    vi.spyOn(persistenceService, 'load').mockResolvedValue(
      state('current', 'Current'),
    )
    const save = vi
      .spyOn(persistenceService, 'save')
      .mockResolvedValue({ success: true })
    const store = useAppStateStore()
    await store.load()
    const imported = state('imported', 'Imported')

    const result = await store.importState(imported, 'replace', true)

    expect(result).toMatchObject({ success: true, skippedLeagueNames: [] })
    expect(store.leagues).toEqual(imported.leagues)
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(imported)
  })

  /**
   * GIVEN a valid import whose single persistence write fails
   * WHEN replacement is attempted
   * THEN prior in-memory state is restored with a structured failure result
   */
  it('restores prior state after an atomic persistence failure', async () => {
    const current = state('current', 'Current')
    vi.spyOn(persistenceService, 'load').mockResolvedValue(current)
    const save = vi.spyOn(persistenceService, 'save').mockResolvedValue({
      success: false,
      reason: 'storage-error',
      message: 'Write failed.',
    })
    const store = useAppStateStore()
    await store.load()

    const result = await store.importState(
      state('imported', 'Imported'),
      'replace',
      true,
    )

    expect(result).toMatchObject({
      success: false,
      message: expect.stringContaining('restored'),
    })
    expect(store.leagues).toEqual(current.leagues)
    expect(store.seasons).toEqual(current.seasons)
    expect(save).toHaveBeenCalledOnce()
  })
})

function state(id: string, name: string): AppState {
  return {
    leagues: [
      {
        id,
        name,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ],
    seasons: [],
  }
}
