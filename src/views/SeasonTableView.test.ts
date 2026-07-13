import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  AppState,
  League,
  Match,
  RandomTiebreakerLock,
  Season,
} from '@/domain/models'
import { persistenceService } from '@/services/storage'
import { useLeagueStore } from '@/stores/league'

import SeasonTableView from './SeasonTableView.vue'

const DestinationView = { template: '<h1>Destination</h1>' }

describe('season table view', () => {
  let state: AppState

  beforeEach(() => {
    state = { leagues: [createLeague()], seasons: [createSeason()] }
    vi.spyOn(persistenceService, 'load').mockImplementation(() =>
      cloneState(state),
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * GIVEN a season with played and unplayed fixtures
   * WHEN its standings page opens in Overall mode
   * THEN the required columns, ranked statistics, and two-decimal average are shown
   */
  it('renders the complete standings column set and overall values', async () => {
    await renderView()

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['POS', 'Team', 'PLD', 'W', 'D', 'L', 'SF', 'SA', 'SD', 'PTS'])
    expect(rowText('Northside FC')).toBe('1Northside FC21105324')
    expect(rowText('City Rovers')).toBe('2City Rovers10102201')
    expect(rowText('Riverside United')).toBe('3Riverside United100113-20')
    expect(screen.getByText('Average total:').parentElement).toHaveTextContent(
      'Average total:4.00',
    )
    expect(
      screen.getByRole('region', { name: 'Scrollable standings table' }),
    ).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('table')).toHaveAccessibleName('Season standings')
    expect(screen.getByRole('table')).toHaveTextContent(
      'Overall standings for 2026/27',
    )
  })

  /**
   * GIVEN results with different home and away performance
   * WHEN the user switches from Overall to Home only and Away only
   * THEN every visible statistic and average is recalculated for the active mode
   */
  it('switches between independently filtered home and away tables', async () => {
    await renderView()

    await fireEvent.click(screen.getByRole('button', { name: 'Home only' }))
    expect(screen.getByRole('button', { name: 'Home only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Home only' })).toHaveAttribute(
      'aria-controls',
      'season-standings-table',
    )
    expect(rowText('Northside FC')).toBe('1Northside FC11003123')
    expect(rowText('Riverside United')).toBe('3Riverside United00000000')
    expect(screen.getByText('Average total:').parentElement).toHaveTextContent(
      'Average total:5.00',
    )

    await fireEvent.click(screen.getByRole('button', { name: 'Away only' }))
    expect(rowText('Northside FC')).toBe('1Northside FC10102201')
    expect(rowText('Riverside United')).toBe('3Riverside United100113-20')
    expect(screen.getByText('Average total:').parentElement).toHaveTextContent(
      'Average total:3.00',
    )
  })

  /**
   * GIVEN an incomplete season where every team remains fully tied
   * WHEN standings are rendered before the final fixture is played
   * THEN teams share position 1 and the no-results average is N/A
   */
  it('renders shared competition positions while the season is incomplete', async () => {
    state.seasons = [createSeason({ matches: [] })]
    await renderView()

    expect(rowText('Northside FC')).toMatch(/^1Northside FC/)
    expect(rowText('Riverside United')).toMatch(/^1Riverside United/)
    expect(rowText('City Rovers')).toMatch(/^1City Rovers/)
    expect(screen.getByText('Average total:').parentElement).toHaveTextContent(
      'Average total:N/A',
    )
  })

  /**
   * GIVEN a completed season whose fully tied teams have a persisted random order
   * WHEN the final standings are rendered
   * THEN the locked order is reused and positions become unique
   */
  it('renders the locked final order for a completed season', async () => {
    const lock: RandomTiebreakerLock = {
      mode: 'overall',
      teamIds: ['team-1', 'team-2'],
      orderedTeamIds: ['team-2', 'team-1'],
    }
    state.seasons = [
      createSeason({
        teams: [
          { id: 'team-1', name: 'Northside FC' },
          { id: 'team-2', name: 'Riverside United' },
        ],
        matches: [
          createMatch({
            homeTeamId: 'team-1',
            awayTeamId: 'team-2',
            homeScore: 0,
            awayScore: 0,
          }),
        ],
        randomTiebreakerLocks: [lock],
      }),
    ]
    await renderView()

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows.map((row) => row.textContent)).toEqual([
      '1Riverside United10100001',
      '2Northside FC10100001',
    ])
  })
})

async function renderView(
  path = '/leagues/league-1/seasons/season-1/table',
): Promise<void> {
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
        path: '/leagues/:leagueId/seasons/:seasonId/table',
        name: 'season-table',
        component: SeasonTableView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()

  render(SeasonTableView, {
    global: { plugins: [pinia, router, PrimeVue] },
  })
}

function rowText(teamName: string): string {
  return within(screen.getByRole('row', { name: new RegExp(teamName) }))
    .getByRole('rowheader')
    .closest('tr')!.textContent!
}

function createLeague(): League {
  return {
    id: 'league-1',
    name: 'Premier League',
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
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
      { id: 'team-3', name: 'City Rovers' },
    ],
    matches: [
      createMatch({
        id: 'match-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 3,
        awayScore: 1,
      }),
      createMatch({
        id: 'match-2',
        homeTeamId: 'team-3',
        awayTeamId: 'team-1',
        homeScore: 2,
        awayScore: 2,
      }),
      createMatch({
        id: 'match-3',
        homeTeamId: 'team-2',
        awayTeamId: 'team-3',
      }),
    ],
    legCount: 1,
    randomTiebreakerLocks: [],
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  }
}

function createMatch(overrides: Partial<Match> = {}): Match {
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
