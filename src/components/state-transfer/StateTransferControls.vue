<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import { useStateTransfer } from '@/composables/useStateTransfer'
import { useAppStateStore } from '@/stores/appState'

const transfer = useStateTransfer(useAppStateStore())
</script>

<template>
  <div class="transfer">
    <div class="transfer-actions" aria-label="Tournament data transfer">
      <Button
        label="IMPORT"
        outlined
        size="small"
        :disabled="transfer.controlsDisabled.value"
        @click="transfer.beginImport"
      />
      <Button
        label="EXPORT"
        outlined
        size="small"
        :disabled="transfer.controlsDisabled.value"
        @click="transfer.exportState"
      />
    </div>

    <p
      v-if="transfer.message.value"
      class="sr-status"
      :role="transfer.isError.value ? 'alert' : 'status'"
      aria-live="polite"
    >
      {{ transfer.message.value }}
      <template v-if="transfer.skippedLeagueNames.value.length">
        Skipped leagues: {{ transfer.skippedLeagueNames.value.join(', ') }}.
      </template>
    </p>

    <Dialog
      v-model:visible="transfer.isImportChoiceVisible.value"
      modal
      :closable="false"
      :close-on-escape="false"
      header="Import tournament data"
      :style="{ width: 'min(28rem, calc(100vw - 2rem))' }"
    >
      <p>Keep existing leagues and merge this backup, or replace everything?</p>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          @click="transfer.cancelImport"
        />
        <Button
          label="Merge"
          outlined
          @click="transfer.chooseImportMode('merge')"
        />
        <Button
          label="Replace all"
          severity="danger"
          @click="transfer.chooseImportMode('replace')"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="transfer.isReplaceConfirmationVisible.value"
      modal
      :closable="false"
      :close-on-escape="false"
      header="Replace all tournament data?"
      :style="{ width: 'min(28rem, calc(100vw - 2rem))' }"
    >
      <p>
        This permanently replaces every current league, season, fixture, and
        result.
      </p>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          @click="transfer.cancelImport"
        />
        <Button
          label="Replace all data"
          severity="danger"
          @click="transfer.applyImport('replace', true)"
        />
      </template>
    </Dialog>

    <Dialog
      :visible="Boolean(transfer.message.value) && !transfer.isPending.value"
      modal
      :closable="false"
      :close-on-escape="false"
      :header="transfer.isError.value ? 'Transfer failed' : 'Transfer complete'"
      :style="{ width: 'min(28rem, calc(100vw - 2rem))' }"
    >
      <p>{{ transfer.message.value }}</p>
      <div v-if="transfer.skippedLeagueNames.value.length">
        <p>
          The following leagues were skipped because their names already exist:
        </p>
        <ul>
          <li v-for="name in transfer.skippedLeagueNames.value" :key="name">
            {{ name }}
          </li>
        </ul>
      </div>
      <template #footer>
        <Button label="Close" @click="transfer.clearMessage" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.transfer-actions {
  display: flex;
  gap: 0.45rem;
}
.transfer-actions :deep(.p-button) {
  padding: 0.45rem 0.7rem;
  border-color: var(--color-line);
  color: var(--color-muted);
  font: 700 0.68rem/1 var(--font-utility);
  letter-spacing: 0.08em;
}
.transfer-actions :deep(.p-button:focus-visible) {
  outline: 2px solid var(--color-floodlight);
  outline-offset: 3px;
}
.sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 640px) {
  .transfer-actions :deep(.p-button) {
    padding-inline: 0.5rem;
    font-size: 0.62rem;
  }
}
</style>
