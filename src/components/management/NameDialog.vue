<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { shallowRef, watch } from 'vue'

import { validateName } from '@/domain/validation'

const props = defineProps<{
  title: string
  fieldLabel: string
  submitLabel: string
  initialName?: string
}>()

const emit = defineEmits<{
  submit: [name: string]
}>()

const visible = defineModel<boolean>('visible', { required: true })
const name = shallowRef('')
const errorMessage = shallowRef<string | null>(null)

watch(
  visible,
  (isVisible) => {
    if (!isVisible) return
    name.value = props.initialName ?? ''
    errorMessage.value = null
  },
  { immediate: true },
)

function submit(): void {
  const result = validateName(name.value, props.fieldLabel)

  if (!result.valid) {
    errorMessage.value = result.error
    return
  }

  errorMessage.value = null
  emit('submit', result.value)
}

function cancel(): void {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="title"
    class="name-dialog"
  >
    <form class="name-form" @submit.prevent="submit">
      <label class="field-label" for="entity-name">{{ fieldLabel }}</label>
      <InputText
        id="entity-name"
        v-model="name"
        autofocus
        autocomplete="off"
        :invalid="Boolean(errorMessage)"
        :aria-describedby="errorMessage ? 'entity-name-error' : undefined"
        class="name-input"
      />
      <Message
        v-if="errorMessage"
        id="entity-name-error"
        severity="error"
        size="small"
        variant="simple"
      >
        {{ errorMessage }}
      </Message>

      <div class="form-actions">
        <Button
          label="Cancel"
          severity="secondary"
          text
          type="button"
          @click="cancel"
        />
        <Button :label="submitLabel" type="submit" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.name-form {
  display: grid;
  gap: 0.75rem;
  width: min(28rem, calc(100vw - 4rem));
  padding-top: 0.5rem;
}

.field-label {
  color: var(--color-chalk);
  font-size: 0.86rem;
  font-weight: 700;
}

.name-input {
  width: 100%;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
