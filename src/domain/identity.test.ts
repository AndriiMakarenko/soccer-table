import { describe, expect, it } from 'vitest'

import { createId, createTimestamp } from './identity'

describe('identity helpers', () => {
  /**
   * GIVEN the application needs a new entity identifier
   * WHEN createId is called
   * THEN it returns a valid version 4 UUID
   */
  it('creates UUID identifiers', () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  /**
   * GIVEN a specific Date value
   * WHEN createTimestamp is called with that date
   * THEN it returns the corresponding ISO 8601 timestamp
   */
  it('creates ISO timestamps from an injectable date', () => {
    expect(createTimestamp(new Date('2026-07-12T09:10:11.000Z'))).toBe(
      '2026-07-12T09:10:11.000Z',
    )
  })
})
