<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  canReset: boolean
}>()

defineEmits<{
  rename: []
  reset: []
  regenerate: []
}>()
</script>

<template>
  <aside class="lifecycle-panel" aria-labelledby="lifecycle-title">
    <div class="panel-copy">
      <p class="panel-kicker">Season control</p>
      <h2 id="lifecycle-title">Lifecycle actions</h2>
      <p>Update the season identity or rebuild its competitive slate.</p>
    </div>

    <div class="action-list">
      <Button
        label="Rename season"
        severity="secondary"
        outlined
        @click="$emit('rename')"
      />
      <Button
        label="Reset all results"
        severity="secondary"
        outlined
        :disabled="!canReset"
        @click="$emit('reset')"
      />
      <Button
        label="Regenerate fixtures"
        severity="danger"
        outlined
        @click="$emit('regenerate')"
      />
    </div>
  </aside>
</template>

<style scoped>
.lifecycle-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2rem;
  padding: 1.5rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-panel-deep);
}

.panel-copy h2,
.panel-copy p {
  margin: 0;
}

.panel-kicker {
  color: var(--color-muted);
  font: 600 0.66rem/1.3 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.panel-copy h2 {
  margin-top: 0.45rem;
  font-family: var(--font-headline);
  font-size: 1.45rem;
}

.panel-copy p:last-child {
  margin-top: 0.5rem;
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.action-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
}

@media (max-width: 800px) {
  .lifecycle-panel {
    grid-template-columns: 1fr;
  }

  .action-list {
    justify-content: flex-start;
  }
}
</style>
