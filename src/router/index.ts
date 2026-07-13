import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import LeagueDetailView from '@/views/LeagueDetailView.vue'
import NewSeasonView from '@/views/NewSeasonView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import SeasonOverviewView from '@/views/SeasonOverviewView.vue'
import SeasonFixturesView from '@/views/SeasonFixturesView.vue'
import SeasonTableView from '@/views/SeasonTableView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
  },
  {
    path: '/leagues/:leagueId',
    name: 'league-detail',
    component: LeagueDetailView,
  },
  {
    path: '/leagues/:leagueId/seasons/new',
    name: 'season-new',
    component: NewSeasonView,
  },
  {
    path: '/leagues/:leagueId/seasons/:seasonId',
    name: 'season-overview',
    component: SeasonOverviewView,
  },
  {
    path: '/leagues/:leagueId/seasons/:seasonId/fixtures',
    name: 'season-fixtures',
    component: SeasonFixturesView,
  },
  {
    path: '/leagues/:leagueId/seasons/:seasonId/table',
    name: 'season-table',
    component: SeasonTableView,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
  },
]

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({ history, routes })
}

const router = createAppRouter()

export default router
