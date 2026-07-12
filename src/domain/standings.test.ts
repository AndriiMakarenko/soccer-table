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
