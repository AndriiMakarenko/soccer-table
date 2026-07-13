import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import LeagueDetailView from '@/views/LeagueDetailView.vue'
import NewSeasonView from '@/views/NewSeasonView.vue'
import SeasonOverviewView from '@/views/SeasonOverviewView.vue'
import SeasonRoutePlaceholderView from '@/views/SeasonRoutePlaceholderView.vue'

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
      component: SeasonRoutePlaceholderView,
    },
    {
      path: '/leagues/:leagueId/seasons/:seasonId/table',
      name: 'season-table',
      component: SeasonRoutePlaceholderView,
    },
  ],
})

export default router
