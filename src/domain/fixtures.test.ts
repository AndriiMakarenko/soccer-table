import { describe, expect, it } from 'vitest'

import type { Match, Team } from './models'
import { generateRoundRobinFixtures } from './fixtures'

function createTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
  }))
}

function generate(teams: Team[], legCount = 1): Match[] {
  let fixtureNumber = 0
  return generateRoundRobinFixtures(
    teams,
    legCount,
    () => `fixture-${++fixtureNumber}`,
  )
}

function unorderedPair(match: Match): string {
  return [match.homeTeamId, match.awayTeamId].sort().join(':')
}

function venueSequence(matches: readonly Match[], teamId: string): string {
  return matches
    .filter(
      (match) => match.homeTeamId === teamId || match.awayTeamId === teamId,
    )
    .map((match) => (match.homeTeamId === teamId ? 'H' : 'A'))
    .join('')
}

function longestVenueRun(sequence: string): number {
  return Math.max(
    ...Array.from(sequence.matchAll(/H+|A+/g), ([run]) => run.length),
  )
}

describe('round-robin fixture generation', () => {
  /**
   * GIVEN four teams and one leg
   * WHEN fixtures are generated
   * THEN every pair meets exactly once across three complete rounds
   */
  it('generates unique pairings and complete rounds for an even team count', () => {
    const matches = generate(createTeams(4))

    expect(matches).toHaveLength(6)
    expect(new Set(matches.map(unorderedPair))).toHaveLength(6)

    for (let round = 1; round <= 3; round += 1) {
      const roundMatches = matches.filter((match) => match.round === round)
      const participants = roundMatches.flatMap((match) => [
        match.homeTeamId,
        match.awayTeamId,
      ])

      expect(roundMatches).toHaveLength(2)
      expect(new Set(participants)).toHaveLength(4)
    }
  })

  /**
   * GIVEN five teams and one leg
   * WHEN fixtures are generated with an internal BYE participant
   * THEN five rounds are emitted with each real team playing four times and no BYE match
   */
  it('hides BYEs and rotates the idle team for an odd team count', () => {
    const teams = createTeams(5)
    const matches = generate(teams)

    expect(matches).toHaveLength(10)
    expect(new Set(matches.map(unorderedPair))).toHaveLength(10)
    expect(matches.every((match) => match.round >= 1 && match.round <= 5)).toBe(
      true,
    )

    for (const team of teams) {
      expect(
        matches.filter(
          (match) =>
            match.homeTeamId === team.id || match.awayTeamId === team.id,
        ),
      ).toHaveLength(4)
    }
  })

  /**
   * GIVEN generated fixtures for a valid season
   * WHEN their initial result fields are inspected
   * THEN scores are null, cards are zero, IDs are unique, and no team plays itself
   */
  it('initializes every required fixture field', () => {
    const matches = generate(createTeams(3), 2)

    expect(new Set(matches.map(({ id }) => id))).toHaveLength(matches.length)
    for (const match of matches) {
      expect(match.homeTeamId).not.toBe(match.awayTeamId)
      expect(match).toMatchObject({
        homeScore: null,
        awayScore: null,
        homeYellowCards: 0,
        awayYellowCards: 0,
        homeRedCards: 0,
        awayRedCards: 0,
      })
    }
  })

  /**
   * GIVEN a four-team two-leg season
   * WHEN fixtures are generated
   * THEN every second-leg pairing reverses the corresponding first-leg home and away teams
   */
  it('reverses home and away teams in leg two', () => {
    const matches = generate(createTeams(4), 2)
    const firstLeg = matches.filter(({ leg }) => leg === 1)
    const secondLeg = matches.filter(({ leg }) => leg === 2)

    for (const firstMatch of firstLeg) {
      const reverseMatch = secondLeg.find(
        (match) => unorderedPair(match) === unorderedPair(firstMatch),
      )

      expect(reverseMatch).toMatchObject({
        homeTeamId: firstMatch.awayTeamId,
        awayTeamId: firstMatch.homeTeamId,
      })
    }
  })

  /**
   * GIVEN an even-team round robin where strict alternation is not possible for every team
   * WHEN home and away assignments are generated
   * THEN the unavoidable repeated venues are limited to two consecutive matches
   */
  it('limits unavoidable home or away runs for an even team count', () => {
    const teams = createTeams(4)
    const matches = generate(teams)
    const sequences = teams.map(({ id }) => venueSequence(matches, id))

    expect(sequences.some((sequence) => /(HH|AA)/.test(sequence))).toBe(true)
    expect(sequences.every((sequence) => longestVenueRun(sequence) <= 2)).toBe(
      true,
    )
  })

  /**
   * GIVEN an odd-team round robin with one idle team in every round
   * WHEN home and away assignments are generated
   * THEN each team's played-match sequence alternates where possible and never runs beyond two
   */
  it('balances played-match venue runs around BYEs for an odd team count', () => {
    const teams = createTeams(7)
    const matches = generate(teams)

    for (const team of teams) {
      const sequence = venueSequence(matches, team.id)

      expect(sequence).toHaveLength(6)
      expect(longestVenueRun(sequence)).toBeLessThanOrEqual(2)
    }
  })

  /**
   * GIVEN two to four legs for representative even and odd team counts
   * WHEN fixtures are generated with reversed return legs
   * THEN leg boundaries do not create a home or away run longer than two matches
   */
  it.each([
    { teamCount: 4, legCount: 2 },
    { teamCount: 5, legCount: 3 },
    { teamCount: 8, legCount: 4 },
  ])(
    'keeps venue runs balanced across $teamCount teams and $legCount legs',
    ({ teamCount, legCount }) => {
      const teams = createTeams(teamCount)
      const matches = generate(teams, legCount)

      for (const team of teams) {
        expect(
          longestVenueRun(venueSequence(matches, team.id)),
        ).toBeLessThanOrEqual(2)
      }
    },
  )

  /**
   * GIVEN fixture schedules spanning the supported team-count range
   * WHEN each team's ordered venue sequence is inspected
   * THEN none contains three consecutive home or three consecutive away matches
   */
  it('never creates venue runs longer than two matches', () => {
    for (let teamCount = 2; teamCount <= 64; teamCount += 1) {
      const teams = createTeams(teamCount)
      const matches = generate(teams)

      for (const team of teams) {
        expect(venueSequence(matches, team.id)).not.toMatch(/HHH|AAA/)
      }
    }
  })

  /**
   * GIVEN a four-team four-leg season
   * WHEN fixtures are generated
   * THEN each pair meets four times with each team hosting exactly twice
   */
  it('alternates pair-level home advantage evenly across four legs', () => {
    const matches = generate(createTeams(4), 4)
    const pairKeys = new Set(matches.map(unorderedPair))

    expect(matches).toHaveLength(24)
    for (const pairKey of pairKeys) {
      const pairMatches = matches.filter(
        (match) => unorderedPair(match) === pairKey,
      )
      const [firstTeamId] = pairKey.split(':')

      expect(pairMatches).toHaveLength(4)
      expect(
        pairMatches.filter(({ homeTeamId }) => homeTeamId === firstTeamId),
      ).toHaveLength(2)
    }
  })

  /**
   * GIVEN the supported maximum of 64 teams and four legs
   * WHEN fixtures are generated
   * THEN all 8,064 fixtures are produced in 63 rounds per leg without duplicate participation
   */
  it('supports the 64-team boundary', () => {
    const matches = generate(createTeams(64), 4)

    expect(matches).toHaveLength(64 * 63 * 2)
    for (let leg = 1; leg <= 4; leg += 1) {
      const legMatches = matches.filter((match) => match.leg === leg)
      expect(new Set(legMatches.map(unorderedPair))).toHaveLength((64 * 63) / 2)

      for (let round = 1; round <= 63; round += 1) {
        const participants = legMatches
          .filter((match) => match.round === round)
          .flatMap((match) => [match.homeTeamId, match.awayTeamId])
        expect(new Set(participants)).toHaveLength(64)
      }
    }
  })

  /**
   * GIVEN unsupported team or leg counts and duplicate team IDs
   * WHEN fixture generation is requested
   * THEN invalid input is rejected before scheduling
   */
  it('rejects invalid scheduling input', () => {
    expect(() => generate(createTeams(1))).toThrow(
      'Team count must be between 2 and 64',
    )
    expect(() => generate(createTeams(65))).toThrow(
      'Team count must be between 2 and 64',
    )
    expect(() => generate(createTeams(2), 5)).toThrow(
      'Leg count must be between 1 and 4',
    )
    expect(() =>
      generate([
        { id: 'same', name: 'A' },
        { id: 'same', name: 'B' },
      ]),
    ).toThrow('Team IDs must be unique')
  })
})
