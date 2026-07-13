import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { AppState, League } from '@/domain/models'
import { persistenceService, STORAGE_FULL_MESSAGE } from '@/services/storage'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

import NewSeasonView from './NewSeasonView.vue'

const OverviewView = { template: '<h1>Season overview</h1>' }

describe('new season view', () => {
  let state: AppState
  let league: League

  beforeEach(() => {
    league = {
      id: 'league-1',
      name: 'Premier League',
      createdAt: '2026-07-13T10:00:00.000Z',
      updatedAt: '2026-07-13T10:00:00.000Z',
    }
    state = { leagues: [league], seasons: [] }
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
   * GIVEN a valid season name, four unique teams, and two legs
   * WHEN the user creates the season
   * THEN one complete season is persisted and its overview route opens
   */
  it('creates teams and fixtures before navigating to the overview', async () => {
    const router = await renderView(`/leagues/${league.id}/seasons/new`)

    await fillValidForm()
    await fireEvent.click(
      screen.getByRole('button', { name: 'Create season & fixtures' }),
    )

    await waitFor(() =>
      expect(router.currentRoute.value.name).toBe('season-overview'),
    )
    expect(state.seasons).toHaveLength(1)
    expect(state.seasons[0]).toMatchObject({
      leagueId: league.id,
      name: '2026/27',
      legCount: 2,
    })
    expect(state.seasons[0]?.teams.map((team) => team.name)).toEqual([
      'Northside FC',
      'Riverside United',
      'Athletic Club',
      'City Rovers',
    ])
    expect(state.seasons[0]?.matches).toHaveLength(12)
    expect(persistenceService.save).toHaveBeenCalledOnce()
  })

  /**
   * GIVEN an empty season setup form
   * WHEN the user submits it
   * THEN required-name and minimum-team validation are shown without saving
   */
  it('validates required season and team fields', async () => {
    await renderView(`/leagues/${league.id}/seasons/new`)

    await fireEvent.click(
      screen.getByRole('button', { name: 'Create season & fixtures' }),
    )

    expect(screen.getByText('Season name is required')).toBeInTheDocument()
    expect(
      screen.getByText('Team count must be between 2 and 64'),
    ).toBeInTheDocument()
    expect(persistenceService.save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN team input containing the same name with different letter casing
   * WHEN the user submits the setup
   * THEN duplicate-team validation identifies the repeated name
   */
  it('rejects duplicate team names', async () => {
    await renderView(`/leagues/${league.id}/seasons/new`)

    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Season name' }),
      '2026/27',
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Team names' }),
      'Northside FC\nnorthside fc',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Create season & fixtures' }),
    )

    expect(
      screen.getByText('Duplicate team names are not allowed: northside fc'),
    ).toBeInTheDocument()
    expect(persistenceService.save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN more than the supported maximum of 64 team names
   * WHEN the user submits the setup
   * THEN the team-count limit is shown and no season is created
   */
  it('rejects team input above the supported cap', async () => {
    await renderView(`/leagues/${league.id}/seasons/new`)

    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Season name' }),
      '2026/27',
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Team names' }),
      Array.from({ length: 65 }, (_, index) => `Team ${index + 1}`).join('\n'),
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Create season & fixtures' }),
    )

    expect(
      screen.getByText('Team count must be between 2 and 64'),
    ).toBeInTheDocument()
    expect(persistenceService.save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN otherwise valid setup data with five legs
   * WHEN the user submits the setup
   * THEN the supported leg-count range is shown and no season is created
   */
  it('rejects invalid leg counts', async () => {
    await renderView(`/leagues/${league.id}/seasons/new`)

    await fillValidForm()
    await fireEvent.update(
      screen.getByRole('spinbutton', { name: 'Number of legs' }),
      '5',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Create season & fixtures' }),
    )

    expect(
      screen.getByText('Leg count must be between 1 and 4'),
    ).toBeInTheDocument()
    expect(persistenceService.save).not.toHaveBeenCalled()
  })

  /**
   * GIVEN valid entered setup data and browser storage that is full
   * WHEN creation fails to persist and the user retries
   * THEN the error and inputs remain while only one in-memory season exists
   */
  it('preserves form data and prevents duplicate creation after save failure', async () => {
    vi.mocked(persistenceService.save).mockReturnValue({
      success: false,
      reason: 'quota-exceeded',
      message: STORAGE_FULL_MESSAGE,
    })
    const router = await renderView(`/leagues/${league.id}/seasons/new`)
    await fillValidForm()

    const submitButton = screen.getByRole('button', {
      name: 'Create season & fixtures',
    })
    await fireEvent.click(submitButton)
    expect(await screen.findByText(STORAGE_FULL_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Season name' })).toHaveValue(
      '2026/27',
    )
    expect(screen.getByRole('textbox', { name: 'Team names' })).toHaveValue(
      'Northside FC\nRiverside United\nAthletic Club\nCity Rovers',
    )

    await fireEvent.click(submitButton)

    expect(router.currentRoute.value.name).toBe('season-new')
    expect(useSeasonStore().seasons).toHaveLength(1)
    expect(state.seasons).toHaveLength(0)
    expect(persistenceService.save).toHaveBeenCalledTimes(2)
  })

  /**
   * GIVEN a season-creation URL for a missing league
   * WHEN the view loads
   * THEN a useful not-found state links back to the dashboard
   */
  it('handles a missing league route', async () => {
    await renderView('/leagues/missing/seasons/new')

    expect(
      screen.getByRole('heading', {
        name: 'This league is no longer on the board.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to leagues' }),
    ).toHaveAttribute('href', '/')
  })
})

async function fillValidForm(): Promise<void> {
  await fireEvent.update(
    screen.getByRole('textbox', { name: 'Season name' }),
    '2026/27',
  )
  await fireEvent.update(
    screen.getByRole('textbox', { name: 'Team names' }),
    'Northside FC\nRiverside United\nAthletic Club\nCity Rovers',
  )
  await fireEvent.update(
    screen.getByRole('spinbutton', { name: 'Number of legs' }),
    '2',
  )
}

async function renderView(path: string): Promise<Router> {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLeagueStore().load()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: OverviewView },
      {
        path: '/leagues/:leagueId',
        name: 'league-detail',
        component: OverviewView,
      },
      {
        path: '/leagues/:leagueId/seasons/new',
        name: 'season-new',
        component: NewSeasonView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId',
        name: 'season-overview',
        component: OverviewView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()

  render(NewSeasonView, {
    global: {
      plugins: [pinia, router, PrimeVue],
    },
  })

  return router
}

function cloneState(source: AppState): AppState {
  return JSON.parse(JSON.stringify(source)) as AppState
}
