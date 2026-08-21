import { createPinia, type Pinia } from 'pinia'
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
import { createMemoryHistory, type Router } from 'vue-router'

import type { AppState, League, Match, Season } from '@/domain/models'
import { createAppRouter } from '@/router'
import { STORAGE_FULL_MESSAGE } from '@/services/browserPersistence'
import { persistenceService } from '@/services/storage'
import { useAppStateStore } from '@/stores/appState'

import App from './App.vue'

describe('application integration', () => {
  let persistedState: AppState

  beforeEach(() => {
    persistedState = createCompleteState()
    vi.spyOn(persistenceService, 'load').mockImplementation(() =>
      cloneState(persistedState),
    )
    vi.spyOn(persistenceService, 'save').mockImplementation((state) => {
      persistedState = cloneState(state)
      return { success: true }
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * GIVEN persisted league and season data on the dashboard
   * WHEN the user opens the league, season, and fixtures through visible links
   * THEN every destination renders with route-aware breadcrumbs and back navigation
   */
  it('navigates representative routes with breadcrumbs and back links', async () => {
    const { router } = await renderApp('/')

    await fireEvent.click(screen.getByRole('link', { name: 'Open league' }))
    await waitFor(() =>
      expect(router.currentRoute.value.name).toBe('league-detail'),
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Premier League' }),
    ).toBeInTheDocument()

    let breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(
      within(breadcrumbs).getByRole('link', { name: 'Leagues' }),
    ).toHaveAttribute('href', '/')
    expect(within(breadcrumbs).getByText('Premier League')).toHaveAttribute(
      'aria-current',
      'page',
    )

    await fireEvent.click(screen.getByRole('link', { name: 'Open season' }))
    await waitFor(() =>
      expect(router.currentRoute.value.name).toBe('season-overview'),
    )
    expect(
      screen.getByRole('heading', { level: 1, name: '2026/27' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '← Premier League' }),
    ).toHaveAttribute('href', '/leagues/league-1')

    await fireEvent.click(
      screen.getByRole('link', { name: /fixtures & results/i }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Fixtures & results' }),
    ).toBeInTheDocument()
    expect(router.currentRoute.value.name).toBe('season-fixtures')

    breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(
      within(breadcrumbs).getByRole('link', { name: '2026/27' }),
    ).toHaveAttribute('href', '/leagues/league-1/seasons/season-1')
    expect(within(breadcrumbs).getByText('Fixtures')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  /**
   * GIVEN local storage contains a league, season, teams, a completed result, cards, and a random tiebreaker lock
   * WHEN the application is mounted again with a fresh Pinia instance to simulate reload
   * THEN the complete persisted season graph is restored without losing any values
   */
  it('restores the complete tournament state after reload', async () => {
    const firstMount = await renderApp(
      '/leagues/league-1/seasons/season-1/fixtures',
    )
    expect(useAppStateStore(firstMount.pinia).seasons[0]).toEqual(
      persistedState.seasons[0],
    )

    cleanup()

    const reloaded = await renderApp('/leagues/league-1/seasons/season-1/table')
    const restoredSeason = useAppStateStore(reloaded.pinia).seasons[0]

    expect(restoredSeason).toEqual(persistedState.seasons[0])
    expect(restoredSeason?.matches[0]).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      homeYellowCards: 3,
      awayYellowCards: 1,
      homeRedCards: 0,
      awayRedCards: 1,
    })
    expect(restoredSeason?.randomTiebreakerLocks).toEqual([
      {
        mode: 'away',
        teamIds: ['team-1', 'team-2'],
        orderedTeamIds: ['team-2', 'team-1'],
      },
    ])
    expect(
      await screen.findByRole('heading', { name: 'Standings' }),
    ).toBeInTheDocument()
    expect(persistenceService.load).toHaveBeenCalledTimes(2)
  })

  /**
   * GIVEN an invalid URL and a URL for a deleted season
   * WHEN each route is opened
   * THEN the application shows the consistent recovery experience instead of a blank page
   */
  it('handles invalid URLs and deleted entities consistently', async () => {
    const { router } = await renderApp('/not/a/real/page')

    expect(
      screen.getByRole('heading', {
        name: 'That page is off the fixture list.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to leagues' }),
    ).toHaveAttribute('href', '/')

    await router.push('/leagues/league-1/seasons/deleted/table')

    expect(
      await screen.findByRole('heading', {
        name: 'This competition table is unavailable.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to leagues' }),
    ).toHaveAttribute('href', '/')
  })

  /**
   * GIVEN browser storage rejects a valid application-level mutation because its quota is full
   * WHEN the user creates a league
   * THEN one global alert shows the required message while the in-memory league remains actionable
   */
  it('presents quota errors globally without discarding in-memory changes', async () => {
    persistedState = { leagues: [], seasons: [] }
    vi.mocked(persistenceService.save).mockReturnValue({
      success: false,
      reason: 'quota-exceeded',
      message: STORAGE_FULL_MESSAGE,
    })
    await renderApp('/')

    await fireEvent.click(
      screen.getByRole('button', { name: 'Create your first league' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Create league' })
    await fireEvent.update(
      within(dialog).getByRole('textbox', { name: 'League name' }),
      'Unsaved League',
    )
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create league' }),
    )

    expect(await screen.findByText('Changes are not saved')).toBeInTheDocument()
    expect(screen.getByText(STORAGE_FULL_MESSAGE)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Unsaved League' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(STORAGE_FULL_MESSAGE)).toHaveLength(1)
  })
})

async function renderApp(
  path: string,
): Promise<{ pinia: Pinia; router: Router }> {
  const pinia = createPinia()
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()

  render(App, {
    global: {
      plugins: [pinia, router, PrimeVue],
    },
  })

  await waitFor(() => expect(useAppStateStore(pinia).isLoaded).toBe(true))

  return { pinia, router }
}

function createCompleteState(): AppState {
  const timestamp = '2026-07-13T10:00:00.000Z'
  const league: League = {
    id: 'league-1',
    name: 'Premier League',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const match: Match = {
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
  }
  const season: Season = {
    id: 'season-1',
    leagueId: league.id,
    name: '2026/27',
    teams: [
      { id: 'team-1', name: 'Northside FC' },
      { id: 'team-2', name: 'Riverside United' },
    ],
    matches: [match],
    legCount: 1,
    randomTiebreakerLocks: [
      {
        mode: 'away',
        teamIds: ['team-1', 'team-2'],
        orderedTeamIds: ['team-2', 'team-1'],
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return { leagues: [league], seasons: [season] }
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState
}
