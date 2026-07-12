export type EntityId = string

export type TableMode = 'overall' | 'home' | 'away'

export interface Team {
  id: EntityId
  name: string
}

export interface Match {
  id: EntityId
  leg: number
  round: number
  homeTeamId: EntityId
  awayTeamId: EntityId
  homeScore: number | null
  awayScore: number | null
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
}

export interface RandomTiebreakerLock {
  teamIds: EntityId[]
  orderedTeamIds: EntityId[]
}

export interface Season {
  id: EntityId
  leagueId: EntityId
  name: string
  teams: Team[]
  matches: Match[]
  legCount: number
  randomTiebreakerLocks: RandomTiebreakerLock[]
  createdAt: string
  updatedAt: string
}

export interface League {
  id: EntityId
  name: string
  createdAt: string
  updatedAt: string
}

export interface AppState {
  leagues: League[]
  seasons: Season[]
}

export function createEmptyAppState(): AppState {
  return {
    leagues: [],
    seasons: [],
  }
}
