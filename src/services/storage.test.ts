import { describe, expect, it, vi } from 'vitest'

import type { AppState } from '@/domain/models'

import {
  createBrowserPersistenceAdapter,
  STORAGE_FULL_MESSAGE,
  STORAGE_KEY,
  STORAGE_SAVE_ERROR_MESSAGE,
  STORAGE_VERSION,
} from './browserPersistence'
import { NativePersistenceError } from './tauriPersistence'
import {
  createFailingPersistenceAdapter,
  createMemoryPersistenceAdapter,
  createTauriPersistenceAdapter,
} from './tauriPersistenceAdapter'

const populatedState: AppState = {
  leagues: [
    {
      id: 'league-1',
      name: 'Premier League',
      createdAt: '2026-08-18T10:00:00.000Z',
      updatedAt: '2026-08-18T10:00:00.000Z',
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
          homeScore: 2,
          awayScore: 1,
          homeYellowCards: 3,
          awayYellowCards: 1,
          homeRedCards: 0,
          awayRedCards: 1,
        },
      ],
      legCount: 1,
      randomTiebreakerLocks: [
        {
          mode: 'away',
          teamIds: ['team-1', 'team-2'],
          orderedTeamIds: ['team-2', 'team-1'],
        },
      ],
      createdAt: '2026-08-18T10:00:00.000Z',
      updatedAt: '2026-08-18T10:00:00.000Z',
    },
  ],
}

describe('browser persistence adapter', () => {
  /**
   * GIVEN a valid complete application state
   * WHEN it is saved and loaded through the asynchronous browser adapter
   * THEN the versioned envelope restores every nested value unchanged
   */
  it('hydrates complete state across a simulated reload', async () => {
    const storage = createStorageMock()
    const firstLoad = createBrowserPersistenceAdapter(storage)

    await expect(firstLoad.save(populatedState)).resolves.toEqual({
      success: true,
    })
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toEqual({
      version: STORAGE_VERSION,
      state: populatedState,
    })

    const reloaded = createBrowserPersistenceAdapter(storage)
    await expect(reloaded.load()).resolves.toEqual(populatedState)
  })

  /**
   * GIVEN browser storage is missing, corrupt, incompatible, or structurally invalid
   * WHEN application hydration reads it
   * THEN a safe empty state is returned without throwing
   */
  it.each([
    ['missing data', null],
    ['invalid JSON', '{not-json'],
    [
      'an unsupported version',
      JSON.stringify({ version: 999, state: populatedState }),
    ],
    [
      'an invalid nested tiebreaker mode',
      JSON.stringify({
        version: STORAGE_VERSION,
        state: {
          ...populatedState,
          seasons: [
            {
              ...populatedState.seasons[0],
              randomTiebreakerLocks: [
                {
                  mode: 'invalid',
                  teamIds: [],
                  orderedTeamIds: [],
                },
              ],
            },
          ],
        },
      }),
    ],
  ])('returns empty state for %s', async (_description, storedValue) => {
    const storage = createStorageMock()
    if (storedValue !== null) storage.setItem(STORAGE_KEY, storedValue)

    await expect(
      createBrowserPersistenceAdapter(storage).load(),
    ).resolves.toEqual({ leagues: [], seasons: [] })
  })

  /**
   * GIVEN browser storage access is blocked by browser security settings
   * WHEN hydration attempts to read saved state
   * THEN startup receives a safe empty state instead of an exception
   */
  it('recovers safely from browser read failures', async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
      setItem: vi.fn(),
    }

    await expect(
      createBrowserPersistenceAdapter(storage).load(),
    ).resolves.toEqual({ leagues: [], seasons: [] })
  })

  /**
   * GIVEN browser storage is full
   * WHEN a valid state write is attempted
   * THEN the result identifies quota exhaustion with browser-specific guidance
   */
  it('reports quota failures accurately', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Storage is full', 'QuotaExceededError')
      }),
    }

    await expect(
      createBrowserPersistenceAdapter(storage).save(populatedState),
    ).resolves.toEqual({
      success: false,
      reason: 'quota-exceeded',
      message: STORAGE_FULL_MESSAGE,
    })
  })

  /**
   * GIVEN browser storage rejects a write for a non-quota reason
   * WHEN a valid state write is attempted
   * THEN the result gives browser-specific recovery guidance
   */
  it('reports non-quota browser failures accurately', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
    }

    await expect(
      createBrowserPersistenceAdapter(storage).save(populatedState),
    ).resolves.toEqual({
      success: false,
      reason: 'storage-error',
      message: STORAGE_SAVE_ERROR_MESSAGE,
    })
  })
})

describe('Tauri persistence adapter', () => {
  /**
   * GIVEN a native persistence command service
   * WHEN application state is loaded and saved
   * THEN the asynchronous adapter delegates only to the typed native bridge
   */
  it('uses the typed native bridge', async () => {
    const native = {
      initialize: vi.fn().mockResolvedValue({ success: true as const }),
      load: vi.fn().mockResolvedValue(populatedState),
      persist: vi.fn().mockResolvedValue({ success: true as const }),
    }
    const adapter = createTauriPersistenceAdapter(native)

    await expect(adapter.load()).resolves.toEqual(populatedState)
    await expect(adapter.save(populatedState)).resolves.toEqual({
      success: true,
    })
    expect(native.initialize).toHaveBeenCalledOnce()
    expect(native.persist).toHaveBeenCalledWith(populatedState)
  })

  /**
   * GIVEN Tauri database initialization fails before load
   * WHEN desktop hydration runs
   * THEN the native error propagates and browser persistence is never available as fallback
   */
  it('propagates Tauri startup failures without fallback', async () => {
    const native = {
      initialize: vi
        .fn()
        .mockRejectedValue(
          new NativePersistenceError('bridge-unavailable', 'No bridge.'),
        ),
      load: vi.fn(),
      persist: vi.fn(),
    }

    await expect(
      createTauriPersistenceAdapter(native).load(),
    ).rejects.toMatchObject({ code: 'bridge-unavailable' })
    expect(native.load).not.toHaveBeenCalled()
  })

  /**
   * GIVEN SQLite reports a disk-full failure
   * WHEN the renderer saves accepted edits
   * THEN the adapter returns the native failure without browser quota wording
   */
  it('maps native database failures without browser wording', async () => {
    const adapter = createTauriPersistenceAdapter({
      initialize: vi.fn(),
      load: vi.fn(),
      persist: vi
        .fn()
        .mockRejectedValue(
          new NativePersistenceError('disk-full', 'The database disk is full.'),
        ),
    })

    await expect(adapter.save(populatedState)).resolves.toEqual({
      success: false,
      reason: 'disk-full',
      message: 'The database disk is full.',
    })
  })

  /**
   * GIVEN an injected in-memory persistence adapter
   * WHEN a state is saved and its loaded copy is changed
   * THEN tests retain an isolated persisted copy without a native window
   */
  it('supports isolated in-memory hydration and writes', async () => {
    const adapter = createMemoryPersistenceAdapter()
    await adapter.save(populatedState)

    const loaded = await adapter.load()
    loaded.leagues[0]!.name = 'Changed only in caller'

    expect(adapter.state()).toEqual(populatedState)
  })

  /**
   * GIVEN a deterministic failing test adapter
   * WHEN it is loaded or saved
   * THEN it reproduces host failure behavior without a real database
   */
  it('supplies an injectable failing adapter', async () => {
    const adapter = createFailingPersistenceAdapter()

    await expect(adapter.load()).rejects.toBeInstanceOf(NativePersistenceError)
    await expect(adapter.save(populatedState)).resolves.toMatchObject({
      success: false,
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
