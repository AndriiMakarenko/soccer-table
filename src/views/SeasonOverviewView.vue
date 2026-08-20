<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import ConfirmSeasonActionDialog from '@/components/seasons/ConfirmSeasonActionDialog.vue'
import GlobalPersistenceError from '@/components/layout/GlobalPersistenceError.vue'
import NotFoundState from '@/components/layout/NotFoundState.vue'
import RegenerateFixturesDialog, {
  type RegenerateFixturesValues,
} from '@/components/seasons/RegenerateFixturesDialog.vue'
import SeasonLifecycleActions from '@/components/seasons/SeasonLifecycleActions.vue'
import NameDialog from '@/components/management/NameDialog.vue'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

const route = useRoute()
const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()
const showRenameDialog = shallowRef(false)
const showResetDialog = shallowRef(false)
const showRegenerateDialog = shallowRef(false)
const actionError = shallowRef<string | null>(null)

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
const hasRecordedResults = computed(
  () =>
    season.value?.matches.some(
      (match) =>
        match.homeScore !== null ||
        match.awayScore !== null ||
        match.homeYellowCards > 0 ||
        match.awayYellowCards > 0 ||
        match.homeRedCards > 0 ||
        match.awayRedCards > 0,
    ) ?? false,
)
const progressPercent = computed(() => {
  const total = season.value?.matches.length ?? 0
  return total === 0 ? 0 : (completedFixtures.value / total) * 100
})
const progressLabel = computed(() => {
  const total = season.value?.matches.length ?? 0
  return `${completedFixtures.value} of ${total} fixtures complete`
})
const teamInput = computed(
  () => season.value?.teams.map((team) => team.name).join('\n') ?? '',
)

onMounted(() => {
  if (!leagueStore.isLoaded) void leagueStore.load()
})

async function renameSeason(name: string): Promise<void> {
  const result = seasonStore.renameSeason(seasonId.value, name)
  if (result.success && (await result.saveResult).success)
    showRenameDialog.value = false
}

async function resetResults(): Promise<void> {
  const result = seasonStore.resetAllResults(seasonId.value)
  if (result.success && (await result.saveResult).success)
    showResetDialog.value = false
}

function openRegeneration(): void {
  actionError.value = null
  showRegenerateDialog.value = true
}

async function regenerateFixtures(
  values: RegenerateFixturesValues,
): Promise<void> {
  actionError.value = null
  const result = seasonStore.regenerateFixtures(seasonId.value, {
    teamInput: values.teamInput,
    legCount: values.legCount,
    confirmResultDeletion: hasRecordedResults.value,
  })

  if (!result.success) {
    actionError.value = result.message
    return
  }

  if ((await result.saveResult).success) showRegenerateDialog.value = false
}
</script>

<template>
  <section
    v-if="league && season"
    class="season-overview"
    aria-labelledby="season-title"
  >
    <RouterLink
      class="back-link"
      :to="{ name: 'league-detail', params: { leagueId } }"
    >
      ← {{ league.name }}
    </RouterLink>

    <header class="season-header">
      <div class="title-block">
        <p class="eyebrow">{{ league.name }} / season overview</p>
        <h1 id="season-title">{{ season.name }}</h1>
      </div>

      <div class="season-facts" aria-label="Season summary">
        <div>
          <strong>{{ season.teams.length }}</strong>
          <span>Teams</span>
        </div>
        <div>
          <strong>{{ season.legCount }}</strong>
          <span>{{ season.legCount === 1 ? 'Leg' : 'Legs' }}</span>
        </div>
        <div>
          <strong>{{ season.matches.length }}</strong>
          <span>Fixtures</span>
        </div>
      </div>
    </header>

    <GlobalPersistenceError fallback-only />

    <section class="progress-sheet" aria-labelledby="progress-title">
      <div class="progress-heading">
        <div>
          <p class="eyebrow">Results progress</p>
          <h2 id="progress-title">{{ progressLabel }}</h2>
        </div>
        <strong>{{ Math.round(progressPercent) }}%</strong>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="Fixture completion"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(progressPercent)"
      >
        <span :style="{ width: `${progressPercent}%` }" />
      </div>
    </section>

    <nav class="season-destinations" aria-label="Season pages">
      <RouterLink
        class="destination-card"
        :to="{ name: 'season-fixtures', params: { leagueId, seasonId } }"
      >
        <span class="destination-kicker">Matches</span>
        <strong>Fixtures & results</strong>
        <span>Review rounds and enter scores →</span>
      </RouterLink>
      <RouterLink
        class="destination-card"
        :to="{ name: 'season-table', params: { leagueId, seasonId } }"
      >
        <span class="destination-kicker">Competition</span>
        <strong>Standings table</strong>
        <span>Open overall, home, and away tables →</span>
      </RouterLink>
    </nav>

    <SeasonLifecycleActions
      :can-reset="hasRecordedResults"
      @rename="showRenameDialog = true"
      @reset="showResetDialog = true"
      @regenerate="openRegeneration"
    />
  </section>

  <NotFoundState
    v-else
    eyebrow="Season not found"
    title="This season is no longer on the board."
    detail="The league or season may have been deleted, or the link may be incorrect."
  />

  <NameDialog
    v-model:visible="showRenameDialog"
    title="Rename season"
    field-label="Season name"
    submit-label="Save changes"
    :initial-name="season?.name"
    @submit="renameSeason"
  />

  <ConfirmSeasonActionDialog
    v-model:visible="showResetDialog"
    title="Reset all results?"
    confirm-label="Reset all results"
    detail="Every score and card count will be cleared. Teams and the current fixture schedule will stay in place."
    @confirm="resetResults"
  />

  <RegenerateFixturesDialog
    v-model:visible="showRegenerateDialog"
    :initial-team-input="teamInput"
    :initial-leg-count="season?.legCount ?? 1"
    :deletes-results="hasRecordedResults"
    :error-message="actionError"
    @submit="regenerateFixtures"
  />
</template>

<style scoped>
.season-overview {
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

.season-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 2rem;
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

.title-block h1 {
  max-width: 14ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(3rem, 8vw, 6.4rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.88;
}

.season-facts {
  display: flex;
  gap: clamp(1.25rem, 4vw, 3rem);
}

.season-facts div {
  display: grid;
  gap: 0.3rem;
}

.season-facts strong {
  font-family: var(--font-utility);
  font-size: 1.35rem;
}

.season-facts span {
  color: var(--color-muted);
  font: 600 0.65rem/1 var(--font-utility);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.progress-sheet {
  margin-top: 1.5rem;
  padding: clamp(1.4rem, 4vw, 2.25rem);
  border: 1px solid var(--color-line-strong);
  border-radius: 0.9rem;
  background: var(--color-panel);
}

.progress-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.progress-heading h2 {
  margin: 0.45rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(1.5rem, 4vw, 2.4rem);
}

.progress-heading > strong {
  color: var(--color-floodlight);
  font: 700 clamp(1.5rem, 4vw, 2.5rem)/1 var(--font-utility);
}

.progress-track {
  height: 0.65rem;
  margin-top: 1.5rem;
  overflow: hidden;
  border: 1px solid var(--color-line-strong);
  background: var(--color-panel-deep);
}

.progress-track span {
  display: block;
  height: 100%;
  background: var(--color-floodlight);
}

.season-destinations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-block: 1rem;
}

.destination-card {
  display: grid;
  gap: 0.55rem;
  min-height: 10rem;
  padding: 1.4rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-panel);
  color: var(--color-chalk);
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.destination-card:hover {
  border-color: var(--color-floodlight);
  transform: translateY(-2px);
}

.destination-kicker {
  color: var(--color-muted);
  font: 600 0.66rem/1 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.destination-card strong {
  align-self: end;
  font-family: var(--font-headline);
  font-size: 1.45rem;
}

.destination-card > span:last-child {
  color: var(--color-floodlight);
  font-size: 0.82rem;
}

@media (prefers-reduced-motion: reduce) {
  .destination-card {
    transition: none;
  }
}

@media (max-width: 720px) {
  .season-header,
  .season-destinations {
    grid-template-columns: 1fr;
  }

  .season-facts {
    justify-content: space-between;
  }
}
</style>
