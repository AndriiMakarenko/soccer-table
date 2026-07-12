import { describe, expect, it } from 'vitest'

import {
  validateCardCount,
  validateLegCount,
  validateName,
  validateNonNegativeInteger,
  validateScore,
  validateTeamCount,
} from './validation'

describe('name validation', () => {
  /**
   * GIVEN a non-empty name with surrounding whitespace
   * WHEN validateName is called
   * THEN it returns the trimmed name as valid
   */
  it('trims a valid name', () => {
    expect(validateName('  Premier League  ')).toEqual({
      valid: true,
      value: 'Premier League',
    })
  })

  /**
   * GIVEN an empty, whitespace-only, null, or non-string name
   * WHEN validateName is called
   * THEN it returns a required-name validation error
   */
  it.each([[''], ['   '], [null], [42]])('rejects %j', (value) => {
    expect(validateName(value)).toEqual({
      valid: false,
      error: 'Name is required',
    })
  })
})

describe('non-negative integer validation', () => {
  /**
   * GIVEN zero, a positive integer, or an integer-formatted string
   * WHEN validateNonNegativeInteger is called
   * THEN it returns the normalized number as valid
   */
  it.each([
    [0, 0],
    [12, 12],
    [' 7 ', 7],
  ])('accepts %j as %i', (value, expected) => {
    expect(validateNonNegativeInteger(value)).toEqual({
      valid: true,
      value: expected,
    })
  })

  /**
   * GIVEN a negative, fractional, non-finite, empty, or non-numeric value
   * WHEN validateNonNegativeInteger is called
   * THEN it returns an invalid result
   */
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '', '2.5', 'goals'])(
    'rejects %j',
    (value) => {
      expect(validateNonNegativeInteger(value).valid).toBe(false)
    },
  )
})

describe('score and card validation', () => {
  /**
   * GIVEN a null, undefined, or empty score
   * WHEN validateScore is called
   * THEN it returns null as a valid unplayed score
   */
  it.each([null, undefined, ''])(
    'normalizes empty score %j to null',
    (value) => {
      expect(validateScore(value)).toEqual({ valid: true, value: null })
    },
  )

  /**
   * GIVEN a score value of zero
   * WHEN validateScore is called
   * THEN it returns numeric zero as a valid played score
   */
  it('accepts zero as a played score', () => {
    expect(validateScore('0')).toEqual({ valid: true, value: 0 })
  })

  /**
   * GIVEN an empty card-count value
   * WHEN validateCardCount is called
   * THEN it returns zero as the valid default card count
   */
  it('defaults an empty card count to zero', () => {
    expect(validateCardCount('')).toEqual({ valid: true, value: 0 })
  })

  /**
   * GIVEN a negative, fractional, or non-numeric value
   * WHEN score and card-count validation are performed
   * THEN both validators reject the value
   */
  it.each([-1, 0.5, 'red'])(
    'rejects invalid score and card count %j',
    (value) => {
      expect(validateScore(value).valid).toBe(false)
      expect(validateCardCount(value).valid).toBe(false)
    },
  )
})

describe('team-count validation', () => {
  /**
   * GIVEN a team count at the supported lower or upper boundary
   * WHEN validateTeamCount is called
   * THEN it accepts the count as valid
   */
  it.each([2, 64])('accepts boundary value %i', (value) => {
    expect(validateTeamCount(value)).toEqual({ valid: true, value })
  })

  /**
   * GIVEN an out-of-range, fractional, or non-numeric team count
   * WHEN validateTeamCount is called
   * THEN it returns an invalid result
   */
  it.each([1, 65, 2.5, 'many'])('rejects %j', (value) => {
    expect(validateTeamCount(value).valid).toBe(false)
  })
})

describe('leg-count validation', () => {
  /**
   * GIVEN a leg count at the supported lower or upper boundary
   * WHEN validateLegCount is called
   * THEN it accepts the count as valid
   */
  it.each([1, 4])('accepts boundary value %i', (value) => {
    expect(validateLegCount(value)).toEqual({ valid: true, value })
  })

  /**
   * GIVEN an out-of-range, fractional, or non-numeric leg count
   * WHEN validateLegCount is called
   * THEN it returns an invalid result
   */
  it.each([0, 5, 1.5, 'several'])('rejects %j', (value) => {
    expect(validateLegCount(value).valid).toBe(false)
  })
})
