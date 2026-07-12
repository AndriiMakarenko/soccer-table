import type { EntityId, Match, Team } from './models'
import { createId } from './identity'
import { validateLegCount, validateTeamCount } from './validation'

type FixtureIdFactory = () => EntityId
type Participant = EntityId | null

interface Pairing {
  homeTeamId: EntityId
  awayTeamId: EntityId
}

export function generateRoundRobinFixtures(
  teams: readonly Team[],
  legCount: number,
  createFixtureId: FixtureIdFactory = createId,
): Match[] {
  assertValidInput(teams, legCount)

  const rounds = createSingleLegRounds(teams.map(({ id }) => id))

  return Array.from({ length: legCount }, (_, legIndex) => {
    const reverseHomeAndAway = legIndex % 2 === 1

    return rounds.flatMap((pairings, roundIndex) =>
      pairings.map((pairing) =>
        createMatch(
          pairing,
          legIndex + 1,
          roundIndex + 1,
          reverseHomeAndAway,
          createFixtureId,
        ),
      ),
    )
  }).flat()
}

function assertValidInput(teams: readonly Team[], legCount: number): void {
  const teamCountResult = validateTeamCount(teams.length)
  if (!teamCountResult.valid) {
    throw new RangeError(teamCountResult.error)
  }

  const legCountResult = validateLegCount(legCount)
  if (!legCountResult.valid) {
    throw new RangeError(legCountResult.error)
  }

  const uniqueTeamIds = new Set(teams.map(({ id }) => id))
  if (uniqueTeamIds.size !== teams.length) {
    throw new Error('Team IDs must be unique')
  }
}

function createSingleLegRounds(teamIds: readonly EntityId[]): Pairing[][] {
  const participants: Participant[] = [...teamIds]
  if (participants.length % 2 === 1) {
    participants.push(null)
  }

  const rounds: Pairing[][] = []
  const roundCount = participants.length - 1

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const pairings: Pairing[] = []

    for (
      let pairIndex = 0;
      pairIndex < participants.length / 2;
      pairIndex += 1
    ) {
      const first = participants[pairIndex]
      const second = participants[participants.length - 1 - pairIndex]

      if (first == null || second == null) {
        continue
      }

      const reversePair = (roundIndex + pairIndex) % 2 === 1
      pairings.push({
        homeTeamId: reversePair ? second : first,
        awayTeamId: reversePair ? first : second,
      })
    }

    rounds.push(pairings)
    rotateParticipants(participants)
  }

  return rounds
}

function rotateParticipants(participants: Participant[]): void {
  const last = participants.pop()
  if (last !== undefined) {
    participants.splice(1, 0, last)
  }
}

function createMatch(
  pairing: Pairing,
  leg: number,
  round: number,
  reverseHomeAndAway: boolean,
  createFixtureId: FixtureIdFactory,
): Match {
  return {
    id: createFixtureId(),
    leg,
    round,
    homeTeamId: reverseHomeAndAway ? pairing.awayTeamId : pairing.homeTeamId,
    awayTeamId: reverseHomeAndAway ? pairing.homeTeamId : pairing.awayTeamId,
    homeScore: null,
    awayScore: null,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
  }
}
