<script setup lang="ts">
import Message from 'primevue/message'
import { computed, nextTick, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import SeasonSetupForm, {
  type SeasonSetupValues,
} from '@/components/seasons/SeasonSetupForm.vue'
import GlobalPersistenceError from '@/components/layout/GlobalPersistenceError.vue'
import NotFoundState from '@/components/layout/NotFoundState.vue'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

const route = useRoute()
const router = useRouter()
const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()
const isSubmitting = shallowRef(false)
const submissionError = shallowRef<string | null>(null)
const pendingSeasonId = shallowRef<string | null>(null)

const leagueId = computed(() => String(route.params.leagueId))
const league = computed(() =>
  leagueStore.leagues.find((candidate) => candidate.id === leagueId.value),
)

onMounted(() => {
  if (!leagueStore.isLoaded) leagueStore.load()
})

async function createSeason(values: SeasonSetupValues): Promise<void> {
  if (isSubmitting.value) return

  isSubmitting.value = true
  submissionError.value = null
  await nextTick()

  if (pendingSeasonId.value) {
    const saveResult = seasonStore.savePendingChanges()

    if (!saveResult.success) {
      submissionError.value = saveResult.message
      isSubmitting.value = false
      return
    }

    await openSeason(pendingSeasonId.value)
    return
  }

  const result = seasonStore.createSeasonWithFixtures({
    leagueId: leagueId.value,
    ...values,
  })

  if (!result.success) {
    submissionError.value = result.message
    isSubmitting.value = false
    return
  }

  if (!result.saveResult.success) {
    pendingSeasonId.value = result.value.id
    submissionError.value = result.saveResult.message
    isSubmitting.value = false
    return
  }

  await openSeason(result.value.id)
}

async function openSeason(seasonId: string): Promise<void> {
  await router.push({
    name: 'season-overview',
    params: { leagueId: leagueId.value, seasonId },
  })
}
</script>

<template>
  <section v-if="league" class="new-season" aria-labelledby="setup-title">
    <RouterLink
      class="back-link"
      :to="{ name: 'league-detail', params: { leagueId } }"
    >
      ← {{ league.name }}
    </RouterLink>

    <header class="setup-header">
      <p class="eyebrow">Season setup / fixtures generated automatically</p>
      <h1 id="setup-title">Build the field.</h1>
      <p>
        Name the campaign, paste the teams, and choose how many times every pair
        will meet.
      </p>
    </header>

    <GlobalPersistenceError fallback-only />

    <Message
      v-if="submissionError && submissionError !== seasonStore.saveError"
      severity="error"
      role="alert"
      class="submission-error"
      :closable="false"
    >
      {{ submissionError }}
    </Message>

    <SeasonSetupForm
      :submitting="isSubmitting"
      :save-pending="Boolean(pendingSeasonId)"
      @submit="createSeason"
    />
  </section>

  <NotFoundState
    v-else
    eyebrow="League not found"
    title="This league is no longer on the board."
    detail="Return to the dashboard and choose an existing league."
  />
</template>

<style scoped>
.new-season {
  max-width: 56rem;
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

.eyebrow {
  margin: 0;
  color: var(--color-muted);
  font: 600 0.7rem/1.4 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.setup-header {
  margin-bottom: 1.75rem;
}

.setup-header h1 {
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(2.8rem, 7vw, 5rem);
  font-weight: 780;
  letter-spacing: -0.05em;
  line-height: 0.96;
}

.setup-header > p:last-child {
  max-width: 44rem;
  margin: 1rem 0 0;
  color: var(--color-muted);
  line-height: 1.65;
}

.submission-error {
  margin-bottom: 1rem;
}
</style>
