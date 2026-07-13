import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { AppState, League, Match, Season } from '@/domain/models'
import { persistenceService } from '@/services/storage'
import { useLeagueStore } from '@/stores/league'

import SeasonFixturesView from './SeasonFixturesView.vue'

const DestinationView = { template: '<h1>Destination</h1>' }

describe('season fixtures view', () => {
  let state: AppState

  beforeEach(() => {
    state = { leagues: [createLeague()], seasons: [createSeason()] }
    vi.spyOn(persistenceService, 'load').mockImplementation(() =>
      cloneState(state),
    )
    vi.spyOn(persistenceService, 'save').mockImplementation((nextState) => {
      state = cloneState(nextState)
      return { success: true }
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * GIVEN fixtures spanning multiple legs and rounds
   * WHEN the fixtures page is opened
   * THEN matches are grouped under ordered leg and round headings with centered scorelines
   */
  it('groups fixtures by leg and round', async () => {
    await renderView()

    expect(screen.getByRole('heading', { name: 'Leg 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leg 2' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Round 1' })).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Round 2' })).toBeInTheDocument()
    expect(
      screen.getByLabelText('Northside FC versus Riverside United'),
    ).toHaveTextContent('Northside FC—v—Riverside United')
    expect(screen.getByLabelText('Fixture progress')).toHaveTextContent(
      '1of 4 played',
    )
  })

  /**
   * GIVEN an unplayed round with card counts at their zero defaults
   * WHEN the user enters scores and cards and saves the round
   * THEN every value is persisted together and the completed-fixture tally updates
   */
  it('edits and saves round scores and card counts', async () => {
    await renderView()

    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit results for Round 1' })[0]!,
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Northside FC score' }),
      '3',
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Riverside United score' }),
      '2',
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', {
        name: 'Northside FC yellow cards',
      }),
      '2',
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', {
        name: 'Riverside United red cards',
      }),
      '1',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Save results for Round 1' }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Fixture progress')).toHaveTextContent(
        '2of 4 played',
      ),
    )
    expect(state.seasons[0]?.matches[0]).toMatchObject({
      homeScore: 3,
      awayScore: 2,
      homeYellowCards: 2,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 1,
    })
    expect(persistenceService.save).toHaveBeenCalledTimes(1)
  })

  /**
   * GIVEN a round whose stored results have not changed
   * WHEN a negative score is entered and save is requested
   * THEN a field-specific validation error is shown and no match is mutated or persisted
   */
  it('rejects invalid non-negative-integer values atomically', async () => {
    await renderView()

    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit results for Round 1' })[0]!,
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Northside FC score' }),
      '-1',
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Riverside United score' }),
      '4',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Save results for Round 1' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Northside FC score must be a non-negative integer',
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Northside FC score' }),
    ).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByRole('spinbutton', { name: 'Northside FC score' }),
    ).toHaveAccessibleDescription(
      'Northside FC score must be a non-negative integer',
    )
    expect(state.seasons[0]?.matches[0]).toMatchObject({
      homeScore: null,
      awayScore: null,
    })
    expect(persistenceService.save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN a played match with both scores filled
   * WHEN the user clears one score and saves the round
   * THEN that score becomes null and the match returns to the unplayed tally
   */
  it('clears a score back to null', async () => {
    await renderView()

    await fireEvent.click(
      screen.getByRole('button', { name: 'Edit results for Round 2' }),
    )
    const score = screen.getByRole('spinbutton', { name: 'City Rovers score' })
    expect(score).toHaveValue(2)
    await fireEvent.update(score, '')
    await fireEvent.click(
      screen.getByRole('button', { name: 'Save results for Round 2' }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Fixture progress')).toHaveTextContent(
        '0of 4 played',
      ),
    )
    expect(state.seasons[0]?.matches[2]?.homeScore).toBeNull()
    expect(state.seasons[0]?.matches[2]?.awayScore).toBe(1)
  })

  /**
   * GIVEN storage rejects a valid round update
   * WHEN the user saves the edited result
   * THEN the in-memory result remains visible and the persistence error is announced
   */
  it('shows persistence errors without discarding the edit', async () => {
    vi.mocked(persistenceService.save).mockReturnValueOnce({
      success: false,
      reason: 'quota-exceeded',
      message: 'Storage is full. Your latest changes could not be saved.',
    })
    await renderView()

    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit results for Round 1' })[0]!,
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Northside FC score' }),
      '1',
    )
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Riverside United score' }),
      '1',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Save results for Round 1' }),
    )

    expect(
      await screen.findByText(
        'Storage is full. Your latest changes could not be saved.',
      ),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByLabelText('Northside FC versus Riverside United'),
      ).getAllByText('1'),
    ).toHaveLength(2)
  })
})

async function renderView(): Promise<void> {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLeagueStore().load()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: DestinationView },
      {
        path: '/leagues/:leagueId/seasons/:seasonId',
        name: 'season-overview',
        component: DestinationView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId/fixtures',
        name: 'season-fixtures',
        component: SeasonFixturesView,
      },
    ],
  })
  await router.push('/leagues/league-1/seasons/season-1/fixtures')
  await router.isReady()

  render(SeasonFixturesView, {
    global: { plugins: [pinia, router, PrimeVue] },
  })
}

function createLeague(): League {
  return {
    id: 'league-1',
    name: 'Premier League',
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
  }
}

function createSeason(): Season {
  return {
    id: 'season-1',
    leagueId: 'league-1',
    name: '2026/27',
    teams: [
      { id: 'team-1', name: 'Northside FC' },
      { id: 'team-2', name: 'Riverside United' },
      { id: 'team-3', name: 'City Rovers' },
      { id: 'team-4', name: 'Athletic Club' },
    ],
    matches: [
      createMatch({
        id: 'match-1',
        leg: 1,
        round: 1,
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
      }),
      createMatch({
        id: 'match-2',
        leg: 1,
        round: 1,
        homeTeamId: 'team-3',
        awayTeamId: 'team-4',
      }),
      createMatch({
        id: 'match-3',
        leg: 1,
        round: 2,
        homeTeamId: 'team-3',
        awayTeamId: 'team-1',
        homeScore: 2,
        awayScore: 1,
      }),
      createMatch({
        id: 'match-4',
        leg: 2,
        round: 1,
        homeTeamId: 'team-2',
        awayTeamId: 'team-1',
      }),
    ],
    legCount: 2,
    randomTiebreakerLocks: [],
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
  }
}

function createMatch(overrides: Partial<Match>): Match {
  return {
    id: 'match',
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
    ...overrides,
  }
}

function cloneState(source: AppState): AppState {
  return JSON.parse(JSON.stringify(source)) as AppState
}
