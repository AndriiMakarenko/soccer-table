<script setup lang="ts">
import Button from 'primevue/button'

import type { League } from '@/domain/models'

defineProps<{
  league: League
  seasonCount: number
}>()

defineEmits<{
  rename: []
  delete: []
}>()
</script>

<template>
  <article class="league-card">
    <div class="scoreboard" aria-hidden="true">
      <strong>{{ String(seasonCount).padStart(2, '0') }}</strong>
      <span>seasons</span>
    </div>

    <div class="league-copy">
      <p class="card-kicker">League</p>
      <h2>{{ league.name }}</h2>
      <p>
        {{
          seasonCount === 0
            ? 'No seasons set up yet'
            : `${seasonCount} active ${seasonCount === 1 ? 'season' : 'seasons'}`
        }}
      </p>
    </div>

    <div
      class="card-actions"
      role="group"
      :aria-label="`${league.name} actions`"
    >
      <Button
        label="Rename"
        severity="secondary"
        text
        size="small"
        @click="$emit('rename')"
      />
      <Button
        label="Delete"
        severity="danger"
        text
        size="small"
        @click="$emit('delete')"
      />
      <Button
        label="Open league"
        icon="pi pi-arrow-right"
        icon-pos="right"
        size="small"
        :as="'router-link'"
        :to="{ name: 'league-detail', params: { leagueId: league.id } }"
      />
    </div>
  </article>
</template>

<style scoped>
.league-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1.25rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: rgb(16 27 44 / 82%);
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.league-card:hover {
  border-color: #38557e;
  transform: translateY(-1px);
}

.scoreboard {
  display: grid;
  width: 4.8rem;
  min-height: 4.8rem;
  place-content: center;
  border: 1px solid #38557e;
  border-radius: 0.65rem;
  background: #0a1321;
  text-align: center;
}

.scoreboard strong {
  color: var(--color-referee);
  font: 700 1.55rem/1 var(--font-utility);
  letter-spacing: 0.08em;
}

.scoreboard span,
.card-kicker {
  color: var(--color-muted);
  font: 600 0.62rem/1.2 var(--font-utility);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.scoreboard span {
  margin-top: 0.45rem;
}

.league-copy h2,
.league-copy p {
  margin: 0;
}

.league-copy h2 {
  overflow: hidden;
  margin-top: 0.35rem;
  font-family: var(--font-headline);
  font-size: clamp(1.2rem, 2vw, 1.55rem);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.league-copy > p:last-child {
  margin-top: 0.35rem;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

@media (max-width: 760px) {
  .league-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .card-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    border-top: 1px solid var(--color-line);
    padding-top: 0.75rem;
  }
}
</style>
