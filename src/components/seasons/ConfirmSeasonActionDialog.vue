<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

defineProps<{
  title: string
  confirmLabel: string
  detail: string
}>()

const emit = defineEmits<{
  confirm: []
}>()

const visible = defineModel<boolean>('visible', { required: true })
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="title"
    class="season-action-dialog"
  >
    <p class="dialog-detail">{{ detail }}</p>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        text
        @click="visible = false"
      />
      <Button
        :label="confirmLabel"
        severity="danger"
        @click="emit('confirm')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-detail {
  width: min(30rem, calc(100vw - 4rem));
  margin: 0;
  color: var(--color-soft);
  line-height: 1.65;
}
</style>
