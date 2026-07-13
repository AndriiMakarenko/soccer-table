<script setup lang="ts">
import Message from 'primevue/message'
import { computed, inject } from 'vue'

import { useAppStateStore } from '@/stores/appState'
import { globalPersistenceErrorHostKey } from './persistenceErrorContext'

const props = withDefaults(defineProps<{ fallbackOnly?: boolean }>(), {
  fallbackOnly: false,
})
const appState = useAppStateStore()
const hasApplicationHost = inject(globalPersistenceErrorHostKey, false)
const errorMessage = computed(() => {
  if (props.fallbackOnly && hasApplicationHost) return null
  return appState.saveError
})
</script>

<template>
  <Message
    v-if="errorMessage"
    severity="error"
    class="persistence-error"
    @close="appState.clearSaveError"
  >
    <strong>Changes are not saved</strong>
    <span>{{ errorMessage }}</span>
    <small>
      Your latest changes remain available in this tab so you can retry or
      remove older data.
    </small>
  </Message>
</template>

<style scoped>
.persistence-error {
  margin-top: 1rem;
}

.persistence-error :deep(.p-message-text) {
  display: grid;
  gap: 0.2rem;
}

.persistence-error strong,
.persistence-error span,
.persistence-error small {
  display: block;
}

.persistence-error small {
  color: var(--color-soft);
  line-height: 1.45;
}
</style>
