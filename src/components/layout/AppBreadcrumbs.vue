<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'

import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

interface BreadcrumbItem {
  label: string
  to?: RouteLocationRaw
}

const route = useRoute()
const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()

const leagueId = computed(() => String(route.params.leagueId ?? ''))
const seasonId = computed(() => String(route.params.seasonId ?? ''))
const league = computed(() =>
  leagueStore.leagues.find((candidate) => candidate.id === leagueId.value),
)
const season = computed(() => {
  const candidate = seasonStore.seasonById(seasonId.value)
  return candidate?.leagueId === leagueId.value ? candidate : undefined
})

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (route.name === 'dashboard') return [{ label: 'Leagues' }]
  if (route.name === 'not-found') {
    return [
      { label: 'Leagues', to: { name: 'dashboard' } },
      { label: 'Page not found' },
    ]
  }

  const items: BreadcrumbItem[] = [
    { label: 'Leagues', to: { name: 'dashboard' } },
  ]

  if (route.name === 'league-detail') {
    items.push({ label: league.value?.name ?? 'Missing league' })
    return items
  }

  items.push({
    label: league.value?.name ?? 'Missing league',
    to: league.value
      ? { name: 'league-detail', params: { leagueId: leagueId.value } }
      : undefined,
  })

  if (route.name === 'season-new') {
    items.push({ label: 'New season' })
    return items
  }

  if (route.name === 'season-overview') {
    items.push({ label: season.value?.name ?? 'Missing season' })
    return items
  }

  items.push({
    label: season.value?.name ?? 'Missing season',
    to: season.value
      ? {
          name: 'season-overview',
          params: { leagueId: leagueId.value, seasonId: seasonId.value },
        }
      : undefined,
  })
  items.push({
    label: route.name === 'season-fixtures' ? 'Fixtures' : 'Standings',
  })

  return items
})
</script>

<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(item, index) in breadcrumbs" :key="`${item.label}-${index}`">
        <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
        <span v-else aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  padding-top: 1.25rem;
}

.breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  color: var(--color-muted);
  font: 650 0.68rem/1.4 var(--font-utility);
  letter-spacing: 0.07em;
  list-style: none;
  text-transform: uppercase;
}

.breadcrumbs li:not(:last-child)::after {
  margin-left: 0.45rem;
  color: var(--color-line-strong);
  content: '/';
}

.breadcrumbs a {
  color: var(--color-floodlight);
  text-decoration: none;
}

.breadcrumbs a:hover {
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}
</style>
