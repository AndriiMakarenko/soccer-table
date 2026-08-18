<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'

import { useAppStateStore } from '@/stores/appState'

const appState = useAppStateStore()

const guidance = computed(() => {
  switch (appState.startupErrorCode) {
    case 'busy':
      return 'Close other Fixture Board windows, then retry.'
    case 'disk-full':
      return 'Free some disk space, then retry. Your existing database has not been discarded.'
    case 'permission-denied':
      return 'Check that Fixture Board can write to its application-data folder, then retry.'
    case 'corrupt':
      return 'Restore a known-good database backup before retrying. The damaged file was not overwritten.'
    case 'bridge-unavailable':
      return 'This is a desktop application. Launch Fixture Board through its Tauri desktop host.'
    default:
      return 'Check the database location and permissions, then retry. No existing data was replaced.'
  }
})
</script>

<template>
  <section class="startup" aria-labelledby="startup-title" aria-live="polite">
    <ProgressSpinner
      v-if="appState.isLoading"
      aria-label="Starting Fixture Board"
    />
    <p class="eyebrow">Desktop startup</p>
    <h1 id="startup-title">
      {{
        appState.isLoading
          ? 'Opening your tournament database…'
          : 'Fixture Board could not start.'
      }}
    </h1>
    <template v-if="appState.startupError">
      <p role="alert">{{ appState.startupError }}</p>
      <p class="guidance">{{ guidance }}</p>
      <Button
        v-if="appState.startupErrorCode !== 'bridge-unavailable'"
        label="Retry startup"
        :loading="appState.isLoading"
        @click="appState.load"
      />
    </template>
  </section>
</template>

<style scoped>
.startup {
  display: grid;
  max-width: 42rem;
  min-height: 60vh;
  place-content: center;
  justify-items: start;
  gap: 1rem;
}

.startup h1,
.startup p {
  margin: 0;
}

.guidance {
  color: var(--color-muted);
  line-height: 1.6;
}
</style>
