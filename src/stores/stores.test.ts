import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppState } from '@/domain/models'
import { persistenceService } from '@/services/storage'

import { useAppStateStore } from './appState'
import { useLeagueStore } from './league'
import { useSeasonStore } from './season'

describe('asynchronous application stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  /**
   * GIVEN persisted leagues, a related season, and an orphaned season
   * WHEN shared Pinia state hydrates asynchronously
   * THEN loading is explicit and inconsistent relationships are discarded
   */
  it('hydrates shared state and exposes loading status', async () => {
    const persisted = populatedState()
    persisted.seasons.push({
      ...persisted.seasons[0]!,
      id: 'orphan',
      leagueId: 'missing',
    })
    vi.spyOn(persistenceService, 'load').mockResolvedValue(persisted)
    const appState = useAppStateStore()
    const loading = appState.load()

    expect(appState.isLoading).toBe(true)
    await loading
    expect(appState.isLoading).toBe(false)
    expect(appState.isLoaded).toBe(true)
    expect(appState.seasons.map(({ id }) => id)).toEqual(['season-1'])
  })

  /**
   * GIVEN an empty hydrated store
   * WHEN league and season CRUD mutations complete successfully
   * THEN each accepted edit is persisted and relationships remain consistent
   */
  it('awaits CRUD persistence and cascade deletion', async () => {
    vi.spyOn(persistenceService, 'load').mockResolvedValue({
      leagues: [],
      seasons: [],
    })
    const save = vi
      .spyOn(persistenceService, 'save')
      .mockResolvedValue({ success: true })
    const leagues = useLeagueStore()
    const seasons = useSeasonStore()
    await useAppStateStore().load()

    const league = leagues.createLeague('Premier League')
    expect(league.success).toBe(true)
    if (!league.success) return
    await league.saveResult
    const season = seasons.createSeason({
      leagueId: league.value.id,
      name: '2026/27',
    })
    expect(season.success).toBe(true)
    if (!season.success) return
    await season.saveResult
    const deleted = leagues.deleteLeague(league.value.id)
    expect(deleted.success).toBe(true)
    if (!deleted.success) return
    await deleted.saveResult

    expect(leagues.leagues).toEqual([])
    expect(seasons.seasons).toEqual([])
    expect(save).toHaveBeenCalledTimes(3)
  })

  /**
   * GIVEN two accepted mutations whose native writes could finish at different speeds
   * WHEN both saves are requested without awaiting the first
   * THEN snapshots are written serially in mutation order
   */
  it('prevents overlapping writes from committing out of order', async () => {
    vi.spyOn(persistenceService, 'load').mockResolvedValue({
      leagues: [],
      seasons: [],
    })
    let releaseFirst!: () => void
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const snapshots: AppState[] = []
    vi.spyOn(persistenceService, 'save').mockImplementation(
      async (snapshot) => {
        snapshots.push(snapshot)
        if (snapshots.length === 1) await first
        return { success: true }
      },
    )
    const store = useLeagueStore()
    await useAppStateStore().load()

    const one = store.createLeague('One')
    const two = store.createLeague('Two')
    expect(one.success && two.success).toBe(true)
    await Promise.resolve()
    expect(snapshots).toHaveLength(1)
    releaseFirst()
    if (one.success) await one.saveResult
    if (two.success) await two.saveResult

    expect(
      snapshots.map((snapshot) => snapshot.leagues.map(({ name }) => name)),
    ).toEqual([['One'], ['One', 'Two']])
  })

  /**
   * GIVEN the desktop database rejects a write and later accepts a retry
   * WHEN the user retries pending in-memory state
   * THEN the edit is retained and explicit failure/success states are updated
   */
  it('retains failed edits and supports retry', async () => {
    vi.spyOn(persistenceService, 'load').mockResolvedValue({
      leagues: [],
      seasons: [],
    })
    const save = vi
      .spyOn(persistenceService, 'save')
      .mockResolvedValueOnce({
        success: false,
        reason: 'disk-full',
        message: 'Disk is full.',
      })
      .mockResolvedValueOnce({ success: true })
    const appState = useAppStateStore()
    const store = useLeagueStore()
    await appState.load()

    const result = store.createLeague('Premier League')
    expect(result.success).toBe(true)
    if (!result.success) return
    await expect(result.saveResult).resolves.toMatchObject({ success: false })
    expect(store.leagues).toHaveLength(1)
    expect(appState.saveError).toBe('Disk is full.')
    await expect(appState.persist()).resolves.toEqual({ success: true })
    expect(appState.lastSaveSucceeded).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
  })
})

function populatedState(): AppState {
  return {
    leagues: [
      {
        id: 'league-1',
        name: 'Premier League',
        createdAt: '2026-08-18T10:00:00.000Z',
        updatedAt: '2026-08-18T10:00:00.000Z',
      },
    ],
    seasons: [
      {
        id: 'season-1',
        leagueId: 'league-1',
        name: '2026/27',
        teams: [],
        matches: [],
        legCount: 1,
        randomTiebreakerLocks: [],
        createdAt: '2026-08-18T10:00:00.000Z',
        updatedAt: '2026-08-18T10:00:00.000Z',
      },
    ],
  }
}
