import type {
  EntityId,
  RandomTiebreakerLock,
  Season,
  TableMode,
} from './models'
import {
  calculateStandings,
  type StandingsCalculation,
  type StandingsRow,
} from './standings'

const TABLE_MODES: readonly TableMode[] = ['overall', 'home', 'away']

export interface SeasonStandingsCalculation extends StandingsCalculation {
  isComplete: boolean
  randomTiebreakerLocks: RandomTiebreakerLock[]
}

export function isSeasonComplete(season: Pick<Season, 'matches'>): boolean {
  return (
    season.matches.length > 0 &&
    season.matches.every(
      (match) => match.homeScore !== null && match.awayScore !== null,
    )
  )
}

export function calculateSeasonStandings(
  season: Season,
  mode: TableMode = 'overall',
  random: () => number = Math.random,
): SeasonStandingsCalculation {
  const calculations = new Map(
    TABLE_MODES.map((tableMode) => [
      tableMode,
      calculateStandings(season.teams, season.matches, tableMode),
    ]),
  )
  const isComplete = isSeasonComplete(season)

  if (!isComplete) {
    const calculation = requireCalculation(calculations, mode)
    return { ...calculation, isComplete, randomTiebreakerLocks: [] }
  }

  const locks = TABLE_MODES.flatMap((tableMode) =>
    reconcileModeLocks(
      tableMode,
      requireCalculation(calculations, tableMode).rows,
      season.randomTiebreakerLocks,
      random,
    ),
  )
  const calculation = requireCalculation(calculations, mode)

  return {
    ...calculation,
    rows: applyLocks(calculation.rows, locks, mode),
    isComplete,
    randomTiebreakerLocks: locks,
  }
}

function reconcileModeLocks(
  mode: TableMode,
  rows: readonly StandingsRow[],
  existingLocks: readonly RandomTiebreakerLock[],
  random: () => number,
): RandomTiebreakerLock[] {
  return unresolvedGroups(rows).map((teamIds) => {
    const existingLock = existingLocks.find(
      (lock) => mode === lock.mode && sameTeamSet(lock.teamIds, teamIds),
    )

    if (existingLock && sameTeamSet(existingLock.orderedTeamIds, teamIds)) {
      return existingLock
    }

    return {
      mode,
      teamIds: [...teamIds].sort(),
      orderedTeamIds: shuffle(teamIds, random),
    }
  })
}

function unresolvedGroups(rows: readonly StandingsRow[]): EntityId[][] {
  const groups = new Map<number, EntityId[]>()

  for (const row of rows) {
    const group = groups.get(row.position) ?? []
    group.push(row.teamId)
    groups.set(row.position, group)
  }

  return [...groups.values()].filter((group) => group.length > 1)
}

function applyLocks(
  rows: readonly StandingsRow[],
  locks: readonly RandomTiebreakerLock[],
  mode: TableMode,
): StandingsRow[] {
  const orderByTeamId = new Map<EntityId, number>()

  for (const lock of locks) {
    if (lock.mode !== mode) continue
    lock.orderedTeamIds.forEach((teamId, index) =>
      orderByTeamId.set(teamId, index),
    )
  }

  return [...rows]
    .sort((left, right) => {
      if (left.position !== right.position)
        return left.position - right.position
      return (
        (orderByTeamId.get(left.teamId) ?? 0) -
        (orderByTeamId.get(right.teamId) ?? 0)
      )
    })
    .map((row, index) => ({ ...row, position: index + 1 }))
}

function shuffle(
  teamIds: readonly EntityId[],
  random: () => number,
): EntityId[] {
  const shuffled = [...teamIds]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!]
  }

  return shuffled
}

function sameTeamSet(
  left: readonly EntityId[],
  right: readonly EntityId[],
): boolean {
  return (
    left.length === right.length &&
    [...left]
      .sort()
      .every((teamId, index) => teamId === [...right].sort()[index])
  )
}

function requireCalculation(
  calculations: ReadonlyMap<TableMode, StandingsCalculation>,
  mode: TableMode,
): StandingsCalculation {
  const calculation = calculations.get(mode)
  if (!calculation)
    throw new Error(`Missing standings calculation for mode: ${mode}`)
  return calculation
}
