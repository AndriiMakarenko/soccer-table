<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

defineProps<{
  entityKind: 'league' | 'season'
  entityName: string
  detail: string
}>()

const emit = defineEmits<{
  confirm: []
}>()

const visible = defineModel<boolean>('visible', { required: true })

function cancel(): void {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="`Delete ${entityKind}?`"
    class="delete-dialog"
  >
    <div class="delete-copy">
      <p>
        <strong>{{ entityName }}</strong> will be permanently deleted.
      </p>
      <p class="delete-detail">{{ detail }}</p>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="cancel" />
      <Button
        :label="`Delete ${entityKind}`"
        severity="danger"
        @click="emit('confirm')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.delete-copy {
  width: min(28rem, calc(100vw - 4rem));
  color: var(--color-chalk);
  line-height: 1.6;
}

.delete-copy p {
  margin: 0;
}

.delete-detail {
  margin-top: 0.65rem !important;
  color: var(--color-muted);
  font-size: 0.9rem;
}
</style>
