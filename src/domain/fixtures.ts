import type { EntityId, Match, Team } from './models'
import { createId } from './identity'
import { validateLegCount, validateTeamCount } from './validation'

type FixtureIdFactory = () => EntityId
type Participant = EntityId | null

interface Pairing {
  firstTeamId: EntityId
  secondTeamId: EntityId
}

interface OrientedPairing {
  homeTeamId: EntityId
  awayTeamId: EntityId
}

interface TeamAppearance {
  pairingIndex: number
  isFirstTeam: boolean
}

export function generateRoundRobinFixtures(
  teams: readonly Team[],
  legCount: number,
  createFixtureId: FixtureIdFactory = createId,
): Match[] {
  assertValidInput(teams, legCount)

  const rounds = balanceHomeAndAway(
    createSingleLegRounds(teams.map(({ id }) => id)),
    teams.map(({ id }) => id),
  )

  return Array.from({ length: legCount }, (_, legIndex) => {
    const reverseHomeAndAway = legIndex % 2 === 1
    const legRounds = reverseHomeAndAway ? [...rounds].reverse() : rounds

    return legRounds.flatMap((pairings, roundIndex) =>
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
        firstTeamId: reversePair ? second : first,
        secondTeamId: reversePair ? first : second,
      })
    }

    rounds.push(pairings)
    rotateParticipants(participants)
  }

  return rounds
}

function balanceHomeAndAway(
  rounds: readonly Pairing[][],
  teamIds: readonly EntityId[],
): OrientedPairing[][] {
  const pairings = rounds.flat()
  const firstTeamIsHome = pairings.map(
    (_, pairingIndex) => pairingIndex % 2 === 0,
  )
  const appearances = new Map<EntityId, TeamAppearance[]>()

  for (const teamId of teamIds) {
    appearances.set(teamId, [])
  }

  pairings.forEach((pairing, pairingIndex) => {
    appearances.get(pairing.firstTeamId)?.push({
      pairingIndex,
      isFirstTeam: true,
    })
    appearances.get(pairing.secondTeamId)?.push({
      pairingIndex,
      isFirstTeam: false,
    })
  })

  const teamCost = (teamId: EntityId): number => {
    const venues = (appearances.get(teamId) ?? []).map(
      ({ pairingIndex, isFirstTeam }) =>
        firstTeamIsHome[pairingIndex] === isFirstTeam,
    )
    let cost = 0

    for (let index = 1; index < venues.length; index += 1) {
      if (venues[index] === venues[index - 1]) {
        cost += 1
      }
      if (
        index >= 2 &&
        venues[index] === venues[index - 1] &&
        venues[index] === venues[index - 2]
      ) {
        cost += 1_000
      }
    }

    return cost
  }

  const costs = new Map(teamIds.map((teamId) => [teamId, teamCost(teamId)]))
  const maximumRepairCount = Math.max(1, pairings.length * 10)

  for (
    let repairCount = 0;
    repairCount < maximumRepairCount;
    repairCount += 1
  ) {
    const violation = findVenueRunViolation(
      teamIds,
      appearances,
      firstTeamIsHome,
    )
    if (violation == null) {
      return orientRounds(rounds, firstTeamIsHome)
    }

    const candidates = [...new Set(violation)]
    let bestCandidate: number | null = null
    let bestDelta = Number.POSITIVE_INFINITY

    for (const pairingIndex of candidates) {
      const pairing = getPairing(pairings, pairingIndex)
      const currentCost =
        (costs.get(pairing.firstTeamId) ?? 0) +
        (costs.get(pairing.secondTeamId) ?? 0)
      firstTeamIsHome[pairingIndex] = !firstTeamIsHome[pairingIndex]
      const updatedCost =
        teamCost(pairing.firstTeamId) + teamCost(pairing.secondTeamId)
      firstTeamIsHome[pairingIndex] = !firstTeamIsHome[pairingIndex]

      if (updatedCost - currentCost < bestDelta) {
        bestCandidate = pairingIndex
        bestDelta = updatedCost - currentCost
      }
    }

    const fallbackCandidate = candidates[repairCount % candidates.length]
    if (fallbackCandidate == null) {
      throw new Error('Invalid empty venue-run violation')
    }
    const pairingIndex =
      bestDelta < 0 && bestCandidate != null ? bestCandidate : fallbackCandidate
    const pairing = getPairing(pairings, pairingIndex)
    firstTeamIsHome[pairingIndex] = !firstTeamIsHome[pairingIndex]
    costs.set(pairing.firstTeamId, teamCost(pairing.firstTeamId))
    costs.set(pairing.secondTeamId, teamCost(pairing.secondTeamId))
  }

  throw new Error('Unable to balance fixture home and away assignments')
}

function getPairing(
  pairings: readonly Pairing[],
  pairingIndex: number,
): Pairing {
  const pairing = pairings[pairingIndex]
  if (pairing == null) {
    throw new Error('Invalid fixture pairing index')
  }

  return pairing
}

function findVenueRunViolation(
  teamIds: readonly EntityId[],
  appearances: ReadonlyMap<EntityId, readonly TeamAppearance[]>,
  firstTeamIsHome: readonly boolean[],
): number[] | null {
  for (const teamId of teamIds) {
    const teamAppearances = appearances.get(teamId) ?? []
    for (let index = 2; index < teamAppearances.length; index += 1) {
      const recentAppearances = teamAppearances.slice(index - 2, index + 1)
      const venues = recentAppearances.map(
        ({ pairingIndex, isFirstTeam }) =>
          firstTeamIsHome[pairingIndex] === isFirstTeam,
      )

      if (venues.every((venue) => venue === venues[0])) {
        return recentAppearances.map(({ pairingIndex }) => pairingIndex)
      }
    }
  }

  return null
}

function orientRounds(
  rounds: readonly Pairing[][],
  firstTeamIsHome: readonly boolean[],
): OrientedPairing[][] {
  let pairingIndex = 0

  return rounds.map((round) =>
    round.map((pairing) => {
      const firstIsHome = firstTeamIsHome[pairingIndex]
      pairingIndex += 1

      return {
        homeTeamId: firstIsHome ? pairing.firstTeamId : pairing.secondTeamId,
        awayTeamId: firstIsHome ? pairing.secondTeamId : pairing.firstTeamId,
      }
    }),
  )
}

function rotateParticipants(participants: Participant[]): void {
  const last = participants.pop()
  if (last !== undefined) {
    participants.splice(1, 0, last)
  }
}

function createMatch(
  pairing: OrientedPairing,
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
