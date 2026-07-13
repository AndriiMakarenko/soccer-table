<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import FixturesBoard from '@/components/fixtures/FixturesBoard.vue'
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
  if (!leagueStore.isLoaded) leagueStore.load()
})

function saveRound(updates: RoundMatchResultInput[]): void {
  actionError.value = ''
  const result = seasonStore.updateRoundResults(seasonId.value, updates)

  if (!result.success) actionError.value = result.message
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

    <Message
      v-if="seasonStore.saveError"
      severity="error"
      class="page-message"
      @close="seasonStore.clearSaveError"
    >
      {{ seasonStore.saveError }}
    </Message>
    <Message v-if="actionError" severity="error" class="page-message">
      {{ actionError }}
    </Message>

    <FixturesBoard :season="season" @save-round="saveRound" />
  </section>

  <section v-else class="not-found" aria-labelledby="missing-fixtures-title">
    <p class="eyebrow">Fixtures not found</p>
    <h1 id="missing-fixtures-title">This matchday board is unavailable.</h1>
    <p>
      The league or season may have been deleted, or the link may be incorrect.
    </p>
    <Button label="Return to leagues" :as="'router-link'" to="/" />
  </section>
</template>

<style scoped>
.fixtures-page,
.not-found {
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
  margin-bottom: clamp(2.5rem, 6vw, 4rem);
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

.page-header h1,
.not-found h1 {
  max-width: 13ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(3rem, 8vw, 6.4rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.88;
}

.page-intro,
.not-found > p:not(.eyebrow) {
  max-width: 42rem;
  margin: 1.15rem 0 0;
  color: var(--color-soft);
  line-height: 1.65;
}

.fixture-tally {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
}

.fixture-tally strong {
  color: var(--color-floodlight);
  font: 750 clamp(2.2rem, 6vw, 4.2rem)/0.9 var(--font-utility);
}

.fixture-tally span {
  color: var(--color-muted);
  font: 600 0.68rem/1 var(--font-utility);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-message {
  margin: -2rem 0 2rem;
}

.not-found {
  max-width: 48rem;
}

.not-found :deep(.p-button) {
  margin-top: 1.5rem;
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
