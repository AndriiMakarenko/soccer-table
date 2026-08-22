<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { reactive, shallowRef, watch } from 'vue'

import { parseBulkTeamInput } from '@/stores/season'
import { validateLegCount, validateName } from '@/domain/validation'
import {
  editableInputAttributes,
  freeTextInputAttributes,
} from '@/components/forms/editableInputAttributes'

export interface SeasonSetupValues {
  name: string
  teamInput: string
  legCount: number
}

const props = defineProps<{
  submitting: boolean
  savePending: boolean
}>()
const teamInput = defineModel<string>('teamInput', { default: '' })

const emit = defineEmits<{
  submit: [values: SeasonSetupValues]
}>()

const form = reactive({
  name: '',
  legCount: '2',
})
const errors = reactive({
  name: '',
  teamInput: '',
  legCount: '',
})
const submissionQueued = shallowRef(false)

watch(
  () => props.submitting,
  (submitting) => {
    if (!submitting) submissionQueued.value = false
  },
)

function submit(): void {
  if (props.submitting || submissionQueued.value) return

  const nameResult = validateName(form.name, 'Season name')
  const teamsResult = parseBulkTeamInput(teamInput.value)
  const legsResult = validateLegCount(form.legCount)

  errors.name = nameResult.valid ? '' : nameResult.error
  errors.teamInput = teamsResult.valid ? '' : teamsResult.error
  errors.legCount = legsResult.valid ? '' : legsResult.error

  if (!nameResult.valid || !teamsResult.valid || !legsResult.valid) return

  submissionQueued.value = true
  emit('submit', {
    name: nameResult.value,
    teamInput: teamsResult.value.join('\n'),
    legCount: legsResult.value,
  })
}
</script>

<template>
  <form class="setup-form" novalidate @submit.prevent="submit">
    <div class="field-group">
      <label class="field-label" for="season-name">Season name</label>
      <InputText
        v-bind="freeTextInputAttributes"
        id="season-name"
        v-model="form.name"
        autocomplete="off"
        placeholder="e.g. 2026/27"
        :disabled="savePending"
        :invalid="Boolean(errors.name)"
        :aria-describedby="errors.name ? 'season-name-error' : undefined"
        class="field-control"
      />
      <Message
        v-if="errors.name"
        id="season-name-error"
        severity="error"
        size="small"
        variant="simple"
      >
        {{ errors.name }}
      </Message>
    </div>

    <div class="field-group field-group-wide">
      <div class="field-heading">
        <label class="field-label" for="team-names">Team names</label>
        <span>One team per line · 2–64 teams</span>
      </div>
      <Textarea
        v-bind="freeTextInputAttributes"
        id="team-names"
        v-model="teamInput"
        rows="10"
        placeholder="Northside FC\nRiverside United\nAthletic Club"
        :disabled="savePending"
        :invalid="Boolean(errors.teamInput)"
        :aria-describedby="
          errors.teamInput ? 'team-names-error' : 'team-names-help'
        "
        class="field-control team-input"
      />
      <span id="team-names-help" class="field-help">
        Blank lines are ignored. Names must be unique.
      </span>
      <Message
        v-if="errors.teamInput"
        id="team-names-error"
        severity="error"
        size="small"
        variant="simple"
      >
        {{ errors.teamInput }}
      </Message>
    </div>

    <div class="field-group">
      <label class="field-label" for="leg-count">Number of legs</label>
      <InputText
        v-bind="editableInputAttributes"
        id="leg-count"
        v-model="form.legCount"
        type="number"
        inputmode="numeric"
        min="1"
        max="4"
        step="1"
        :disabled="savePending"
        :invalid="Boolean(errors.legCount)"
        :aria-describedby="
          errors.legCount ? 'leg-count-error' : 'leg-count-help'
        "
        class="field-control leg-input"
      />
      <span id="leg-count-help" class="field-help">
        Choose between 1 and 4 meetings per pairing.
      </span>
      <Message
        v-if="errors.legCount"
        id="leg-count-error"
        severity="error"
        size="small"
        variant="simple"
      >
        {{ errors.legCount }}
      </Message>
    </div>

    <div class="form-actions">
      <Button
        label="Cancel"
        severity="secondary"
        text
        type="button"
        :disabled="submitting"
        :as="'router-link'"
        :to="{ name: 'league-detail' }"
      />
      <Button
        :label="
          savePending ? 'Retry saving season' : 'Create season & fixtures'
        "
        type="submit"
        :loading="submitting"
        :disabled="submitting"
      />
    </div>
  </form>
</template>

<style scoped>
.setup-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.45fr);
  gap: 1.5rem;
  padding: clamp(1.25rem, 4vw, 2.25rem);
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-panel);
}

.field-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.55rem;
}

.field-group-wide {
  grid-column: 1 / -1;
}

.field-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.field-heading span,
.field-help {
  color: var(--color-muted);
  font: 500 0.72rem/1.5 var(--font-utility);
}

.field-label {
  color: var(--color-chalk);
  font-size: 0.86rem;
  font-weight: 750;
}

.field-control {
  width: 100%;
}

.team-input {
  min-height: 15rem;
  resize: vertical;
  font-family: var(--font-utility);
  line-height: 1.65;
}

.leg-input {
  max-width: 8rem;
}

.form-actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  gap: 0.65rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-line);
}

@media (max-width: 680px) {
  .setup-form {
    grid-template-columns: 1fr;
  }

  .field-group-wide,
  .form-actions {
    grid-column: 1;
  }

  .field-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
  }

  .form-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
