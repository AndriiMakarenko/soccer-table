<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import ConfirmDeleteDialog from '@/components/management/ConfirmDeleteDialog.vue'
import NameDialog from '@/components/management/NameDialog.vue'
import SeasonCard from '@/components/management/SeasonCard.vue'
import type { Season } from '@/domain/models'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

const route = useRoute()
const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()
const renameTarget = shallowRef<Season | null>(null)
const deleteTarget = shallowRef<Season | null>(null)

const leagueId = computed(() => String(route.params.leagueId))
const league = computed(() =>
  leagueStore.leagues.find((candidate) => candidate.id === leagueId.value),
)
const seasons = computed(() => seasonStore.seasonsForLeague(leagueId.value))

onMounted(() => {
  if (!leagueStore.isLoaded) leagueStore.load()
})

function renameSeason(name: string): void {
  if (!renameTarget.value) return
  const result = seasonStore.renameSeason(renameTarget.value.id, name)
  if (result.success) renameTarget.value = null
}

function deleteSeason(): void {
  if (!deleteTarget.value) return
  const result = seasonStore.deleteSeason(deleteTarget.value.id)
  if (result.success) deleteTarget.value = null
}
</script>

<template>
  <section v-if="league" class="league-page" aria-labelledby="league-title">
    <RouterLink class="back-link" to="/">← All leagues</RouterLink>

    <header class="league-header">
      <div>
        <p class="eyebrow">
          League / {{ String(seasons.length).padStart(2, '0') }} seasons
        </p>
        <h1 id="league-title">{{ league.name }}</h1>
        <p>Build a new season or return to one already on the board.</p>
      </div>
      <Button
        label="Create season"
        :as="'router-link'"
        :to="{ name: 'season-new', params: { leagueId } }"
      />
    </header>

    <Message
      v-if="seasonStore.saveError"
      severity="error"
      role="alert"
      class="save-error"
      @close="seasonStore.clearSaveError"
    >
      {{ seasonStore.saveError }}
    </Message>

    <div v-if="seasons.length > 0" class="season-list" aria-label="Seasons">
      <SeasonCard
        v-for="season in seasons"
        :key="season.id"
        :league-id="league.id"
        :season="season"
        @rename="renameTarget = season"
        @delete="deleteTarget = season"
      />
    </div>

    <div v-else class="empty-state">
      <p class="eyebrow">No seasons yet</p>
      <h2>Put the first campaign on the calendar.</h2>
      <p>Add teams and choose the number of legs in the next step.</p>
      <Button
        label="Create the first season"
        :as="'router-link'"
        :to="{ name: 'season-new', params: { leagueId } }"
      />
    </div>
  </section>

  <section v-else class="not-found" aria-labelledby="missing-league-title">
    <p class="eyebrow">League not found</p>
    <h1 id="missing-league-title">This league is no longer on the board.</h1>
    <p>It may have been deleted, or the link may be incorrect.</p>
    <Button label="Return to leagues" :as="'router-link'" to="/" />
  </section>

  <NameDialog
    :visible="Boolean(renameTarget)"
    title="Rename season"
    field-label="Season name"
    submit-label="Save changes"
    :initial-name="renameTarget?.name"
    @update:visible="
      (visible) => {
        if (!visible) renameTarget = null
      }
    "
    @submit="renameSeason"
  />

  <ConfirmDeleteDialog
    :visible="Boolean(deleteTarget)"
    entity-kind="season"
    :entity-name="deleteTarget?.name ?? ''"
    detail="Its teams, fixtures, results, cards, and tiebreaker data will also be deleted."
    @update:visible="
      (visible) => {
        if (!visible) deleteTarget = null
      }
    "
    @confirm="deleteSeason"
  />
</template>

<style scoped>
.league-page,
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

.league-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
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

.league-header h1,
.not-found h1 {
  max-width: 16ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(2.6rem, 7vw, 5rem);
  font-weight: 780;
  letter-spacing: -0.05em;
  line-height: 0.96;
}

.league-header p:last-child,
.not-found > p:not(.eyebrow) {
  margin: 1rem 0 0;
  color: var(--color-muted);
  line-height: 1.6;
}

.save-error {
  margin-top: 1.25rem;
}

.season-list {
  margin-top: 1.5rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: rgb(16 27 44 / 78%);
}

.empty-state {
  margin-top: 1.5rem;
  padding: clamp(2rem, 6vw, 4rem);
  border: 1px dashed #38557e;
  border-radius: 0.9rem;
  background: rgb(16 27 44 / 58%);
}

.empty-state h2 {
  max-width: 18ch;
  margin: 0.8rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(1.8rem, 4vw, 3rem);
  line-height: 1.05;
}

.empty-state > p:not(.eyebrow) {
  margin: 0.9rem 0 1.35rem;
  color: var(--color-muted);
}

.not-found {
  max-width: 48rem;
}

.not-found :deep(.p-button) {
  margin-top: 1.5rem;
}

@media (max-width: 680px) {
  .league-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
