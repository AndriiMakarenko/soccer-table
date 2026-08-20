<script setup lang="ts">
import Message from 'primevue/message'
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import FixturesBoard from '@/components/fixtures/FixturesBoard.vue'
import GlobalPersistenceError from '@/components/layout/GlobalPersistenceError.vue'
import NotFoundState from '@/components/layout/NotFoundState.vue'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore, type RoundMatchResultInput } from '@/stores/season'

const route = useRoute()
const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()
const actionError = shallowRef('')

const leagueId = computed(() => String(route.params.leagueId ?? ''))
const seasonId = computed(() => String(route.params.seasonId ?? ''))
const league = computed(() =>
  leagueStore.leagues.find((candidate) => candidate.id === leagueId.value),
)
const season = computed(() => {
  const candidate = seasonStore.seasonById(seasonId.value)
  return candidate?.leagueId === leagueId.value ? candidate : undefined
})
const completedFixtures = computed(
  () =>
    season.value?.matches.filter(
      (match) => match.homeScore !== null && match.awayScore !== null,
    ).length ?? 0,
)

onMounted(() => {
  if (!leagueStore.isLoaded) void leagueStore.load()
})

async function saveRound(updates: RoundMatchResultInput[]): Promise<void> {
  actionError.value = ''
  const result = seasonStore.updateRoundResults(seasonId.value, updates)

  if (!result.success) {
    actionError.value = result.message
    return
  }

  const saveResult = await result.saveResult
  if (!saveResult.success) actionError.value = saveResult.message
}
</script>

<template>
  <section
    v-if="league && season"
    class="fixtures-page"
    aria-labelledby="fixtures-title"
  >
    <RouterLink
      class="back-link"
      :to="{
        name: 'season-overview',
        params: { leagueId, seasonId },
      }"
    >
      ← {{ season.name }} overview
    </RouterLink>

    <header class="page-header">
      <div>
        <p class="eyebrow">{{ league.name }} / matchdays</p>
        <h1 id="fixtures-title">Fixtures & results</h1>
        <p class="page-intro">
          Enter scores and discipline round by round. The table recalculates
          whenever a round is saved.
        </p>
      </div>
      <div class="fixture-tally" aria-label="Fixture progress">
        <strong>{{ completedFixtures }}</strong>
        <span>of {{ season.matches.length }} played</span>
      </div>
    </header>

    <GlobalPersistenceError fallback-only />

    <Message v-if="actionError" severity="error" class="page-message">
      {{ actionError }}
    </Message>

    <FixturesBoard :season="season" @save-round="saveRound" />
  </section>

  <NotFoundState
    v-else
    eyebrow="Fixtures not found"
    title="This matchday board is unavailable."
    detail="The league or season may have been deleted, or the link may be incorrect."
  />
</template>

<style scoped>
.fixtures-page {
  padding-block: clamp(1.25rem, 3vw, 2.5rem);
}

.back-link {
  display: inline-block;
  margin-bottom: 1rem;
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
  gap: 1rem;
  margin-bottom: clamp(1.25rem, 3vw, 2rem);
  padding-bottom: 1rem;
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
  font-size: clamp(2.1rem, 5vw, 3.75rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.88;
}

.page-intro {
  max-width: 42rem;
  margin: 0.6rem 0 0;
  color: var(--color-soft);
  font-size: 0.9rem;
  line-height: 1.45;
}

.fixture-tally {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
}

.fixture-tally strong {
  color: var(--color-floodlight);
  font: 750 clamp(1.6rem, 3.5vw, 2.5rem)/0.9 var(--font-utility);
}

.fixture-tally span {
  color: var(--color-muted);
  font: 600 0.68rem/1 var(--font-utility);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-message {
  margin: -1rem 0 1rem;
}

@media (max-width: 720px) {
  .page-header {
    grid-template-columns: 1fr;
  }

  .fixture-tally {
    justify-items: start;
  }
}
</style>
