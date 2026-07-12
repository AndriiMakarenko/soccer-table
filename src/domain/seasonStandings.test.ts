import { describe, expect, it, vi } from 'vitest'

import type { Match, Season, Team } from './models'
import { calculateSeasonStandings, isSeasonComplete } from './seasonStandings'

const teams: Team[] = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'bravo', name: 'Bravo' },
  { id: 'charlie', name: 'Charlie' },
]

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    leg: 1,
    round: 1,
    homeTeamId: 'alpha',
    awayTeamId: 'bravo',
    homeScore: 0,
    awayScore: 0,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    ...overrides,
  }
}

function createSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    leagueId: 'league-1',
    name: 'Season 1',
    teams,
    matches: [
      createMatch(),
      createMatch({
        id: 'match-2',
        homeTeamId: 'bravo',
        awayTeamId: 'charlie',
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
      }),
    ],
    legCount: 1,
    randomTiebreakerLocks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('season completion and random tiebreakers', () => {
  /**
   * GIVEN a season with no fixtures, partial scores, or every score entered
   * WHEN completion is checked
   * THEN only the season with every generated fixture played is complete
   */
  it('requires every fixture to have both scores', () => {
    expect(isSeasonComplete(createSeason({ matches: [] }))).toBe(false)
    expect(
      isSeasonComplete(
        createSeason({ matches: [createMatch({ awayScore: null })] }),
      ),
    ).toBe(false)
    expect(isSeasonComplete(createSeason())).toBe(true)
  })

  /**
   * GIVEN an incomplete season whose teams remain fully tied
   * WHEN season standings are calculated
   * THEN teams share positions and no random order is generated
   */
  it('does not randomize unresolved ties before completion', () => {
    const random = vi.fn(() => 0)
    const result = calculateSeasonStandings(
      createSeason({ matches: [createMatch({ awayScore: null })] }),
      'overall',
      random,
    )

    expect(result.rows.map((row) => row.position)).toEqual([1, 1, 1])
    expect(result.randomTiebreakerLocks).toEqual([])
    expect(random).not.toHaveBeenCalled()
  })

  /**
   * GIVEN a completed season with a fully unresolved tie
   * WHEN standings are calculated with an injected random source
   * THEN a final order is generated and positions become unique
   */
  it('generates injectable random orders for completed tied groups', () => {
    const result = calculateSeasonStandings(createSeason(), 'overall', () => 0)
    const overallLock = result.randomTiebreakerLocks.find(
      (lock) => lock.mode === 'overall',
    )

    expect(overallLock).toEqual({
      mode: 'overall',
      teamIds: ['alpha', 'bravo', 'charlie'],
      orderedTeamIds: ['bravo', 'charlie', 'alpha'],
    })
    expect(result.rows.map((row) => row.teamId)).toEqual(
      overallLock?.orderedTeamIds,
    )
    expect(result.rows.map((row) => row.position)).toEqual([1, 2, 3])
  })

  /**
   * GIVEN locks saved by an earlier completed-season calculation and restored on reload
   * WHEN the same standings are recalculated
   * THEN saved orders are reused without consulting randomness
   */
  it('keeps generated orders stable across later calculations and reloads', () => {
    const initial = calculateSeasonStandings(createSeason(), 'overall', () => 0)
    const random = vi.fn(() => 0.9)
    const reloaded = calculateSeasonStandings(
      createSeason({ randomTiebreakerLocks: initial.randomTiebreakerLocks }),
      'overall',
      random,
    )

    expect(reloaded.randomTiebreakerLocks).toEqual(
      initial.randomTiebreakerLocks,
    )
    expect(random).not.toHaveBeenCalled()
  })

  /**
   * GIVEN saved locks for all table modes
   * WHEN a score is cleared and the season becomes incomplete
   * THEN every stale final-order lock is removed
   */
  it('invalidates locks when edited results make the season incomplete', () => {
    const completed = calculateSeasonStandings(createSeason())
    const result = calculateSeasonStandings(
      createSeason({
        matches: [createMatch({ awayScore: null })],
        randomTiebreakerLocks: completed.randomTiebreakerLocks,
      }),
    )

    expect(result.randomTiebreakerLocks).toEqual([])
  })

  /**
   * GIVEN two locked tie groups in a completed season
   * WHEN edited results change only one relevant tied group
   * THEN that group is replaced while the unaffected lock is preserved
   */
  it('invalidates changed tie groups while preserving unaffected locks', () => {
    const fourTeams = [...teams, { id: 'delta', name: 'Delta' }]
    const season = createSeason({
      teams: fourTeams,
      matches: [
        createMatch({
          homeTeamId: 'alpha',
          awayTeamId: 'bravo',
          homeScore: 1,
          awayScore: 1,
        }),
        createMatch({
          id: 'match-2',
          homeTeamId: 'charlie',
          awayTeamId: 'delta',
        }),
      ],
    })
    const initial = calculateSeasonStandings(season, 'overall', () => 0)
    const overallLocks = initial.randomTiebreakerLocks.filter(
      (lock) => lock.mode === 'overall',
    )
    const unaffectedLock = overallLocks.find((lock) =>
      lock.teamIds.includes('charlie'),
    )
    expect(overallLocks).toHaveLength(2)
    expect(unaffectedLock).toBeDefined()

    const changed = calculateSeasonStandings(
      {
        ...season,
        matches: [
          createMatch({
            homeTeamId: 'alpha',
            awayTeamId: 'bravo',
            homeScore: 2,
            awayScore: 1,
          }),
          createMatch({
            id: 'match-2',
            homeTeamId: 'charlie',
            awayTeamId: 'delta',
          }),
        ],
        randomTiebreakerLocks: initial.randomTiebreakerLocks,
      },
      'overall',
      () => 0.5,
    )

    expect(
      changed.randomTiebreakerLocks.some(
        (lock) => lock.mode === 'overall' && lock.teamIds.includes('alpha'),
      ),
    ).toBe(false)
    expect(
      changed.randomTiebreakerLocks.find(
        (lock) => lock.mode === 'overall' && lock.teamIds.includes('charlie'),
      ),
    ).toBe(unaffectedLock)
  })
})
