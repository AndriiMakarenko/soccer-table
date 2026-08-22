import type { Season } from './models'
import { calculateSeasonStandings, isSeasonComplete } from './seasonStandings'

export type RosterSelectionResult =
  { success: true; names: string[] } | { success: false; message: string }

export interface RosterSelectionInput {
  sourceSeason: Season
  fromPosition: number
  toPosition: number
  draftNames?: readonly string[]
}

export function selectFinalizedRosterRange({
  sourceSeason,
  fromPosition,
  toPosition,
  draftNames = [],
}: RosterSelectionInput): RosterSelectionResult {
  if (!isSeasonComplete(sourceSeason)) {
    return {
      success: false,
      message: 'Only completed seasons can be used for roster imports.',
    }
  }

  if (!Number.isInteger(fromPosition) || !Number.isInteger(toPosition)) {
    return { success: false, message: 'Positions must be whole numbers.' }
  }

  if (fromPosition < 1 || toPosition > sourceSeason.teams.length) {
    return {
      success: false,
      message: `Positions must be between 1 and ${sourceSeason.teams.length}.`,
    }
  }

  if (fromPosition > toPosition) {
    return {
      success: false,
      message: 'From position must not be greater than to position.',
    }
  }

  const teamNames = new Map(
    sourceSeason.teams.map((team) => [team.id, team.name]),
  )
  const rows = calculateSeasonStandings(sourceSeason, 'overall').rows
  const names = rows
    .slice(fromPosition - 1, toPosition)
    .map((row) => teamNames.get(row.teamId))

  if (names.some((name) => name === undefined)) {
    return {
      success: false,
      message: 'The source standings contain an unknown team.',
    }
  }

  const selectedNames = names as string[]
  const combinedNames = [...draftNames, ...selectedNames]
  if (combinedNames.length < 2 || combinedNames.length > 64) {
    return {
      success: false,
      message: 'Team count must be between 2 and 64.',
    }
  }

  const normalized = new Set<string>()
  const duplicates = new Set<string>()
  for (const name of combinedNames) {
    const key = name.trim().toLocaleLowerCase()
    if (normalized.has(key)) duplicates.add(name.trim())
    normalized.add(key)
  }

  if (duplicates.size > 0) {
    return {
      success: false,
      message: `Duplicate team names are not allowed: ${[...duplicates].join(', ')}`,
    }
  }

  return { success: true, names: selectedNames }
}
