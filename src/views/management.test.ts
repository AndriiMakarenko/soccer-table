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
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { AppState, League, Season } from '@/domain/models'
import { STORAGE_FULL_MESSAGE } from '@/services/browserPersistence'
import { persistenceService } from '@/services/storage'
import { useLeagueStore } from '@/stores/league'

import DashboardView from './DashboardView.vue'
import LeagueDetailView from './LeagueDetailView.vue'

const PlaceholderView = { template: '<h1>Destination</h1>' }

describe('league management views', () => {
  let state: AppState

  beforeEach(() => {
    state = { leagues: [], seasons: [] }
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
   * GIVEN an empty dashboard and an open create-league dialog
   * WHEN the user submits whitespace and then a valid league name
   * THEN only the first-league action is initially shown and validation precedes creation
   */
  it('validates and creates a league from the dashboard', async () => {
    const { router } = await renderView(DashboardView, '/')

    expect(
      screen.getByRole('heading', { name: 'Start with your first league.' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create league' }),
    ).not.toBeInTheDocument()

    await fireEvent.click(
      screen.getByRole('button', { name: 'Create your first league' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Create league' })
    const input = within(dialog).getByRole('textbox', { name: 'League name' })

    await fireEvent.update(input, '   ')
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create league' }),
    )
    expect(
      within(dialog).getByText('League name is required'),
    ).toBeInTheDocument()

    await fireEvent.update(input, 'Sunday Championship')
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create league' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Sunday Championship' }),
    ).toBeInTheDocument()
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(persistenceService.save).toHaveBeenCalledOnce()
  })

  /**
   * GIVEN a dashboard with one league and one associated season
   * WHEN the user renames it, cancels deletion, and then confirms deletion
   * THEN the updated name is shown and the confirmed delete removes both records
   */
  it('renames and confirmation-deletes a league', async () => {
    const league = createLeague()
    state = {
      leagues: [league],
      seasons: [createSeason({ leagueId: league.id })],
    }
    await renderView(DashboardView, '/')

    expect(
      screen.getByRole('button', { name: 'Create league' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create your first league' }),
    ).not.toBeInTheDocument()

    const actions = screen.getByRole('group', {
      name: 'Premier League actions',
    })
    await fireEvent.click(
      within(actions).getByRole('button', { name: 'Rename' }),
    )
    const renameDialog = await screen.findByRole('dialog', {
      name: 'Rename league',
    })
    await fireEvent.update(
      within(renameDialog).getByRole('textbox', { name: 'League name' }),
      'National League',
    )
    await fireEvent.click(
      within(renameDialog).getByRole('button', { name: 'Save changes' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'National League' }),
    ).toBeInTheDocument()

    const renamedActions = screen.getByRole('group', {
      name: 'National League actions',
    })
    await fireEvent.click(
      within(renamedActions).getByRole('button', { name: 'Delete' }),
    )
    let deleteDialog = await screen.findByRole('dialog', {
      name: 'Delete league?',
    })
    expect(
      within(deleteDialog).getByText(/also deletes 1 associated seasons/i),
    ).toBeInTheDocument()
    await fireEvent.click(
      within(deleteDialog).getByRole('button', { name: 'Cancel' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Delete league?' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByRole('heading', { name: 'National League' }),
    ).toBeInTheDocument()

    await fireEvent.click(
      within(renamedActions).getByRole('button', { name: 'Delete' }),
    )
    deleteDialog = await screen.findByRole('dialog', { name: 'Delete league?' })
    await fireEvent.click(
      within(deleteDialog).getByRole('button', { name: 'Delete league' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Start with your first league.',
      }),
    ).toBeInTheDocument()
    expect(state).toEqual({ leagues: [], seasons: [] })
  })

  /**
   * GIVEN desktop database persistence rejects an otherwise valid dashboard mutation
   * WHEN the user creates a league
   * THEN the league stays visible and the required persistence error is announced
   */
  it('keeps changes visible while surfacing persistence failures', async () => {
    vi.mocked(persistenceService.save).mockResolvedValue({
      success: false,
      reason: 'disk-full',
      message: STORAGE_FULL_MESSAGE,
    })
    await renderView(DashboardView, '/')

    await fireEvent.click(
      screen.getByRole('button', { name: 'Create your first league' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Create league' })
    await fireEvent.update(
      within(dialog).getByRole('textbox', { name: 'League name' }),
      'Storage League',
    )
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create league' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Storage League' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(STORAGE_FULL_MESSAGE)).toBeInTheDocument()
  })

  /**
   * GIVEN a league page with one season
   * WHEN the user follows create/open actions, renames the season, and confirms deletion
   * THEN navigation targets are correct and season CRUD updates the visible list
   */
  it('provides season navigation, rename, and confirmed delete actions', async () => {
    const league = createLeague()
    const season = createSeason({ leagueId: league.id })
    state = { leagues: [league], seasons: [season] }
    const { router } = await renderView(
      LeagueDetailView,
      `/leagues/${league.id}`,
    )

    const createLink = screen.getByRole('link', { name: 'Create season' })
    expect(createLink).toHaveAttribute(
      'href',
      `/leagues/${league.id}/seasons/new`,
    )
    const openLink = screen.getByRole('link', { name: 'Open season' })
    expect(openLink).toHaveAttribute(
      'href',
      `/leagues/${league.id}/seasons/${season.id}`,
    )

    const actions = screen.getByRole('group', { name: '2026/27 actions' })
    await fireEvent.click(
      within(actions).getByRole('button', { name: 'Rename' }),
    )
    const renameDialog = await screen.findByRole('dialog', {
      name: 'Rename season',
    })
    await fireEvent.update(
      within(renameDialog).getByRole('textbox', { name: 'Season name' }),
      '2027/28',
    )
    await fireEvent.click(
      within(renameDialog).getByRole('button', { name: 'Save changes' }),
    )
    expect(
      await screen.findByRole('heading', { name: '2027/28' }),
    ).toBeInTheDocument()

    const renamedActions = screen.getByRole('group', {
      name: '2027/28 actions',
    })
    await fireEvent.click(
      within(renamedActions).getByRole('button', { name: 'Delete' }),
    )
    const deleteDialog = await screen.findByRole('dialog', {
      name: 'Delete season?',
    })
    await fireEvent.click(
      within(deleteDialog).getByRole('button', { name: 'Delete season' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Put the first campaign on the calendar.',
      }),
    ).toBeInTheDocument()
    expect(router.currentRoute.value.fullPath).toBe(`/leagues/${league.id}`)
  })

  /**
   * GIVEN a league-detail URL whose identifier is absent from persisted state
   * WHEN the view loads
   * THEN a useful missing-league state and route back to the dashboard are shown
   */
  it('handles a missing league route', async () => {
    await renderView(LeagueDetailView, '/leagues/missing')

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

async function renderView(
  component: typeof DashboardView | typeof LeagueDetailView,
  path: string,
): Promise<{ router: Router }> {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLeagueStore().load()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: DashboardView },
      {
        path: '/leagues/:leagueId',
        name: 'league-detail',
        component: LeagueDetailView,
      },
      {
        path: '/leagues/:leagueId/seasons/new',
        name: 'season-new',
        component: PlaceholderView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId',
        name: 'season-overview',
        component: PlaceholderView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()

  render(component, {
    global: {
      plugins: [pinia, router, PrimeVue],
    },
  })

  return { router }
}

function createLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    name: 'Premier League',
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  }
}

function createSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    leagueId: 'league-1',
    name: '2026/27',
    teams: [],
    matches: [],
    legCount: 2,
    randomTiebreakerLocks: [],
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  }
}

function cloneState(source: AppState): AppState {
  return JSON.parse(JSON.stringify(source)) as AppState
}
