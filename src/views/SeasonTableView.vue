<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import StandingsTable from '@/components/standings/StandingsTable.vue'
import NotFoundState from '@/components/layout/NotFoundState.vue'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

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

onMounted(() => {
  if (!leagueStore.isLoaded) leagueStore.load()
})
</script>

<template>
  <section
    v-if="league && season"
    class="table-page"
    aria-labelledby="table-title"
  >
    <RouterLink
      class="back-link"
      :to="{ name: 'season-overview', params: { leagueId, seasonId } }"
    >
      ← {{ season.name }} overview
    </RouterLink>

    <header class="page-header">
      <div>
        <p class="eyebrow">{{ league.name }} / competition table</p>
        <h1 id="table-title">Standings</h1>
        <p class="page-intro">
          Switch the match lens to compare the full campaign with home and away
          form.
        </p>
      </div>
      <div class="season-stamp" aria-label="Standings season">
        <span>Season</span>
        <strong>{{ season.name }}</strong>
      </div>
    </header>

    <StandingsTable :season="season" />
  </section>

  <NotFoundState
    v-else
    eyebrow="Standings not found"
    title="This competition table is unavailable."
    detail="The league or season may have been deleted, or the link may be incorrect."
  />
</template>

<style scoped>
.table-page {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.back-link {
  display: inline-block;
  margin-bottom: 2rem;
  color: var(--color-floodlight);
  font: 700 0.76rem/1 var(--font-utility);
  letter-spacing: 0.05em;
  text-decoration: none;
  text-transform: uppercase;
}

.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 2rem;
  margin-bottom: clamp(2rem, 5vw, 3.25rem);
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--color-line);
}

.eyebrow {
  margin: 0;
  color: var(--color-muted);
  font: 600 0.7rem/1.4 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-header h1 {
  max-width: 13ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(3rem, 8vw, 6.4rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.88;
}

.page-intro {
  max-width: 42rem;
  margin: 1.15rem 0 0;
  color: var(--color-soft);
  line-height: 1.65;
}

.season-stamp {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
}

.season-stamp span {
  color: var(--color-muted);
  font: 650 0.65rem/1 var(--font-utility);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.season-stamp strong {
  max-width: 18rem;
  color: var(--color-chalk);
  font: 750 clamp(1.25rem, 3vw, 2rem)/1 var(--font-headline);
  text-align: right;
}

@media (max-width: 720px) {
  .page-header {
    grid-template-columns: 1fr;
  }

  .season-stamp {
    justify-items: start;
  }

  .season-stamp strong {
    text-align: left;
  }
}
</style>
