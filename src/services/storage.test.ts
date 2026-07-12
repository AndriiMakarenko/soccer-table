import { describe, expect, it, vi } from 'vitest'

import type { AppState } from '@/domain/models'

import {
  createPersistenceService,
  STORAGE_FULL_MESSAGE,
  STORAGE_KEY,
  STORAGE_VERSION,
} from './storage'

const populatedState: AppState = {
  leagues: [
    {
      id: 'league-1',
      name: 'Premier League',
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:00:00.000Z',
    },
  ],
  seasons: [
    {
      id: 'season-1',
      leagueId: 'league-1',
      name: '2026/27',
      teams: [
        { id: 'team-1', name: 'North United' },
        { id: 'team-2', name: 'South City' },
      ],
      matches: [
        {
          id: 'match-1',
          leg: 1,
          round: 1,
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          homeScore: null,
          awayScore: null,
          homeYellowCards: 0,
          awayYellowCards: 0,
          homeRedCards: 0,
          awayRedCards: 0,
        },
      ],
      legCount: 1,
      randomTiebreakerLocks: [
        {
          mode: 'overall',
          teamIds: ['team-1', 'team-2'],
          orderedTeamIds: ['team-2', 'team-1'],
        },
      ],
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:00:00.000Z',
    },
  ],
}

describe('localStorage persistence service', () => {
  /**
   * GIVEN a valid populated application state
   * WHEN the state is saved and loaded through the persistence service
   * THEN it is stored in a versioned envelope and returned unchanged
   */
  it('saves and loads typed application state under the versioned key', () => {
    const storage = createStorageMock()
    const service = createPersistenceService(storage)

    expect(service.save(populatedState)).toEqual({ success: true })
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toEqual({
      version: STORAGE_VERSION,
      state: populatedState,
    })
    expect(service.load()).toEqual(populatedState)
  })

  /**
   * GIVEN browser storage contains no saved application data
   * WHEN the persistence service loads the application state
   * THEN it returns a safe empty state
   */
  it('returns an empty state when no saved data exists', () => {
    const service = createPersistenceService(createStorageMock())

    expect(service.load()).toEqual({ leagues: [], seasons: [] })
  })

  /**
   * GIVEN browser storage contains corrupted, incompatible, or invalid data
   * WHEN the persistence service loads the application state
   * THEN it returns a safe empty state without crashing
   */
  it.each([
    ['invalid JSON', '{not-json'],
    [
      'an unsupported version',
      JSON.stringify({ version: 999, state: populatedState }),
    ],
    [
      'an invalid state shape',
      JSON.stringify({
        version: STORAGE_VERSION,
        state: { leagues: 'invalid' },
      }),
    ],
  ])('returns an empty state for %s', (_description, storedValue) => {
    const storage = createStorageMock()
    storage.setItem(STORAGE_KEY, storedValue)
    const service = createPersistenceService(storage)

    expect(service.load()).toEqual({ leagues: [], seasons: [] })
  })

  /**
   * GIVEN browser storage throws an error while being read
   * WHEN the persistence service loads the application state
   * THEN it returns a safe empty state without propagating the error
   */
  it('returns an empty state when localStorage cannot be read', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
      setItem: vi.fn(),
    }

    expect(createPersistenceService(storage).load()).toEqual({
      leagues: [],
      seasons: [],
    })
  })

  /**
   * GIVEN browser storage is full and rejects a write with a quota error
   * WHEN the persistence service saves application state
   * THEN it reports a quota failure with the required user-facing message
   */
  it('reports quota failures with the required user-facing message', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Storage is full', 'QuotaExceededError')
      }),
    }

    expect(createPersistenceService(storage).save(populatedState)).toEqual({
      success: false,
      reason: 'quota-exceeded',
      message: STORAGE_FULL_MESSAGE,
    })
  })

  /**
   * GIVEN browser storage rejects a write for a reason other than quota
   * WHEN the persistence service saves application state
   * THEN it reports a storage failure instead of reporting success
   */
  it('does not report other write failures as successful', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
    }

    expect(
      createPersistenceService(storage).save(populatedState),
    ).toMatchObject({
      success: false,
      reason: 'storage-error',
    })
  })
})

function createStorageMock(): Pick<Storage, 'getItem' | 'setItem'> {
  const entries = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
  }
}
