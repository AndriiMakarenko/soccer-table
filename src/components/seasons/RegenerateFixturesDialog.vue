<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import {
  editableInputAttributes,
  freeTextInputAttributes,
} from '@/components/forms/editableInputAttributes'
import { shallowRef, watch } from 'vue'

export interface RegenerateFixturesValues {
  teamInput: string
  legCount: string
}

const props = defineProps<{
  initialTeamInput: string
  initialLegCount: number
  deletesResults: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  submit: [values: RegenerateFixturesValues]
}>()

const visible = defineModel<boolean>('visible', { required: true })
const teamInput = shallowRef('')
const legCount = shallowRef('1')

watch(
  visible,
  (isVisible) => {
    if (!isVisible) return
    teamInput.value = props.initialTeamInput
    legCount.value = String(props.initialLegCount)
  },
  { immediate: true },
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    header="Regenerate fixtures"
    class="regenerate-dialog"
  >
    <form
      class="regenerate-form"
      @submit.prevent="emit('submit', { teamInput, legCount })"
    >
      <p class="form-intro">
        This is the only flow that unlocks team changes after fixtures have been
        generated.
      </p>

      <Message v-if="deletesResults" severity="warn" :closable="false">
        Regenerating will permanently delete every recorded score and card.
      </Message>

      <Message
        v-if="errorMessage"
        severity="error"
        :closable="false"
        role="alert"
      >
        {{ errorMessage }}
      </Message>

      <div class="field-group">
        <label for="regenerate-team-input">Team names</label>
        <Textarea
          id="regenerate-team-input"
          v-model="teamInput"
          v-bind="freeTextInputAttributes"
          rows="8"
        />
        <small
          >One team per line. Team names stay locked outside this flow.</small
        >
      </div>

      <div class="field-group leg-field">
        <label for="regenerate-leg-count">Number of legs</label>
        <InputText
          v-bind="editableInputAttributes"
          id="regenerate-leg-count"
          v-model="legCount"
          type="number"
          inputmode="numeric"
          min="1"
          max="4"
          step="1"
        />
      </div>

      <div class="form-actions">
        <Button
          label="Cancel"
          severity="secondary"
          text
          type="button"
          @click="visible = false"
        />
        <Button label="Regenerate fixtures" severity="danger" type="submit" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.regenerate-form {
  display: grid;
  gap: 1rem;
  width: min(34rem, calc(100vw - 4rem));
}

.form-intro {
  margin: 0;
  color: var(--color-soft);
  line-height: 1.6;
}

.field-group {
  display: grid;
  gap: 0.5rem;
}

.field-group label {
  color: var(--color-chalk);
  font-size: 0.86rem;
  font-weight: 700;
}

.field-group small {
  color: var(--color-muted);
  line-height: 1.45;
}

.leg-field {
  max-width: 12rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
