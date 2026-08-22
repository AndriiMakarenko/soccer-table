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

import type { AppState, League, Match, Season } from '@/domain/models'
import { persistenceService } from '@/services/storage'
import { useLeagueStore } from '@/stores/league'

import SeasonOverviewView from './SeasonOverviewView.vue'

const DestinationView = { template: '<h1>Destination</h1>' }

describe('season overview view', () => {
  let state: AppState
  let league: League
  let season: Season

  beforeEach(() => {
    league = createLeague()
    season = createSeason()
    state = { leagues: [league], seasons: [season] }
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
   * GIVEN an existing season with one completed fixture
   * WHEN the overview is opened and the fixtures destination is selected
   * THEN its summary, completion progress, and both season-page links are available
   */
  it('summarizes the season and navigates to season pages', async () => {
    const router = await renderView(seasonPath())

    expect(
      screen.getByRole('heading', { name: season.name, level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Season summary')).toHaveTextContent(
      '2Teams2Legs1Fixtures',
    )
    expect(screen.getByText('1 of 1 fixtures complete')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Fixture completion' }),
    ).toHaveAttribute('aria-valuenow', '100')

    const fixturesLink = screen.getByRole('link', {
      name: /Fixtures & results/,
    })
    const tableLink = screen.getByRole('link', { name: /Standings table/ })
    expect(fixturesLink).toHaveAttribute('href', `${seasonPath()}/fixtures`)
    expect(tableLink).toHaveAttribute('href', `${seasonPath()}/table`)

    await fireEvent.click(fixturesLink)
    await waitFor(() =>
      expect(router.currentRoute.value.name).toBe('season-fixtures'),
    )
  })

  /**
   * GIVEN an existing season on its overview
   * WHEN the user renames it through the lifecycle controls
   * THEN the new validated name is shown and persisted
   */
  it('renames the season', async () => {
    await renderView(seasonPath())

    await fireEvent.click(screen.getByRole('button', { name: 'Rename season' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Rename season',
    })
    await fireEvent.update(
      within(dialog).getByRole('textbox', { name: 'Season name' }),
      'Championship 2027',
    )
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Championship 2027',
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(state.seasons[0]?.name).toBe('Championship 2027')
  })

  /**
   * GIVEN a season containing a score and card counts
   * WHEN reset is cancelled once and then explicitly confirmed
   * THEN cancellation preserves the result before confirmation clears every value
   */
  it('requires confirmation before resetting all results', async () => {
    await renderView(seasonPath())

    await fireEvent.click(
      screen.getByRole('button', { name: 'Reset all results' }),
    )
    let dialog = await screen.findByRole('dialog', {
      name: 'Reset all results?',
    })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    )
    expect(state.seasons[0]?.matches[0]).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      homeYellowCards: 1,
    })
    expect(persistenceService.save).not.toHaveBeenCalled()

    await fireEvent.click(
      screen.getByRole('button', { name: 'Reset all results' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Reset all results?' })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Reset all results' }),
    )

    await waitFor(() =>
      expect(screen.getByText('0 of 1 fixtures complete')).toBeInTheDocument(),
    )
    expect(state.seasons[0]?.matches[0]).toMatchObject({
      homeScore: null,
      awayScore: null,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
    })
  })

  /**
   * GIVEN a season with recorded results and locked team editing
   * WHEN regeneration is cancelled and then accepted with changed teams and legs
   * THEN cancellation is safe and the accepted flow replaces the result-bearing slate
   */
  it('requires acceptance before regenerating fixtures with results', async () => {
    await renderView(seasonPath())

    await fireEvent.click(
      screen.getByRole('button', { name: 'Regenerate fixtures' }),
    )
    let dialog = await screen.findByRole('dialog', {
      name: 'Regenerate fixtures',
    })
    expect(
      within(dialog).getByRole('textbox', { name: 'Team names' }),
    ).toHaveAttribute('spellcheck', 'false')
    expect(
      within(dialog).getByRole('spinbutton', { name: 'Number of legs' }),
    ).toHaveAttribute('spellcheck', 'false')
    expect(
      within(dialog).getByText(
        'Regenerating will permanently delete every recorded score and card.',
      ),
    ).toBeInTheDocument()
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    )
    expect(state.seasons[0]?.teams).toHaveLength(2)
    expect(state.seasons[0]?.matches[0]?.homeScore).toBe(2)
    expect(persistenceService.save).not.toHaveBeenCalled()

    await fireEvent.click(
      screen.getByRole('button', { name: 'Regenerate fixtures' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Regenerate fixtures' })
    await fireEvent.update(
      within(dialog).getByRole('textbox', { name: 'Team names' }),
      'Northside FC\nRiverside United\nCity Rovers',
    )
    await fireEvent.update(
      within(dialog).getByRole('spinbutton', { name: 'Number of legs' }),
      '1',
    )
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Regenerate fixtures' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(state.seasons[0]?.teams.map((team) => team.name)).toEqual([
      'Northside FC',
      'Riverside United',
      'City Rovers',
    ])
    expect(state.seasons[0]?.legCount).toBe(1)
    expect(state.seasons[0]?.matches).toHaveLength(3)
    expect(
      state.seasons[0]?.matches.every((match) => match.homeScore === null),
    ).toBe(true)
  })

  /**
   * GIVEN a route with a missing league, missing season, or mismatched relationship
   * WHEN the overview resolves its route parameters
   * THEN a useful not-found state links back to the league dashboard
   */
  it.each([
    '/leagues/missing/seasons/season-1',
    '/leagues/league-1/seasons/missing',
    '/leagues/other-league/seasons/season-1',
  ])('handles invalid season routes at %s', async (path) => {
    if (path.includes('other-league')) {
      state.leagues.push(createLeague({ id: 'other-league', name: 'Other' }))
    }
    await renderView(path)

    expect(
      screen.getByRole('heading', {
        name: 'This season is no longer on the board.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to leagues' }),
    ).toHaveAttribute('href', '/')
  })
})

async function renderView(path: string): Promise<Router> {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLeagueStore().load()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: DestinationView },
      {
        path: '/leagues/:leagueId',
        name: 'league-detail',
        component: DestinationView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId',
        name: 'season-overview',
        component: SeasonOverviewView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId/fixtures',
        name: 'season-fixtures',
        component: DestinationView,
      },
      {
        path: '/leagues/:leagueId/seasons/:seasonId/table',
        name: 'season-table',
        component: DestinationView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()

  render(SeasonOverviewView, {
    global: {
      plugins: [pinia, router, PrimeVue],
    },
  })

  return router
}

function seasonPath(): string {
  return '/leagues/league-1/seasons/season-1'
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
    teams: [
      { id: 'team-1', name: 'Northside FC' },
      { id: 'team-2', name: 'Riverside United' },
    ],
    matches: [createMatch()],
    legCount: 2,
    randomTiebreakerLocks: [],
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  }
}

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    leg: 1,
    round: 1,
    homeTeamId: 'team-1',
    awayTeamId: 'team-2',
    homeScore: 2,
    awayScore: 1,
    homeYellowCards: 1,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    ...overrides,
  }
}

function cloneState(source: AppState): AppState {
  return JSON.parse(JSON.stringify(source)) as AppState
}
