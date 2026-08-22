<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'

import type { League, Season } from '@/domain/models'
import { selectFinalizedRosterRange } from '@/domain/rosterSelection'
import { isSeasonComplete } from '@/domain/seasonStandings'
import { editableInputAttributes } from '@/components/forms/editableInputAttributes'

const props = defineProps<{
  leagues: readonly League[]
  seasons: readonly Season[]
  draftInput: string
  disabled: boolean
}>()

const emit = defineEmits<{
  import: [names: string[]]
}>()

const sourceLeagueId = shallowRef<string | null>(null)
const sourceSeasonId = shallowRef<string | null>(null)
const fromPosition = shallowRef('1')
const toPosition = shallowRef('')
const error = shallowRef('')
const errorElement = useTemplateRef<globalThis.HTMLElement>('importError')

const completedSeasons = computed(() =>
  props.seasons.filter((season) => isSeasonComplete(season)),
)
const availableLeagues = computed(() =>
  props.leagues.filter((league) =>
    completedSeasons.value.some((season) => season.leagueId === league.id),
  ),
)
const availableSeasons = computed(() =>
  completedSeasons.value.filter(
    (season) => season.leagueId === sourceLeagueId.value,
  ),
)
const selectedSeason = computed(() =>
  availableSeasons.value.find((season) => season.id === sourceSeasonId.value),
)
const selectionCount = computed(() => {
  const from = Number(fromPosition.value)
  const to = Number(toPosition.value)
  return Number.isInteger(from) && Number.isInteger(to) && to >= from
    ? to - from + 1
    : 0
})

watch(
  availableLeagues,
  (leagues) => {
    if (!leagues.some((league) => league.id === sourceLeagueId.value)) {
      sourceLeagueId.value = leagues[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(
  availableSeasons,
  (seasons) => {
    if (!seasons.some((season) => season.id === sourceSeasonId.value)) {
      sourceSeasonId.value = seasons[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(selectedSeason, (season) => {
  fromPosition.value = '1'
  toPosition.value = season ? String(season.teams.length) : ''
  error.value = ''
})

async function importSelection(): Promise<void> {
  if (!selectedSeason.value || props.disabled) return

  const result = selectFinalizedRosterRange({
    sourceSeason: selectedSeason.value,
    fromPosition: Number(fromPosition.value),
    toPosition: Number(toPosition.value),
    draftNames: props.draftInput
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean),
  })

  if (!result.success) {
    error.value = result.message
    await nextTick()
    errorElement.value?.focus()
    return
  }

  error.value = ''
  emit('import', result.names)
}
</script>

<template>
  <section class="roster-import" aria-labelledby="roster-import-title">
    <div class="import-heading">
      <div>
        <p class="eyebrow">Optional roster shortcut</p>
        <h2 id="roster-import-title">Import from a previous season</h2>
      </div>
      <span v-if="selectedSeason" class="selection-summary">
        Rows {{ fromPosition || '—' }}–{{ toPosition || '—' }} ·
        {{ selectionCount }} teams
      </span>
    </div>

    <p v-if="availableLeagues.length === 0" class="empty-message">
      Import is unavailable because there are no completed seasons yet. You can
      still enter the roster manually below.
    </p>

    <div v-else class="import-controls">
      <div class="field-group">
        <label for="source-league">Source league</label>
        <select
          id="source-league"
          v-model="sourceLeagueId"
          :disabled="disabled"
          class="select-control"
        >
          <option
            v-for="league in availableLeagues"
            :key="league.id"
            :value="league.id"
          >
            {{ league.name }}
          </option>
        </select>
      </div>

      <div class="field-group">
        <label for="source-season">Completed season</label>
        <select
          id="source-season"
          v-model="sourceSeasonId"
          :disabled="disabled"
          class="select-control"
        >
          <option
            v-for="season in availableSeasons"
            :key="season.id"
            :value="season.id"
          >
            {{ season.name }}
          </option>
        </select>
      </div>

      <div class="field-group position-field">
        <label for="from-position">From position</label>
        <InputText
          v-bind="editableInputAttributes"
          id="from-position"
          v-model="fromPosition"
          type="number"
          inputmode="numeric"
          min="1"
          :max="selectedSeason?.teams.length"
          :disabled="disabled"
        />
      </div>

      <div class="field-group position-field">
        <label for="to-position">To position</label>
        <InputText
          v-bind="editableInputAttributes"
          id="to-position"
          v-model="toPosition"
          type="number"
          inputmode="numeric"
          min="1"
          :max="selectedSeason?.teams.length"
          :disabled="disabled"
        />
      </div>

      <Button
        label="Add teams to draft"
        type="button"
        :disabled="disabled || !selectedSeason"
        @click="importSelection"
      />
    </div>

    <p
      v-if="error"
      ref="importError"
      class="import-error"
      role="alert"
      tabindex="-1"
    >
      {{ error }}
    </p>
  </section>
</template>

<style scoped>
.roster-import {
  display: grid;
  gap: 1rem;
  padding: clamp(1.25rem, 4vw, 2.25rem);
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-panel);
}

.import-heading,
.import-controls {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.eyebrow,
.selection-summary,
.empty-message {
  color: var(--color-muted);
  font: 600 0.72rem/1.5 var(--font-utility);
}

.eyebrow,
.empty-message {
  margin: 0;
}

.roster-import h2 {
  margin: 0.25rem 0 0;
  font-size: 1.15rem;
}

.field-group {
  display: grid;
  flex: 1 1 11rem;
  gap: 0.4rem;
}

.field-group label {
  font-size: 0.78rem;
  font-weight: 750;
}

.select-control {
  min-height: 2.6rem;
  padding: 0 0.7rem;
  border: 1px solid var(--p-inputtext-border-color);
  border-radius: var(--p-inputtext-border-radius);
  color: var(--color-chalk);
  background: var(--p-inputtext-background);
}

.position-field {
  flex-basis: 7rem;
  max-width: 8rem;
}

.import-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.82rem;
}

@media (max-width: 820px) {
  .import-heading,
  .import-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .field-group,
  .position-field {
    width: 100%;
    max-width: none;
  }
}
</style>
