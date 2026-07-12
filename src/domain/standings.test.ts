import { describe, expect, it } from 'vitest'

import type { Match, TableMode, Team } from './models'
import { calculateStandings } from './standings'

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
    homeScore: 2,
    awayScore: 1,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    ...overrides,
  }
}

function rowFor(teamId: string, matches: Match[], mode?: TableMode) {
  const row = calculateStandings(teams, matches, mode).rows.find(
    (candidate) => candidate.teamId === teamId,
  )

  expect(row).toBeDefined()
  return row!
}

function rankedTeamIds(
  rankingTeams: Team[],
  matches: Match[],
  mode: TableMode = 'overall',
) {
  return calculateStandings(rankingTeams, matches, mode).rows.map(
    (row) => row.teamId,
  )
}

describe('standings calculation', () => {
  /**
   * GIVEN fixtures containing a win, draw, and loss for Alpha
   * WHEN overall standings are calculated
   * THEN all result counts, goals, goal difference, and points are derived
   */
  it('calculates wins, draws, losses, goals, and points', () => {
    const matches = [
      createMatch(),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
        homeScore: 0,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'alpha',
        awayTeamId: 'charlie',
        homeScore: 1,
        awayScore: 3,
      }),
    ]

    expect(rowFor('alpha', matches)).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      scoredFor: 3,
      scoredAgainst: 4,
      scoreDifference: -1,
      points: 4,
    })
  })

  /**
   * GIVEN cleared and partially entered fixture scores with card values
   * WHEN standings are calculated
   * THEN those unplayed fixtures contribute no statistics or penalties
   */
  it('ignores cleared and partial scores', () => {
    const matches = [
      createMatch({ homeScore: null, awayScore: null, homeRedCards: 2 }),
      createMatch({ id: 'match-2', awayScore: null, homeYellowCards: 4 }),
    ]

    expect(rowFor('alpha', matches)).toMatchObject({
      played: 0,
      scoredFor: 0,
      points: 0,
      penaltyPoints: 0,
    })
  })

  /**
   * GIVEN a played fixture with yellow and red cards for both teams
   * WHEN penalty points are calculated
   * THEN yellow cards count once and red cards count three times
   */
  it('calculates card penalty points for played fixtures', () => {
    const match = createMatch({
      homeYellowCards: 2,
      homeRedCards: 1,
      awayYellowCards: 1,
      awayRedCards: 2,
    })

    expect(rowFor('alpha', [match]).penaltyPoints).toBe(5)
    expect(rowFor('bravo', [match]).penaltyPoints).toBe(7)
  })

  /**
   * GIVEN Alpha has one home win and one away draw
   * WHEN Overall, Home only, and Away only standings are calculated
   * THEN every mode recalculates statistics from its qualifying appearances
   */
  it('calculates all three table modes independently', () => {
    const matches = [
      createMatch(),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
        homeScore: 2,
        awayScore: 2,
      }),
    ]

    expect(rowFor('alpha', matches, 'overall')).toMatchObject({
      played: 2,
      won: 1,
      drawn: 1,
      scoredFor: 4,
      scoredAgainst: 3,
      points: 4,
    })
    expect(rowFor('alpha', matches, 'home')).toMatchObject({
      played: 1,
      won: 1,
      drawn: 0,
      scoredFor: 2,
      scoredAgainst: 1,
      points: 3,
    })
    expect(rowFor('alpha', matches, 'away')).toMatchObject({
      played: 1,
      won: 0,
      drawn: 1,
      scoredFor: 2,
      scoredAgainst: 2,
      points: 1,
    })
  })

  /**
   * GIVEN qualifying games with a non-integer average and modes with no games
   * WHEN average totals are formatted
   * THEN numeric values have exactly two decimals and empty modes return N/A
   */
  it('formats average totals to two decimals or N/A', () => {
    const matches = [
      createMatch({ homeScore: 1, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'bravo',
        awayTeamId: 'charlie',
        homeScore: 2,
        awayScore: 2,
      }),
      createMatch({ id: 'match-3', homeScore: null, awayScore: null }),
    ]

    expect(calculateStandings(teams, matches).averageTotal).toBe('2.50')
    expect(calculateStandings(teams, matches, 'home').averageTotal).toBe('3.00')
    expect(calculateStandings(teams, [], 'away').averageTotal).toBe('N/A')
  })

  /**
   * GIVEN a fixture referencing a team outside the supplied season team list
   * WHEN standings are calculated
   * THEN the invalid domain relationship is reported instead of silently dropped
   */
  it('rejects fixtures that reference unknown teams', () => {
    expect(() =>
      calculateStandings(teams, [createMatch({ awayTeamId: 'unknown' })]),
    ).toThrow('Match references unknown team: unknown')
  })
})

describe('standings ranking', () => {
  const rankingTeams: Team[] = [
    { id: 'alpha', name: 'Alpha' },
    { id: 'bravo', name: 'Bravo' },
    { id: 'charlie', name: 'Charlie' },
    { id: 'delta', name: 'Delta' },
  ]

  /**
   * GIVEN teams with different points and teams tied on points with different goal differences
   * WHEN the standings are ranked
   * THEN points take precedence and goal difference resolves equal points
   */
  it('ranks by points before goal difference', () => {
    const matches = [
      createMatch({ homeScore: 2, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'delta',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'alpha',
        awayTeamId: 'charlie',
        homeScore: 0,
        awayScore: 0,
      }),
    ]

    expect(rankedTeamIds(rankingTeams, matches)).toEqual([
      'alpha',
      'charlie',
      'delta',
      'bravo',
    ])
  })

  /**
   * GIVEN Alpha and Bravo tied on points and goal difference after other fixtures
   * WHEN their direct match has a winner
   * THEN head-to-head points rank that winner first
   */
  it('uses head-to-head points after points and goal difference', () => {
    const matches = [
      createMatch({ homeScore: 1, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'bravo',
        awayTeamId: 'delta',
        homeScore: 2,
        awayScore: 1,
      }),
    ]

    expect(rankedTeamIds(rankingTeams, matches).indexOf('alpha')).toBeLessThan(
      rankedTeamIds(rankingTeams, matches).indexOf('bravo'),
    )
  })

  /**
   * GIVEN Alpha and Bravo tied overall and on head-to-head points
   * WHEN Alpha scored more goals in their direct fixtures
   * THEN head-to-head goals scored rank Alpha first
   */
  it('uses head-to-head goals scored after head-to-head points', () => {
    const matches = [
      createMatch({ homeScore: 3, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'bravo',
        awayTeamId: 'alpha',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'alpha',
        awayTeamId: 'charlie',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-4',
        homeTeamId: 'bravo',
        awayTeamId: 'delta',
        homeScore: 5,
        awayScore: 0,
      }),
    ]

    expect(rankedTeamIds(rankingTeams, matches).indexOf('alpha')).toBeLessThan(
      rankedTeamIds(rankingTeams, matches).indexOf('bravo'),
    )
  })

  /**
   * GIVEN tied teams whose direct fixture is level
   * WHEN one team has more total goals and penalties later differ
   * THEN total goals rank before lower penalty points
   */
  it('uses total goals before lower penalty points', () => {
    const matches = [
      createMatch({ homeScore: 0, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'alpha',
        awayTeamId: 'charlie',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'bravo',
        awayTeamId: 'delta',
        homeScore: 2,
        awayScore: 1,
        homeRedCards: 2,
      }),
    ]

    expect(rankedTeamIds(rankingTeams, matches).indexOf('bravo')).toBeLessThan(
      rankedTeamIds(rankingTeams, matches).indexOf('alpha'),
    )
  })

  /**
   * GIVEN teams equal through total goals but with different card penalties
   * WHEN the standings are ranked
   * THEN the team with fewer penalty points ranks first
   */
  it('uses lower penalty points as the final deterministic tiebreaker', () => {
    const matches = [
      createMatch({
        homeScore: 1,
        awayScore: 1,
        homeYellowCards: 2,
        awayYellowCards: 0,
      }),
    ]

    expect(rankedTeamIds(rankingTeams.slice(0, 2), matches)).toEqual([
      'bravo',
      'alpha',
    ])
  })

  /**
   * GIVEN three fully tied teams and one team below them
   * WHEN no deterministic criterion resolves the leading group
   * THEN equal positions use standard competition ranking
   */
  it('assigns shared positions to unresolved multi-team ties', () => {
    const rows = calculateStandings(rankingTeams, []).rows

    expect(rows.map(({ position }) => position)).toEqual([1, 1, 1, 1])

    const withTrailingTeam = calculateStandings(rankingTeams, [
      createMatch({ homeScore: 1, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
        homeScore: 1,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'bravo',
        awayTeamId: 'charlie',
        homeScore: 1,
        awayScore: 0,
      }),
    ]).rows

    expect(withTrailingTeam.map(({ position }) => position)).toEqual([
      1, 1, 1, 4,
    ])
  })

  /**
   * GIVEN fixtures whose overall, home-only, and away-only records differ
   * WHEN each table mode is ranked
   * THEN each mode independently filters both statistics and head-to-head data
   */
  it('ranks Overall, Home only, and Away only independently', () => {
    const modeTeams = rankingTeams.slice(0, 3)
    const matches = [
      createMatch({ homeScore: 2, awayScore: 0 }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'charlie',
        awayTeamId: 'alpha',
        homeScore: 3,
        awayScore: 0,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'bravo',
        awayTeamId: 'charlie',
        homeScore: 1,
        awayScore: 0,
      }),
    ]

    expect(rankedTeamIds(modeTeams, matches, 'overall')[0]).toBe('charlie')
    expect(rankedTeamIds(modeTeams, matches, 'home')).toEqual([
      'charlie',
      'alpha',
      'bravo',
    ])
    expect(rankedTeamIds(modeTeams, matches, 'away')).toEqual([
      'charlie',
      'bravo',
      'alpha',
    ])
  })
})
