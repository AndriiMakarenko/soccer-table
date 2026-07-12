import type { EntityId, Match, TableMode, Team } from './models'

export interface StandingsRow {
  position: number
  teamId: EntityId
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  scoredFor: number
  scoredAgainst: number
  scoreDifference: number
  points: number
  penaltyPoints: number
}

export interface StandingsCalculation {
  rows: StandingsRow[]
  averageTotal: string
}

export function calculateStandings(
  teams: readonly Team[],
  matches: readonly Match[],
  mode: TableMode = 'overall',
): StandingsCalculation {
  const rows = teams.map(createEmptyRow)
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row]))

  for (const match of matches) {
    if (!isPlayed(match)) {
      continue
    }

    if (mode !== 'away') {
      applyResult(
        requireTeamRow(rowsByTeamId, match.homeTeamId),
        match.homeScore,
        match.awayScore,
        match.homeYellowCards,
        match.homeRedCards,
      )
    }

    if (mode !== 'home') {
      applyResult(
        requireTeamRow(rowsByTeamId, match.awayTeamId),
        match.awayScore,
        match.homeScore,
        match.awayYellowCards,
        match.awayRedCards,
      )
    }
  }

  const totalPlayed = rows.reduce((total, row) => total + row.played, 0)
  const totalScored = rows.reduce((total, row) => total + row.scoredFor, 0)
  const rankedRows = rankRows(rows, matches, mode)

  return {
    rows: rankedRows,
    averageTotal:
      totalPlayed === 0 ? 'N/A' : ((totalScored / totalPlayed) * 2).toFixed(2),
  }
}

function createEmptyRow(team: Team): StandingsRow {
  return {
    position: 0,
    teamId: team.id,
    teamName: team.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    scoredFor: 0,
    scoredAgainst: 0,
    scoreDifference: 0,
    points: 0,
    penaltyPoints: 0,
  }
}

interface HeadToHeadRecord {
  points: number
  scoredFor: number
}

interface RankedRow {
  row: StandingsRow
  headToHead: HeadToHeadRecord
}

function rankRows(
  rows: StandingsRow[],
  matches: readonly Match[],
  mode: TableMode,
): StandingsRow[] {
  const rankedRows: RankedRow[] = []
  const primaryGroups = new Map<string, StandingsRow[]>()

  for (const row of rows) {
    const key = `${row.points}:${row.scoreDifference}`
    const group = primaryGroups.get(key) ?? []
    group.push(row)
    primaryGroups.set(key, group)
  }

  for (const group of primaryGroups.values()) {
    const headToHead = calculateHeadToHead(group, matches, mode)
    rankedRows.push(
      ...group.map((row) => ({
        row,
        headToHead: requireHeadToHeadRecord(headToHead, row.teamId),
      })),
    )
  }

  rankedRows.sort(compareRankedRows)
  let previous: RankedRow | undefined
  let position = 0

  return rankedRows.map((rankedRow, index) => {
    if (!previous || compareRankedRows(rankedRow, previous) !== 0) {
      position = index + 1
    }
    previous = rankedRow

    return { ...rankedRow.row, position }
  })
}

function calculateHeadToHead(
  tiedRows: readonly StandingsRow[],
  matches: readonly Match[],
  mode: TableMode,
): Map<EntityId, HeadToHeadRecord> {
  const tiedTeamIds = new Set(tiedRows.map((row) => row.teamId))
  const records = new Map(
    tiedRows.map((row) => [row.teamId, { points: 0, scoredFor: 0 }]),
  )

  for (const match of matches) {
    if (
      !isPlayed(match) ||
      !tiedTeamIds.has(match.homeTeamId) ||
      !tiedTeamIds.has(match.awayTeamId)
    ) {
      continue
    }

    if (mode !== 'away') {
      applyHeadToHeadResult(
        requireHeadToHeadRecord(records, match.homeTeamId),
        match.homeScore,
        match.awayScore,
      )
    }

    if (mode !== 'home') {
      applyHeadToHeadResult(
        requireHeadToHeadRecord(records, match.awayTeamId),
        match.awayScore,
        match.homeScore,
      )
    }
  }

  return records
}

function applyHeadToHeadResult(
  record: HeadToHeadRecord,
  scoreFor: number,
  scoreAgainst: number,
): void {
  record.scoredFor += scoreFor
  record.points +=
    scoreFor > scoreAgainst ? 3 : scoreFor === scoreAgainst ? 1 : 0
}

function compareRankedRows(left: RankedRow, right: RankedRow): number {
  return (
    right.row.points - left.row.points ||
    right.row.scoreDifference - left.row.scoreDifference ||
    right.headToHead.points - left.headToHead.points ||
    right.headToHead.scoredFor - left.headToHead.scoredFor ||
    right.row.scoredFor - left.row.scoredFor ||
    left.row.penaltyPoints - right.row.penaltyPoints
  )
}

function requireHeadToHeadRecord(
  records: ReadonlyMap<EntityId, HeadToHeadRecord>,
  teamId: EntityId,
): HeadToHeadRecord {
  const record = records.get(teamId)
  if (!record) {
    throw new Error(`Missing head-to-head record for team: ${teamId}`)
  }

  return record
}

function isPlayed(
  match: Match,
): match is Match & { homeScore: number; awayScore: number } {
  return match.homeScore !== null && match.awayScore !== null
}

function applyResult(
  row: StandingsRow,
  scoreFor: number,
  scoreAgainst: number,
  yellowCards: number,
  redCards: number,
): void {
  row.played += 1
  row.scoredFor += scoreFor
  row.scoredAgainst += scoreAgainst
  row.scoreDifference = row.scoredFor - row.scoredAgainst
  row.penaltyPoints += yellowCards + redCards * 3

  if (scoreFor > scoreAgainst) {
    row.won += 1
    row.points += 3
  } else if (scoreFor === scoreAgainst) {
    row.drawn += 1
    row.points += 1
  } else {
    row.lost += 1
  }
}

function requireTeamRow(
  rowsByTeamId: ReadonlyMap<EntityId, StandingsRow>,
  teamId: EntityId,
): StandingsRow {
  const row = rowsByTeamId.get(teamId)
  if (!row) {
    throw new Error(`Match references unknown team: ${teamId}`)
  }

  return row
}
