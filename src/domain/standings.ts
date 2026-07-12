import type { EntityId, Match, TableMode, Team } from './models'

export interface StandingsRow {
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

  return {
    rows,
    averageTotal:
      totalPlayed === 0 ? 'N/A' : ((totalScored / totalPlayed) * 2).toFixed(2),
  }
}

function createEmptyRow(team: Team): StandingsRow {
  return {
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
