<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed, onMounted, shallowRef } from 'vue'

import ConfirmDeleteDialog from '@/components/management/ConfirmDeleteDialog.vue'
import LeagueCard from '@/components/management/LeagueCard.vue'
import NameDialog from '@/components/management/NameDialog.vue'
import type { League } from '@/domain/models'
import { useLeagueStore } from '@/stores/league'
import { useSeasonStore } from '@/stores/season'

const leagueStore = useLeagueStore()
const seasonStore = useSeasonStore()
const createDialogVisible = shallowRef(false)
const renameTarget = shallowRef<League | null>(null)
const deleteTarget = shallowRef<League | null>(null)

const seasonCounts = computed(() => {
  const counts = new Map<string, number>()

  for (const season of seasonStore.seasons) {
    counts.set(season.leagueId, (counts.get(season.leagueId) ?? 0) + 1)
  }

  return counts
})

onMounted(() => {
  if (!leagueStore.isLoaded) leagueStore.load()
})

function createLeague(name: string): void {
  const result = leagueStore.createLeague(name)
  if (result.success) createDialogVisible.value = false
}

function renameLeague(name: string): void {
  if (!renameTarget.value) return
  const result = leagueStore.renameLeague(renameTarget.value.id, name)
  if (result.success) renameTarget.value = null
}

function deleteLeague(): void {
  if (!deleteTarget.value) return
  const result = leagueStore.deleteLeague(deleteTarget.value.id)
  if (result.success) deleteTarget.value = null
}
</script>

<template>
  <section class="dashboard" aria-labelledby="dashboard-title">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">
          Competition desk /
          {{ String(leagueStore.leagues.length).padStart(2, '0') }}
          leagues
        </p>
        <h1 id="dashboard-title">League control</h1>
        <p class="dashboard-intro">
          Set up competitions, return to active seasons, and keep every matchday
          in one place.
        </p>
      </div>
      <Button label="Create league" @click="createDialogVisible = true" />
    </header>

    <Message
      v-if="leagueStore.saveError"
      severity="error"
      role="alert"
      class="save-error"
      @close="leagueStore.clearSaveError"
    >
      {{ leagueStore.saveError }}
    </Message>

    <div
      v-if="leagueStore.leagues.length > 0"
      class="league-list"
      aria-label="Leagues"
    >
      <LeagueCard
        v-for="league in leagueStore.leagues"
        :key="league.id"
        :league="league"
        :season-count="seasonCounts.get(league.id) ?? 0"
        @rename="renameTarget = league"
        @delete="deleteTarget = league"
      />
    </div>

    <div v-else class="empty-state">
      <div class="empty-pitch" aria-hidden="true">
        <span class="halfway-line" />
        <span class="centre-circle" />
        <span class="centre-spot" />
      </div>
      <div class="empty-copy">
        <p class="eyebrow">No competitions on the board</p>
        <h2>Start with your first league.</h2>
        <p>Create the league now, then add its seasons and teams.</p>
        <Button
          label="Create your first league"
          @click="createDialogVisible = true"
        />
      </div>
    </div>
  </section>

  <NameDialog
    v-model:visible="createDialogVisible"
    title="Create league"
    field-label="League name"
    submit-label="Create league"
    @submit="createLeague"
  />

  <NameDialog
    :visible="Boolean(renameTarget)"
    title="Rename league"
    field-label="League name"
    submit-label="Save changes"
    :initial-name="renameTarget?.name"
    @update:visible="
      (visible) => {
        if (!visible) renameTarget = null
      }
    "
    @submit="renameLeague"
  />

  <ConfirmDeleteDialog
    :visible="Boolean(deleteTarget)"
    entity-kind="league"
    :entity-name="deleteTarget?.name ?? ''"
    :detail="`This also deletes ${seasonCounts.get(deleteTarget?.id ?? '') ?? 0} associated seasons and all of their match data.`"
    @update:visible="
      (visible) => {
        if (!visible) deleteTarget = null
      }
    "
    @confirm="deleteLeague"
  />
</template>

<style scoped>
.dashboard {
  padding-block: clamp(2.75rem, 7vw, 5.5rem);
}

.dashboard-header {
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

.dashboard-header h1 {
  margin: 0.8rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(2.6rem, 7vw, 5.4rem);
  font-weight: 780;
  letter-spacing: -0.055em;
  line-height: 0.95;
}

.dashboard-intro {
  max-width: 40rem;
  margin: 1.1rem 0 0;
  color: #b9c5d7;
  font-size: 1rem;
  line-height: 1.65;
}

.save-error {
  margin-top: 1.25rem;
}

.league-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.empty-state {
  display: grid;
  grid-template-columns: minmax(18rem, 0.85fr) minmax(18rem, 1.15fr);
  gap: clamp(2rem, 7vw, 6rem);
  align-items: center;
  margin-top: 2rem;
  padding: clamp(1.5rem, 4vw, 3rem);
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: linear-gradient(120deg, rgb(16 27 44 / 82%), rgb(10 19 33 / 75%));
}

.empty-pitch {
  position: relative;
  min-height: 15rem;
  overflow: hidden;
  border: 1px solid #38557e;
  border-radius: 0.8rem;
  background: #0a1321;
}

.empty-pitch::before {
  position: absolute;
  inset: 1rem;
  border: 1px solid rgb(103 164 255 / 33%);
  content: '';
}

.halfway-line,
.centre-circle,
.centre-spot {
  position: absolute;
  display: block;
}

.halfway-line {
  top: 1rem;
  bottom: 1rem;
  left: 50%;
  border-left: 1px solid rgb(103 164 255 / 33%);
}

.centre-circle {
  top: 50%;
  left: 50%;
  width: 5rem;
  height: 5rem;
  border: 1px solid rgb(103 164 255 / 33%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.centre-spot {
  top: 50%;
  left: 50%;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--color-floodlight);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 1.5rem var(--color-floodlight);
}

.empty-copy h2 {
  max-width: 14ch;
  margin: 0.7rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.05;
}

.empty-copy > p:not(.eyebrow) {
  margin: 1rem 0 1.4rem;
  color: var(--color-muted);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .dashboard-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .empty-state {
    grid-template-columns: 1fr;
  }

  .empty-pitch {
    min-height: 11rem;
  }
}
</style>
