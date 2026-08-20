import { describe, expect, it, vi } from 'vitest'

import type { AppState } from '@/domain/models'

import { NativePersistenceError } from './tauriPersistence'
import {
  createFailingPersistenceAdapter,
  createMemoryPersistenceAdapter,
  createTauriPersistenceAdapter,
} from './storage'

const state: AppState = {
  leagues: [
    {
      id: 'league-1',
      name: 'Premier League',
      createdAt: '2026-08-18T10:00:00.000Z',
      updatedAt: '2026-08-18T10:00:00.000Z',
    },
  ],
  seasons: [],
}

describe('asynchronous persistence adapters', () => {
  /**
   * GIVEN a native persistence command service
   * WHEN application state is loaded and saved
   * THEN the asynchronous adapter delegates without browser storage
   */
  it('uses the typed native bridge for production persistence', async () => {
    const native = {
      initialize: vi.fn().mockResolvedValue({ success: true as const }),
      load: vi.fn().mockResolvedValue(state),
      persist: vi.fn().mockResolvedValue({ success: true as const }),
    }
    const adapter = createTauriPersistenceAdapter(native)

    await expect(adapter.load()).resolves.toEqual(state)
    await expect(adapter.save(state)).resolves.toEqual({ success: true })
    expect(native.persist).toHaveBeenCalledWith(state)
  })

  /**
   * GIVEN an injected in-memory persistence adapter
   * WHEN a state is saved and then loaded
   * THEN tests receive an isolated copy without requiring a native window
   */
  it('supports isolated in-memory hydration and writes', async () => {
    const adapter = createMemoryPersistenceAdapter()
    await adapter.save(state)

    const loaded = await adapter.load()
    loaded.leagues[0]!.name = 'Changed only in caller'

    expect(adapter.state()).toEqual(state)
  })

  /**
   * GIVEN SQLite reports a disk-full failure
   * WHEN the renderer saves accepted edits
   * THEN the adapter returns an accurate stable failure contract
   */
  it('maps native database failures without browser quota wording', async () => {
    const adapter = createTauriPersistenceAdapter({
      initialize: vi.fn(),
      load: vi.fn(),
      persist: vi
        .fn()
        .mockRejectedValue(
          new NativePersistenceError('disk-full', 'The database disk is full.'),
        ),
    })

    await expect(adapter.save(state)).resolves.toEqual({
      success: false,
      reason: 'disk-full',
      message: 'The database disk is full.',
    })
  })

  /**
   * GIVEN a component test needs deterministic host failure behavior
   * WHEN its failing adapter is loaded or saved
   * THEN no Tauri command or real database is required
   */
  it('supplies an injectable failing adapter', async () => {
    const adapter = createFailingPersistenceAdapter()

    await expect(adapter.load()).rejects.toBeInstanceOf(NativePersistenceError)
    await expect(adapter.save(state)).resolves.toMatchObject({ success: false })
  })
})
