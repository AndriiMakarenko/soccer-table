import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppState, RandomTiebreakerLock, Season } from '@/domain/models'
import { STORAGE_FULL_MESSAGE } from '@/services/browserPersistence'
import { persistenceService } from '@/services/storage'

import { useLeagueStore } from './league'
import { parseBulkTeamInput, useSeasonStore } from './season'

describe('bulk team input', () => {
  /**
   * GIVEN team names with surrounding whitespace, blank lines, and Windows line endings
   * WHEN bulk input is parsed
   * THEN only trimmed non-empty team names are returned in their original order
   */
  it('normalizes bulk team names', () => {
    expect(parseBulkTeamInput('  Alpha  \r\n\r\nBravo\r\n Charlie ')).toEqual({
      valid: true,
      value: ['Alpha', 'Bravo', 'Charlie'],
    })
  })

  /**
   * GIVEN duplicate names that differ only by case after trimming
   * WHEN bulk input is parsed
   * THEN duplicate team names are rejected
   */
  it('rejects duplicate team names case-insensitively', () => {
    expect(parseBulkTeamInput('Alpha\nBravo\n alpha ')).toMatchObject({
      valid: false,
      error: expect.stringContaining('Duplicate team names'),
    })
  })

  /**
   * GIVEN fewer than two teams, more than 64 teams, or a non-text value
   * WHEN bulk input is parsed
   * THEN each unsupported input is rejected with validation feedback
   */
  it('enforces the input type and supported team-count limits', () => {
    const tooManyTeams = Array.from(
      { length: 65 },
      (_, index) => `Team ${index + 1}`,
    ).join('\n')

    expect(parseBulkTeamInput('Alpha').valid).toBe(false)
    expect(parseBulkTeamInput(42).valid).toBe(false)
    expect(parseBulkTeamInput(tooManyTeams).valid).toBe(false)
    expect(
      parseBulkTeamInput(
        Array.from({ length: 64 }, (_, index) => `Team ${index + 1}`).join(
          '\n',
        ),
      ).valid,
    ).toBe(true)
  })
})

describe('season team, fixture, and result lifecycle', () => {
  let persistedState: AppState

  beforeEach(() => {
    persistedState = { leagues: [], seasons: [] }
    vi.spyOn(persistenceService, 'load').mockImplementation(async () =>
      cloneState(persistedState),
    )
    vi.spyOn(persistenceService, 'save').mockImplementation(async (state) => {
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
   * GIVEN a new season with valid bulk team input
   * WHEN teams are saved and fixtures are generated for one and four legs
   * THEN the store persists valid schedules and locks direct team editing
   */
  it('sets teams, generates supported fixture legs, and locks team editing', () => {
    const { seasonStore, season } = createSeason()

    expect(
      seasonStore.setTeamsFromBulkInput(season.id, 'Alpha\nBravo'),
    ).toMatchObject({
      success: true,
      value: [{ name: 'Alpha' }, { name: 'Bravo' }],
    })
    expect(seasonStore.generateFixtures(season.id, 1)).toMatchObject({
      success: true,
      value: { legCount: 1, matches: [{ leg: 1 }] },
    })
    expect(
      seasonStore.setTeamsFromBulkInput(season.id, 'Alpha\nCharlie'),
    ).toMatchObject({ success: false, reason: 'locked' })

    expect(
      seasonStore.regenerateFixtures(season.id, { legCount: 4 }),
    ).toMatchObject({ success: true, value: { legCount: 4 } })
    expect(season.matches).toHaveLength(4)
    expect(new Set(season.matches.map((match) => match.leg))).toEqual(
      new Set([1, 2, 3, 4]),
    )
  })

  /**
   * GIVEN generated fixtures and a complete valid result payload
   * WHEN scores and card counts are updated and a score is later cleared
   * THEN values are normalized, persisted, and the cleared score becomes null
   */
  it('updates and clears scores and card counts', async () => {
    const { seasonStore, season } = createReadySeason()
    const match = season.matches[0]!

    expect(
      seasonStore.updateMatchResult(season.id, match.id, {
        homeScore: '3',
        awayScore: 1,
        homeYellowCards: '2',
        awayYellowCards: '',
        homeRedCards: 1,
        awayRedCards: 0,
      }),
    ).toMatchObject({
      success: true,
      value: {
        homeScore: 3,
        awayScore: 1,
        homeYellowCards: 2,
        awayYellowCards: 0,
        homeRedCards: 1,
        awayRedCards: 0,
      },
    })

    const cleared = seasonStore.updateMatchResult(season.id, match.id, {
      homeScore: '',
    })
    expect(cleared).toMatchObject({
      success: true,
      value: { homeScore: null, awayScore: 1 },
    })
    if (cleared.success) await cleared.saveResult
    expect(persistedState.seasons[0]?.matches[0]?.homeScore).toBeNull()
  })

  /**
   * GIVEN a fixture with an existing valid result
   * WHEN an update contains an invalid score or card count
   * THEN the whole update is rejected without mutation or persistence
   */
  it('rejects invalid match updates atomically', () => {
    const { seasonStore, season } = createReadySeason()
    const match = season.matches[0]!
    seasonStore.updateMatchResult(season.id, match.id, {
      homeScore: 2,
      awayScore: 0,
    })
    const saveSpy = vi.mocked(persistenceService.save)
    saveSpy.mockClear()

    expect(
      seasonStore.updateMatchResult(season.id, match.id, {
        homeScore: 4,
        awayRedCards: -1,
      }),
    ).toMatchObject({ success: false, reason: 'validation' })
    expect(match).toMatchObject({ homeScore: 2, awayScore: 0, awayRedCards: 0 })
    expect(saveSpy).not.toHaveBeenCalled()
  })

  /**
   * GIVEN fixtures containing scores, cards, and locked final tiebreakers
   * WHEN all results are reset
   * THEN every score is null, cards are zero, locks are cleared, and state is saved
   */
  it('resets every result and random tiebreaker lock', async () => {
    const { seasonStore, season } = createReadySeason()
    const match = season.matches[0]!
    seasonStore.updateMatchResult(season.id, match.id, {
      homeScore: 0,
      awayScore: 0,
      homeYellowCards: 2,
      awayYellowCards: 2,
      homeRedCards: 1,
      awayRedCards: 1,
    })
    expect(season.randomTiebreakerLocks.length).toBeGreaterThan(0)

    const result = seasonStore.resetAllResults(season.id)

    expect(result.success).toBe(true)
    expect(match).toMatchObject({
      homeScore: null,
      awayScore: null,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
    })
    expect(season.randomTiebreakerLocks).toEqual([])
    if (result.success) await result.saveResult
    expect(persistedState.seasons[0]).toEqual(season)
  })

  /**
   * GIVEN fixtures with entered scores or cards
   * WHEN regeneration is requested without and then with explicit confirmation
   * THEN the first request is rejected unsaved and the confirmed request replaces fixtures
   */
  it('guards destructive regeneration and accepts explicit confirmation', () => {
    const { seasonStore, season } = createReadySeason()
    const originalMatchId = season.matches[0]!.id
    seasonStore.updateMatchResult(season.id, originalMatchId, {
      homeYellowCards: 1,
    })
    const saveSpy = vi.mocked(persistenceService.save)
    saveSpy.mockClear()

    expect(
      seasonStore.regenerateFixtures(season.id, { legCount: 2 }),
    ).toMatchObject({
      success: false,
      reason: 'confirmation-required',
    })
    expect(season.matches[0]!.id).toBe(originalMatchId)
    expect(saveSpy).not.toHaveBeenCalled()

    expect(
      seasonStore.regenerateFixtures(season.id, {
        legCount: 2,
        teamInput: 'Alpha\nBravo\nCharlie',
        confirmResultDeletion: true,
      }),
    ).toMatchObject({ success: true, value: { legCount: 2 } })
    expect(season.teams.map((team) => team.name)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
    expect(season.matches).toHaveLength(6)
    expect(season.matches.every((match) => match.homeScore === null)).toBe(true)
  })

  /**
   * GIVEN an unplayed generated schedule
   * WHEN fixtures are regenerated without confirmation
   * THEN regeneration succeeds because no user-entered result data is destroyed
   */
  it('regenerates unplayed fixtures without confirmation', () => {
    const { seasonStore, season } = createReadySeason()

    expect(
      seasonStore.regenerateFixtures(season.id, { legCount: 2 }),
    ).toMatchObject({ success: true, value: { legCount: 2 } })
    expect(season.matches).toHaveLength(2)
  })

  /**
   * GIVEN a completed tied season with locked random order
   * WHEN a score is cleared and makes the season incomplete
   * THEN result mutation invalidates the stale random tiebreaker locks
   */
  it('invalidates random tiebreakers when result changes require it', () => {
    const { seasonStore, season } = createReadySeason()
    const match = season.matches[0]!
    seasonStore.updateMatchResult(season.id, match.id, {
      homeScore: 1,
      awayScore: 1,
    })
    expect(season.randomTiebreakerLocks.length).toBeGreaterThan(0)

    seasonStore.updateMatchResult(season.id, match.id, { awayScore: null })

    expect(season.randomTiebreakerLocks).toEqual([])
  })

  /**
   * GIVEN a successful in-memory result mutation whose storage save fails
   * WHEN the match is updated
   * THEN the changed result remains available and the save failure is exposed
   */
  it('retains lifecycle mutations when persistence fails', async () => {
    const { seasonStore, season } = createReadySeason()
    vi.mocked(persistenceService.save).mockResolvedValue({
      success: false,
      reason: 'disk-full',
      message: STORAGE_FULL_MESSAGE,
    })

    const result = seasonStore.updateMatchResult(
      season.id,
      season.matches[0]!.id,
      { homeScore: 5 },
    )

    expect(result).toMatchObject({ success: true, value: { homeScore: 5 } })
    if (!result.success) return
    await expect(result.saveResult).resolves.toMatchObject({
      success: false,
      reason: 'disk-full',
    })
    expect(season.matches[0]!.homeScore).toBe(5)
    expect(seasonStore.saveError).toBe(STORAGE_FULL_MESSAGE)
  })

  /**
   * GIVEN team, fixture, score, card, and tiebreaker mutations saved by one store instance
   * WHEN a fresh Pinia instance loads persisted state
   * THEN the complete season lifecycle state is restored
   */
  it('restores persisted season lifecycle data after reload', async () => {
    const { seasonStore, season } = createReadySeason()
    const update = seasonStore.updateMatchResult(
      season.id,
      season.matches[0]!.id,
      {
        homeScore: 0,
        awayScore: 0,
        homeRedCards: 1,
        awayRedCards: 1,
      },
    )
    if (update.success) await update.saveResult
    const locks = cloneLocks(season.randomTiebreakerLocks)
    expect(locks.length).toBeGreaterThan(0)

    setActivePinia(createPinia())
    const reloadedStore = useSeasonStore()
    await reloadedStore.load()
    const reloadedSeason = reloadedStore.seasonById(season.id)

    expect(reloadedSeason).toMatchObject({
      teams: [{ name: 'Alpha' }, { name: 'Bravo' }],
      matches: [
        {
          homeScore: 0,
          awayScore: 0,
          homeRedCards: 1,
          awayRedCards: 1,
        },
      ],
      randomTiebreakerLocks: locks,
    })
  })

  function createSeason(): {
    seasonStore: ReturnType<typeof useSeasonStore>
    season: Season
  } {
    const leagueStore = useLeagueStore()
    const seasonStore = useSeasonStore()
    leagueStore.load()
    const leagueResult = leagueStore.createLeague('Premier League')
    if (!leagueResult.success) throw new Error('Failed to create test league')
    const seasonResult = seasonStore.createSeason({
      leagueId: leagueResult.value.id,
      name: '2026/27',
    })
    if (!seasonResult.success) throw new Error('Failed to create test season')

    return { seasonStore, season: seasonResult.value }
  }

  function createReadySeason(): {
    seasonStore: ReturnType<typeof useSeasonStore>
    season: Season
  } {
    const context = createSeason()
    context.seasonStore.setTeamsFromBulkInput(context.season.id, 'Alpha\nBravo')
    context.seasonStore.generateFixtures(context.season.id, 1)
    return context
  }
})

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState
}

function cloneLocks(
  locks: readonly RandomTiebreakerLock[],
): RandomTiebreakerLock[] {
  return JSON.parse(JSON.stringify(locks)) as RandomTiebreakerLock[]
}
