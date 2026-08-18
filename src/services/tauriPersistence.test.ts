import { describe, expect, it, vi } from 'vitest'

import type { AppState, Match } from '@/domain/models'

import {
  createNativePersistenceService,
  NativePersistenceError,
} from './tauriPersistence'

const emptyState: AppState = { leagues: [], seasons: [] }
const fixture: Match = {
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
}

describe('Tauri persistence command bridge', () => {
  /**
   * GIVEN the native host exposes the allowlisted persistence commands
   * WHEN each renderer persistence operation is dispatched
   * THEN it invokes only the matching command with its owned typed request envelope
   */
  it('dispatches every persistence operation through its narrow command', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    invoke.mockResolvedValueOnce(emptyState)
    const service = createNativePersistenceService(invoke)
    const update = {
      matchId: fixture.id,
      homeScore: 2,
      awayScore: 1,
      homeYellowCards: 0,
      awayYellowCards: 1,
      homeRedCards: 0,
      awayRedCards: 0,
    }

    await service.load()
    await service.persist(emptyState)
    await service.deleteLeague('league-1')
    await service.deleteSeason('season-1')
    await service.regenerateFixtures('season-1', [fixture])
    await service.updateRoundResults({
      seasonId: 'season-1',
      leg: 1,
      round: 1,
      updates: [update],
    })
    await service.resetResults('season-1')

    expect(invoke.mock.calls).toEqual([
      ['load_app_state', undefined],
      ['persist_app_state', { request: { state: emptyState } }],
      ['delete_league', { request: { id: 'league-1' } }],
      ['delete_season', { request: { id: 'season-1' } }],
      [
        'regenerate_fixtures',
        { request: { seasonId: 'season-1', matches: [fixture] } },
      ],
      [
        'update_round_results',
        {
          request: {
            seasonId: 'season-1',
            leg: 1,
            round: 1,
            updates: [update],
          },
        },
      ],
      ['reset_results', { request: { id: 'season-1' } }],
    ])
  })

  /**
   * GIVEN the Rust command rejects a malformed payload with a serialized validation error
   * WHEN the renderer receives that rejection
   * THEN it preserves the stable code and actionable native message
   */
  it('preserves serialized native validation errors', async () => {
    const service = createNativePersistenceService(
      vi.fn().mockRejectedValue({
        code: 'validation',
        message: 'league id must not be empty',
      }),
    )

    await expect(service.deleteLeague('')).rejects.toMatchObject({
      name: 'NativePersistenceError',
      code: 'validation',
      message: 'league id must not be empty',
    })
  })

  /**
   * GIVEN the application runs without the allowlisted native command bridge
   * WHEN a persistence command is invoked
   * THEN the service reports an explicit bridge-unavailable error
   */
  it('reports unavailable commands without leaking low-level host details', async () => {
    const service = createNativePersistenceService(
      vi.fn().mockRejectedValue('Command load_app_state not found'),
    )

    await expect(service.load()).rejects.toEqual(
      expect.objectContaining({
        code: 'bridge-unavailable',
        message: expect.stringContaining(
          'Launch the application through Tauri',
        ),
      }),
    )
  })

  /**
   * GIVEN the native invoke implementation throws an unexpected exception
   * WHEN a persistence operation is attempted
   * THEN the service returns a stable native-exception without exposing the exception text
   */
  it('normalizes unexpected native exceptions', async () => {
    const service = createNativePersistenceService(
      vi.fn().mockRejectedValue(new Error('sensitive native detail')),
    )

    const error = await service
      .persist(emptyState)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(NativePersistenceError)
    expect(error).toMatchObject({
      code: 'native-exception',
      message:
        'The desktop host could not complete the persistence operation. Try again.',
    })
  })

  /**
   * GIVEN the renderer bridge service is used by application code
   * WHEN its public surface is inspected
   * THEN it exposes no filesystem, shell, SQL, script, or navigation escape hatch
   */
  it('keeps the renderer persistence boundary application-oriented', () => {
    const service = createNativePersistenceService(vi.fn())

    expect(Object.keys(service).sort()).toEqual([
      'deleteLeague',
      'deleteSeason',
      'load',
      'persist',
      'regenerateFixtures',
      'resetResults',
      'updateRoundResults',
    ])
  })
})
