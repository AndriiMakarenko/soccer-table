<script setup lang="ts">
import Button from 'primevue/button'

import type { Season } from '@/domain/models'

defineProps<{
  leagueId: string
  season: Season
}>()

defineEmits<{
  rename: []
  delete: []
}>()
</script>

<template>
  <article class="season-card">
    <div class="season-copy">
      <p class="card-kicker">Season</p>
      <h2>{{ season.name }}</h2>
      <div class="season-stats" aria-label="Season status">
        <span>{{ season.teams.length }} teams</span>
        <span
          >{{ season.legCount }}
          {{ season.legCount === 1 ? 'leg' : 'legs' }}</span
        >
        <span>{{ season.matches.length }} fixtures</span>
      </div>
    </div>

    <div
      class="card-actions"
      role="group"
      :aria-label="`${season.name} actions`"
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
        label="Open season"
        icon="pi pi-arrow-right"
        icon-pos="right"
        size="small"
        :as="'router-link'"
        :to="{
          name: 'season-overview',
          params: { leagueId, seasonId: season.id },
        }"
      />
    </div>
  </article>
</template>

<style scoped>
.season-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  border-bottom: 1px solid var(--color-line);
}

.season-card:last-child {
  border-bottom: 0;
}

.season-copy h2,
.season-copy p {
  margin: 0;
}

.card-kicker {
  color: var(--color-muted);
  font: 600 0.62rem/1.2 var(--font-utility);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.season-copy h2 {
  margin-top: 0.3rem;
  font-family: var(--font-headline);
  font-size: 1.35rem;
}

.season-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin-top: 0.6rem;
  color: var(--color-muted);
  font: 600 0.7rem/1.3 var(--font-utility);
  text-transform: uppercase;
}

.card-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
}

@media (max-width: 680px) {
  .season-card {
    align-items: stretch;
    flex-direction: column;
  }

  .card-actions {
    justify-content: flex-end;
  }
}
</style>
