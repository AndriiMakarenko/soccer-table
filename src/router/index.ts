import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import LeagueDetailView from '@/views/LeagueDetailView.vue'
import NewSeasonView from '@/views/NewSeasonView.vue'
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
      component: SeasonRoutePlaceholderView,
    },
  ],
})

export default router
