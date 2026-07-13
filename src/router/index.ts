import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import LeagueDetailView from '@/views/LeagueDetailView.vue'
import NewSeasonView from '@/views/NewSeasonView.vue'
import SeasonOverviewView from '@/views/SeasonOverviewView.vue'
import SeasonFixturesView from '@/views/SeasonFixturesView.vue'
import SeasonTableView from '@/views/SeasonTableView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
  ],
})

export default router
