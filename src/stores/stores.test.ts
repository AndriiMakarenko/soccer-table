import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppState, League, Season } from '@/domain/models'
import { persistenceService, STORAGE_FULL_MESSAGE } from '@/services/storage'

import { useLeagueStore } from './league'
import { useSeasonStore } from './season'

describe('league and season stores', () => {
  let persistedState: AppState

  beforeEach(() => {
    persistedState = { leagues: [], seasons: [] }
    vi.spyOn(persistenceService, 'load').mockImplementation(() =>
      cloneState(persistedState),
    )
    vi.spyOn(persistenceService, 'save').mockImplementation((state) => {
      persistedState = cloneState(state)
      return { success: true }
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /**
   * GIVEN persisted leagues, related seasons, and an orphaned season
   * WHEN either CRUD store loads the shared application state
   * THEN both stores are hydrated and only consistent relationships are kept
   */
  it('loads league and season state while removing orphaned relationships', () => {
    const state = createPopulatedState()
    state.seasons.push(createSeason({ id: 'orphan', leagueId: 'missing' }))
    persistedState = state

    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    seasonStore.load()

    expect(leagueStore.isLoaded).toBe(true)
    expect(seasonStore.isLoaded).toBe(true)
    expect(leagueStore.leagues).toEqual(state.leagues)
    expect(seasonStore.seasons).toEqual([state.seasons[0]])
  })

  /**
   * GIVEN a loaded empty application state
   * WHEN a league is created, renamed, and deleted
   * THEN every mutation is persisted and deleting the league removes its seasons
   */
  it('creates, renames, and cascade-deletes leagues', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T10:00:00.000Z'))
    const saveSpy = vi.mocked(persistenceService.save)
    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    leagueStore.load()

    const created = leagueStore.createLeague('  Premier League  ')
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(created.value).toMatchObject({
      name: 'Premier League',
      createdAt: '2026-07-13T10:00:00.000Z',
      updatedAt: '2026-07-13T10:00:00.000Z',
    })

    const season = seasonStore.createSeason({
      leagueId: created.value.id,
      name: '2026/27',
    })
    expect(season.success).toBe(true)

    vi.setSystemTime(new Date('2026-07-13T11:00:00.000Z'))
    const renamed = leagueStore.renameLeague(created.value.id, 'Championship')
    expect(renamed).toMatchObject({
      success: true,
      value: {
        name: 'Championship',
        updatedAt: '2026-07-13T11:00:00.000Z',
      },
    })

    expect(leagueStore.deleteLeague(created.value.id).success).toBe(true)
    expect(leagueStore.leagues).toEqual([])
    expect(seasonStore.seasons).toEqual([])
    expect(saveSpy).toHaveBeenCalledTimes(4)
  })

  /**
   * GIVEN an existing league
   * WHEN its seasons are created, listed, renamed, and deleted
   * THEN CRUD preserves the league relationship and persists each accepted change
   */
  it('manages seasons only within existing leagues', () => {
    const saveSpy = vi.mocked(persistenceService.save)
    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    leagueStore.load()
    const leagueResult = leagueStore.createLeague('Premier League')
    expect(leagueResult.success).toBe(true)
    if (!leagueResult.success) return

    const missingLeagueResult = seasonStore.createSeason({
      leagueId: 'missing',
      name: 'Invalid season',
    })
    expect(missingLeagueResult).toEqual({
      success: false,
      reason: 'not-found',
      message: 'League missing was not found',
    })

    const created = seasonStore.createSeason({
      leagueId: leagueResult.value.id,
      name: '  2026/27  ',
      legCount: 2,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(created.value).toMatchObject({
      leagueId: leagueResult.value.id,
      name: '2026/27',
      teams: [],
      matches: [],
      legCount: 2,
      randomTiebreakerLocks: [],
    })
    expect(seasonStore.seasonsForLeague(leagueResult.value.id)).toEqual([
      created.value,
    ])
    expect(seasonStore.renameSeason(created.value.id, '2027/28')).toMatchObject(
      {
        success: true,
        value: { name: '2027/28' },
      },
    )
    expect(seasonStore.deleteSeason(created.value.id).success).toBe(true)
    expect(seasonStore.seasonsForLeague(leagueResult.value.id)).toEqual([])
    expect(saveSpy).toHaveBeenCalledTimes(4)
  })

  /**
   * GIVEN invalid names, invalid leg counts, and unknown entity identifiers
   * WHEN CRUD mutations are requested
   * THEN validation or not-found failures are returned without saving
   */
  it('rejects invalid CRUD mutations without persisting them', () => {
    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    leagueStore.load()
    const leagueResult = leagueStore.createLeague('Premier League')
    expect(leagueResult.success).toBe(true)
    if (!leagueResult.success) return
    const saveSpy = vi.mocked(persistenceService.save)
    saveSpy.mockClear()

    expect(leagueStore.createLeague('  ')).toMatchObject({
      success: false,
      reason: 'validation',
    })
    expect(leagueStore.renameLeague('missing', 'New name')).toMatchObject({
      success: false,
      reason: 'not-found',
    })
    expect(
      seasonStore.createSeason({
        leagueId: leagueResult.value.id,
        name: 'Season',
        legCount: 5,
      }),
    ).toMatchObject({ success: false, reason: 'validation' })
    expect(seasonStore.renameSeason('missing', 'New name')).toMatchObject({
      success: false,
      reason: 'not-found',
    })
    expect(seasonStore.deleteSeason('missing')).toMatchObject({
      success: false,
      reason: 'not-found',
    })
    expect(saveSpy).not.toHaveBeenCalled()
  })

  /**
   * GIVEN league and season changes were saved in one Pinia instance
   * WHEN fresh stores load after an application-style reload
   * THEN the persisted entities and their relationship are restored
   */
  it('restores persisted CRUD state in fresh store instances', () => {
    const firstLeagueStore = useLeagueStore()
    firstLeagueStore.load()
    const leagueResult = firstLeagueStore.createLeague('Premier League')
    expect(leagueResult.success).toBe(true)
    if (!leagueResult.success) return

    const firstSeasonStore = useSeasonStore()
    const seasonResult = firstSeasonStore.createSeason({
      leagueId: leagueResult.value.id,
      name: '2026/27',
      legCount: 2,
    })
    expect(seasonResult.success).toBe(true)
    if (!seasonResult.success) return

    setActivePinia(createPinia())
    const reloadedLeagueStore = useLeagueStore()
    const reloadedSeasonStore = useSeasonStore()
    reloadedLeagueStore.load()

    expect(reloadedLeagueStore.leagues).toEqual([leagueResult.value])
    expect(reloadedSeasonStore.seasons).toEqual([seasonResult.value])
  })

  /**
   * GIVEN browser persistence rejects a valid mutation
   * WHEN a league is created
   * THEN the mutation remains in memory and the failure is exposed to both stores
   */
  it('retains mutations in memory and exposes persistence failures', () => {
    vi.mocked(persistenceService.save).mockReturnValue({
      success: false,
      reason: 'quota-exceeded',
      message: STORAGE_FULL_MESSAGE,
    })
    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    leagueStore.load()

    const result = leagueStore.createLeague('Premier League')

    expect(result).toMatchObject({
      success: true,
      value: { name: 'Premier League' },
      saveResult: {
        success: false,
        reason: 'quota-exceeded',
        message: STORAGE_FULL_MESSAGE,
      },
    })
    expect(leagueStore.leagues).toHaveLength(1)
    expect(leagueStore.saveError).toBe(STORAGE_FULL_MESSAGE)
    expect(seasonStore.saveError).toBe(STORAGE_FULL_MESSAGE)

    seasonStore.clearSaveError()
    expect(leagueStore.saveError).toBeNull()
  })
})

function createPopulatedState(): AppState {
  const league = createLeague()

  return {
    leagues: [league],
    seasons: [createSeason({ leagueId: league.id })],
  }
}

function createLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    name: 'Premier League',
    createdAt: '2026-07-13T09:00:00.000Z',
    updatedAt: '2026-07-13T09:00:00.000Z',
    ...overrides,
  }
}

function createSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    leagueId: 'league-1',
    name: '2026/27',
    teams: [],
    matches: [],
    legCount: 1,
    randomTiebreakerLocks: [],
    createdAt: '2026-07-13T09:00:00.000Z',
    updatedAt: '2026-07-13T09:00:00.000Z',
    ...overrides,
  }
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState
}
