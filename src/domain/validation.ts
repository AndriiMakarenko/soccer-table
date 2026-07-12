export const MIN_TEAM_COUNT = 2
export const MAX_TEAM_COUNT = 64
export const MIN_LEG_COUNT = 1
export const MAX_LEG_COUNT = 4

export type ValidationResult<T> =
  { valid: true; value: T } | { valid: false; error: string }

function valid<T>(value: T): ValidationResult<T> {
  return { valid: true, value }
}

function invalid<T>(error: string): ValidationResult<T> {
  return { valid: false, error }
}

export function validateName(
  value: unknown,
  label = 'Name',
): ValidationResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalid(`${label} is required`)
  }

  return valid(value.trim())
}

export function validateNonNegativeInteger(
  value: unknown,
  label = 'Value',
): ValidationResult<number> {
  const normalized = normalizeNumber(value)

  if (
    normalized === null ||
    !Number.isSafeInteger(normalized) ||
    normalized < 0
  ) {
    return invalid(`${label} must be a non-negative integer`)
  }

  return valid(normalized)
}

export function validateScore(
  value: unknown,
  label = 'Score',
): ValidationResult<number | null> {
  if (value === null || value === undefined || value === '') {
    return valid(null)
  }

  return validateNonNegativeInteger(value, label)
}

export function validateCardCount(
  value: unknown,
  label = 'Card count',
): ValidationResult<number> {
  if (value === null || value === undefined || value === '') {
    return valid(0)
  }

  return validateNonNegativeInteger(value, label)
}

export function validateTeamCount(value: unknown): ValidationResult<number> {
  const result = validateNonNegativeInteger(value, 'Team count')

  if (!result.valid) {
    return result
  }

  if (result.value < MIN_TEAM_COUNT || result.value > MAX_TEAM_COUNT) {
    return invalid(
      `Team count must be between ${MIN_TEAM_COUNT} and ${MAX_TEAM_COUNT}`,
    )
  }

  return result
}

export function validateLegCount(value: unknown): ValidationResult<number> {
  const result = validateNonNegativeInteger(value, 'Leg count')

  if (!result.valid) {
    return result
  }

  if (result.value < MIN_LEG_COUNT || result.value > MAX_LEG_COUNT) {
    return invalid(
      `Leg count must be between ${MIN_LEG_COUNT} and ${MAX_LEG_COUNT}`,
    )
  }

  return result
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value)
  }

  return null
}
