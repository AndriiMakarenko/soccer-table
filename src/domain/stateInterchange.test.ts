import { describe, expect, it } from 'vitest'

import type { AppState } from './models'
import {
  INTERCHANGE_VERSION,
  parseAppStateInterchange,
  planAppStateImport,
  serializeAppState,
  StateInterchangeError,
} from './stateInterchange'

describe('state interchange', () => {
  /**
   * GIVEN complete tournament data including results, cards, and a random lock
   * WHEN it is exported and parsed again
   * THEN the versioned JSON is deterministic and preserves the complete state
   */
  it('round trips the complete state deterministically', () => {
    const state = populatedState('league-1', 'Premier League')

    const first = serializeAppState(state)
    const second = serializeAppState(state)

    expect(first).toBe(second)
    expect(JSON.parse(first).version).toBe(INTERCHANGE_VERSION)
    expect(parseAppStateInterchange(first)).toEqual(state)
  })

  /**
   * GIVEN malformed JSON, an unsupported version, or an invalid nested relationship
   * WHEN an interchange file is parsed
   * THEN it is rejected with actionable feedback before any state can change
   */
  it.each([
    ['malformed JSON', '{', 'not valid JSON'],
    [
      'unsupported version',
      JSON.stringify({ version: 99, state: { leagues: [], seasons: [] } }),
      'version 99 is not supported',
    ],
    [
      'orphaned season',
      JSON.stringify({
        version: INTERCHANGE_VERSION,
        state: {
          leagues: [],
          seasons: populatedState('league-1', 'Premier League').seasons,
        },
      }),
      'refers to a league that is not in the file',
    ],
  ])('rejects %s', (_case, serialized, message) => {
    expect(() => parseAppStateInterchange(serialized)).toThrow(
      StateInterchangeError,
    )
    expect(() => parseAppStateInterchange(serialized)).toThrow(message)
  })

  /**
   * GIVEN imported leagues whose names do not exist in current data
   * WHEN a merge is planned
   * THEN all current and imported league relationships are preserved
   */
  it('merges conflict-free leagues without dropping existing data', () => {
    const current = populatedState('league-1', 'Premier League')
    const imported = populatedState('league-2', 'Championship')

    const result = planAppStateImport(current, imported, 'merge')

    expect(result.importedLeagueNames).toEqual(['Championship'])
    expect(result.skippedLeagueNames).toEqual([])
    expect(result.state.leagues.map(({ name }) => name)).toEqual([
      'Premier League',
      'Championship',
    ])
    expect(result.state.seasons[1]?.leagueId).toBe('league-2')
  })

  /**
   * GIVEN multiple imported leagues that conflict by name with existing leagues
   * WHEN a merge is planned
   * THEN every conflicting league and all of its seasons are skipped and reported
   */
  it('skips and reports multiple whole-league name conflicts', () => {
    const current = combine(
      populatedState('league-1', 'Premier League'),
      populatedState('league-2', 'Championship'),
    )
    const imported = combine(
      populatedState('league-3', ' premier league '),
      populatedState('league-4', 'CHAMPIONSHIP'),
      populatedState('league-5', 'League One'),
    )

    const result = planAppStateImport(current, imported, 'merge')

    expect(result.skippedLeagueNames).toEqual([
      ' premier league ',
      'CHAMPIONSHIP',
    ])
    expect(result.importedLeagueNames).toEqual(['League One'])
    expect(result.state.seasons).toHaveLength(3)
    expect(
      result.state.seasons.some(({ leagueId }) => leagueId === 'league-3'),
    ).toBe(false)
  })

  /**
   * GIVEN an accepted imported league whose technical identifiers collide with current data
   * WHEN the league is merged
   * THEN identifiers and every dependent relationship are remapped without overwrites
   */
  it('resolves identifier collisions and remaps dependent relationships', () => {
    const current = populatedState('shared-league', 'Premier League')
    const imported = populatedState('shared-league', 'Championship')
    const generated = [
      'new-league',
      'new-season',
      'new-home',
      'new-away',
      'new-match',
    ]

    const result = planAppStateImport(current, imported, 'merge', () =>
      generated.shift()!,
    )
    const season = result.state.seasons[1]!

    expect(result.state.leagues[1]?.id).toBe('new-league')
    expect(season).toMatchObject({
      id: 'new-season',
      leagueId: 'new-league',
    })
    expect(season.matches[0]).toMatchObject({
      id: 'new-match',
      homeTeamId: 'new-home',
      awayTeamId: 'new-away',
    })
    expect(season.randomTiebreakerLocks[0]).toEqual({
      mode: 'overall',
      teamIds: ['new-home', 'new-away'],
      orderedTeamIds: ['new-away', 'new-home'],
    })
  })
})

function populatedState(leagueId: string, leagueName: string): AppState {
  return {
    leagues: [
      {
        id: leagueId,
        name: leagueName,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ],
    seasons: [
      {
        id: 'shared-season',
        leagueId,
        name: '2026/27',
        teams: [
          { id: 'shared-home', name: 'Alpha' },
          { id: 'shared-away', name: 'Bravo' },
        ],
        matches: [
          {
            id: 'shared-match',
            leg: 1,
            round: 1,
            homeTeamId: 'shared-home',
            awayTeamId: 'shared-away',
            homeScore: 2,
            awayScore: 1,
            homeYellowCards: 1,
            awayYellowCards: 2,
            homeRedCards: 0,
            awayRedCards: 1,
          },
        ],
        legCount: 1,
        randomTiebreakerLocks: [
          {
            mode: 'overall',
            teamIds: ['shared-home', 'shared-away'],
            orderedTeamIds: ['shared-away', 'shared-home'],
          },
        ],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ],
  }
}

function combine(...states: AppState[]): AppState {
  return {
    leagues: states.flatMap(({ leagues }) => leagues),
    seasons: states.flatMap(({ seasons }) => seasons),
  }
}
