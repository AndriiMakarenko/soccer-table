<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const leagueId = computed(() => String(route.params.leagueId))
const isNewSeason = computed(() => route.name === 'season-new')
</script>

<template>
  <section class="placeholder" aria-labelledby="placeholder-title">
    <p>{{ isNewSeason ? 'Season setup' : 'Season overview' }}</p>
    <h1 id="placeholder-title">
      {{
        isNewSeason
          ? 'Team entry is the next build step.'
          : 'Season control is the next build step.'
      }}
    </h1>
    <Button
      label="Back to league"
      severity="secondary"
      :as="'router-link'"
      :to="{ name: 'league-detail', params: { leagueId } }"
    />
  </section>
</template>

<style scoped>
.placeholder {
  max-width: 46rem;
  padding-block: clamp(3rem, 10vw, 8rem);
}

.placeholder p {
  color: var(--color-muted);
  font: 600 0.72rem/1.4 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.placeholder h1 {
  margin: 0.8rem 0 2rem;
  font-family: var(--font-headline);
  font-size: clamp(2.5rem, 7vw, 5rem);
  letter-spacing: -0.05em;
  line-height: 0.98;
}
</style>
