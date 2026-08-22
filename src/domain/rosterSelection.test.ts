import { describe, expect, it } from 'vitest'

import type { Match, Season, Team } from './models'
import { selectFinalizedRosterRange } from './rosterSelection'

describe('finalized standings roster selection', () => {
  /**
   * GIVEN a completed source season in another league with six ordered teams
   * WHEN rows two through five are selected inclusively
   * THEN exactly those four team names are returned without historical data
   */
  it('selects an inclusive cross-league range by ordered table row', () => {
    const result = selectFinalizedRosterRange({
      sourceSeason: createSeason(),
      fromPosition: 2,
      toPosition: 5,
    })

    expect(result).toEqual({
      success: true,
      names: ['Team 2', 'Team 3', 'Team 4', 'Team 5'],
    })
  })

  /**
   * GIVEN completed nil-nil fixtures and a persisted random lock for shared standings positions
   * WHEN the tied standings range is selected
   * THEN row selection follows the locked deterministic order rather than displayed shared positions
   */
  it('uses persisted locks to order fully tied rows deterministically', () => {
    const sourceSeason = createSeason({ tied: true })
    const reversedIds = sourceSeason.teams.map((team) => team.id).reverse()
    sourceSeason.randomTiebreakerLocks = [
      {
        mode: 'overall',
        teamIds: [...reversedIds].sort(),
        orderedTeamIds: reversedIds,
      },
    ]

    const result = selectFinalizedRosterRange({
      sourceSeason,
      fromPosition: 2,
      toPosition: 4,
    })

    expect(result).toEqual({
      success: true,
      names: ['Team 5', 'Team 4', 'Team 3'],
    })
  })

  /**
   * GIVEN incomplete fixtures and malformed, reversed, or out-of-bounds ranges
   * WHEN roster selection is requested
   * THEN each request fails without returning a partial roster
   */
  it('rejects incomplete seasons and invalid ranges', () => {
    const incomplete = createSeason()
    incomplete.matches[0]!.homeScore = null
    expect(
      selectFinalizedRosterRange({
        sourceSeason: incomplete,
        fromPosition: 1,
        toPosition: 2,
      }),
    ).toMatchObject({ success: false })

    for (const [fromPosition, toPosition] of [
      [1.5, 2],
      [0, 2],
      [4, 3],
      [1, 7],
    ]) {
      expect(
        selectFinalizedRosterRange({
          sourceSeason: createSeason(),
          fromPosition,
          toPosition,
        }),
      ).toMatchObject({ success: false })
    }
  })

  /**
   * GIVEN a manual draft containing a case-insensitive duplicate of an imported team
   * WHEN the source range is selected
   * THEN the conflict is rejected and no names are returned
   */
  it('rejects case-insensitive duplicate names against the draft', () => {
    expect(
      selectFinalizedRosterRange({
        sourceSeason: createSeason(),
        fromPosition: 1,
        toPosition: 2,
        draftNames: ['team 1'],
      }),
    ).toEqual({
      success: false,
      message: 'Duplicate team names are not allowed: Team 1',
    })
  })

  /**
   * GIVEN a draft at the maximum supported roster size
   * WHEN another finalized team is selected
   * THEN the 64-team boundary prevents the import
   */
  it('enforces the 64-team boundary', () => {
    expect(
      selectFinalizedRosterRange({
        sourceSeason: createSeason(),
        fromPosition: 1,
        toPosition: 2,
        draftNames: Array.from({ length: 63 }, (_, index) => `Draft ${index}`),
      }),
    ).toEqual({
      success: false,
      message: 'Team count must be between 2 and 64.',
    })
  })
})

function createSeason(options: { tied?: boolean } = {}): Season {
  const teams: Team[] = Array.from({ length: 6 }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
  }))
  const pairings = options.tied
    ? teams.flatMap((team, index) =>
        teams.slice(index + 1).map((opponent) => [team, opponent] as const),
      )
    : teams
        .slice(0, -1)
        .map((team, index) => [team, teams[index + 1]!] as const)
  const matches: Match[] = pairings.map(([team, opponent], index) => ({
    id: `match-${index + 1}`,
    leg: 1,
    round: index + 1,
    homeTeamId: team.id,
    awayTeamId: opponent.id,
    homeScore: options.tied ? 0 : teams.length - index,
    awayScore: 0,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
  }))

  return {
    id: 'source-season',
    leagueId: 'source-league',
    name: 'Source season',
    teams,
    matches,
    legCount: 1,
    randomTiebreakerLocks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
