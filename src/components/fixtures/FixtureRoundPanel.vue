<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { reactive, shallowRef, watch } from 'vue'

import type { Match, Team } from '@/domain/models'
import { validateCardCount, validateScore } from '@/domain/validation'
import type { RoundMatchResultInput } from '@/stores/season'

interface MatchDraft {
  homeScore: string
  awayScore: string
  homeYellowCards: string
  awayYellowCards: string
  homeRedCards: string
  awayRedCards: string
}

const props = defineProps<{
  leg: number
  round: number
  matches: Match[]
  teams: Team[]
}>()

const emit = defineEmits<{
  save: [updates: RoundMatchResultInput[]]
}>()

const editing = shallowRef(false)
const errorMessage = shallowRef('')
const invalidFieldId = shallowRef('')
const drafts = reactive<Record<string, MatchDraft>>({})

watch(
  () => props.matches,
  () => resetDrafts(),
  { immediate: true, deep: true },
)

function teamName(teamId: string): string {
  return props.teams.find((team) => team.id === teamId)?.name ?? 'Unknown team'
}

function beginEditing(): void {
  resetDrafts()
  errorMessage.value = ''
  invalidFieldId.value = ''
  editing.value = true
}

function cancelEditing(): void {
  resetDrafts()
  errorMessage.value = ''
  invalidFieldId.value = ''
  editing.value = false
}

function saveRound(): void {
  const updates: RoundMatchResultInput[] = []

  for (const match of props.matches) {
    const draft = drafts[match.id]
    if (!draft) continue

    const fields = [
      {
        key: 'homeScore' as const,
        value: draft.homeScore,
        label: `${teamName(match.homeTeamId)} score`,
        validate: validateScore,
      },
      {
        key: 'awayScore' as const,
        value: draft.awayScore,
        label: `${teamName(match.awayTeamId)} score`,
        validate: validateScore,
      },
      {
        key: 'homeYellowCards' as const,
        value: draft.homeYellowCards,
        label: `${teamName(match.homeTeamId)} yellow cards`,
        validate: validateCardCount,
      },
      {
        key: 'awayYellowCards' as const,
        value: draft.awayYellowCards,
        label: `${teamName(match.awayTeamId)} yellow cards`,
        validate: validateCardCount,
      },
      {
        key: 'homeRedCards' as const,
        value: draft.homeRedCards,
        label: `${teamName(match.homeTeamId)} red cards`,
        validate: validateCardCount,
      },
      {
        key: 'awayRedCards' as const,
        value: draft.awayRedCards,
        label: `${teamName(match.awayTeamId)} red cards`,
        validate: validateCardCount,
      },
    ]
    const result: Record<string, number | null> = {}

    for (const field of fields) {
      const validation = field.validate(field.value, field.label)
      if (!validation.valid) {
        errorMessage.value = validation.error
        invalidFieldId.value = `${match.id}-${field.key}`
        return
      }
      result[field.key] = validation.value
    }

    updates.push({ matchId: match.id, result })
  }

  emit('save', updates)
  editing.value = false
  errorMessage.value = ''
  invalidFieldId.value = ''
}

function resetDrafts(): void {
  for (const key of Object.keys(drafts)) delete drafts[key]

  for (const match of props.matches) {
    drafts[match.id] = {
      homeScore: match.homeScore?.toString() ?? '',
      awayScore: match.awayScore?.toString() ?? '',
      homeYellowCards: match.homeYellowCards.toString(),
      awayYellowCards: match.awayYellowCards.toString(),
      homeRedCards: match.homeRedCards.toString(),
      awayRedCards: match.awayRedCards.toString(),
    }
  }
}
</script>

<template>
  <article class="round-panel" :aria-labelledby="`round-${leg}-${round}`">
    <header class="round-header">
      <div class="round-identity">
        <span>Leg {{ leg }}</span>
        <h3 :id="`round-${leg}-${round}`">Round {{ round }}</h3>
      </div>

      <div class="round-actions">
        <template v-if="editing">
          <Button
            label="Cancel"
            severity="secondary"
            text
            size="small"
            @click="cancelEditing"
          />
          <Button
            :label="`Save results for Round ${round}`"
            icon="pi pi-check"
            size="small"
            @click="saveRound"
          />
        </template>
        <Button
          v-else
          :label="`Edit results for Round ${round}`"
          icon="pi pi-pencil"
          size="small"
          @click="beginEditing"
        />
      </div>
    </header>

    <Message
      v-if="errorMessage"
      :id="`round-${leg}-${round}-error`"
      severity="error"
      size="small"
      variant="simple"
      class="round-error"
    >
      {{ errorMessage }}
    </Message>

    <div class="fixture-list">
      <section
        v-for="match in matches"
        :key="match.id"
        class="fixture-row"
        :aria-label="`${teamName(match.homeTeamId)} versus ${teamName(match.awayTeamId)}`"
      >
        <div class="scoreline">
          <strong class="team-name home-team">{{
            teamName(match.homeTeamId)
          }}</strong>

          <div class="score-center">
            <template v-if="editing && drafts[match.id]">
              <label class="visually-hidden" :for="`${match.id}-home-score`">
                {{ teamName(match.homeTeamId) }} score
              </label>
              <input
                :id="`${match.id}-home-score`"
                v-model="drafts[match.id]!.homeScore"
                class="score-input"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                :aria-invalid="invalidFieldId === `${match.id}-homeScore`"
                :aria-describedby="
                  invalidFieldId === `${match.id}-homeScore`
                    ? `round-${leg}-${round}-error`
                    : undefined
                "
              />
              <span class="versus" aria-hidden="true">v</span>
              <label class="visually-hidden" :for="`${match.id}-away-score`">
                {{ teamName(match.awayTeamId) }} score
              </label>
              <input
                :id="`${match.id}-away-score`"
                v-model="drafts[match.id]!.awayScore"
                class="score-input"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                :aria-invalid="invalidFieldId === `${match.id}-awayScore`"
                :aria-describedby="
                  invalidFieldId === `${match.id}-awayScore`
                    ? `round-${leg}-${round}-error`
                    : undefined
                "
              />
            </template>
            <template v-else>
              <span class="score-value">{{ match.homeScore ?? '—' }}</span>
              <span class="versus" aria-hidden="true">v</span>
              <span class="score-value">{{ match.awayScore ?? '—' }}</span>
            </template>
          </div>

          <strong class="team-name away-team">{{
            teamName(match.awayTeamId)
          }}</strong>
        </div>

        <fieldset v-if="editing && drafts[match.id]" class="discipline-grid">
          <legend class="visually-hidden">
            Cards for {{ teamName(match.homeTeamId) }} versus
            {{ teamName(match.awayTeamId) }}
          </legend>
          <label>
            <span>{{ teamName(match.homeTeamId) }} yellow cards</span>
            <input
              :id="`${match.id}-homeYellowCards`"
              v-model="drafts[match.id]!.homeYellowCards"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              :aria-invalid="invalidFieldId === `${match.id}-homeYellowCards`"
              :aria-describedby="
                invalidFieldId === `${match.id}-homeYellowCards`
                  ? `round-${leg}-${round}-error`
                  : undefined
              "
            />
          </label>
          <label>
            <span>{{ teamName(match.homeTeamId) }} red cards</span>
            <input
              :id="`${match.id}-homeRedCards`"
              v-model="drafts[match.id]!.homeRedCards"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              :aria-invalid="invalidFieldId === `${match.id}-homeRedCards`"
              :aria-describedby="
                invalidFieldId === `${match.id}-homeRedCards`
                  ? `round-${leg}-${round}-error`
                  : undefined
              "
            />
          </label>
          <label>
            <span>{{ teamName(match.awayTeamId) }} yellow cards</span>
            <input
              :id="`${match.id}-awayYellowCards`"
              v-model="drafts[match.id]!.awayYellowCards"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              :aria-invalid="invalidFieldId === `${match.id}-awayYellowCards`"
              :aria-describedby="
                invalidFieldId === `${match.id}-awayYellowCards`
                  ? `round-${leg}-${round}-error`
                  : undefined
              "
            />
          </label>
          <label>
            <span>{{ teamName(match.awayTeamId) }} red cards</span>
            <input
              :id="`${match.id}-awayRedCards`"
              v-model="drafts[match.id]!.awayRedCards"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              :aria-invalid="invalidFieldId === `${match.id}-awayRedCards`"
              :aria-describedby="
                invalidFieldId === `${match.id}-awayRedCards`
                  ? `round-${leg}-${round}-error`
                  : undefined
              "
            />
          </label>
        </fieldset>
      </section>
    </div>
  </article>
</template>

<style scoped>
.round-panel {
  overflow: hidden;
  border: 1px solid var(--color-line-strong);
  border-radius: 0.85rem;
  background: var(--color-panel-deep);
  box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 12%);
}

.round-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 5.25rem;
  padding: 1rem clamp(1rem, 3vw, 1.5rem);
  border-bottom: 1px solid var(--color-line-strong);
  background: var(--color-panel-raised);
}

.round-identity {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
}

.round-identity span {
  color: var(--color-floodlight);
  font: 700 0.64rem/1 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.round-identity h3 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.035em;
}

.round-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
}

.round-actions :deep(.p-button) {
  min-height: 2.75rem;
}

.round-error {
  margin: 0.8rem 1.25rem 0;
}

.fixture-list {
  padding-inline: clamp(1rem, 3vw, 1.5rem);
}

.fixture-row {
  padding-block: clamp(1.25rem, 3vw, 1.8rem);
  border-bottom: 1px solid var(--color-line);
}

.fixture-row:last-child {
  border-bottom: 0;
}

.scoreline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8rem, auto) minmax(0, 1fr);
  align-items: center;
  gap: clamp(0.75rem, 3vw, 2rem);
}

.team-name {
  overflow: hidden;
  font-family: var(--font-headline);
  font-size: clamp(1.05rem, 2.6vw, 1.5rem);
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
}

.home-team {
  text-align: right;
}

.away-team {
  text-align: left;
}

.score-center {
  display: grid;
  grid-template-columns: 3.25rem 1rem 3.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.score-value,
.score-input {
  width: 3.25rem;
  height: 3.25rem;
  border: 1px solid var(--color-line-strong);
  border-radius: 0.45rem;
  background: var(--color-panel);
  color: var(--color-chalk);
  font: 750 1.15rem/1 var(--font-utility);
  text-align: center;
}

.score-value {
  display: grid;
  place-items: center;
}

.score-input {
  appearance: textfield;
}

.score-input::-webkit-inner-spin-button {
  appearance: none;
}

.versus {
  color: var(--color-muted);
  font: 700 0.72rem/1 var(--font-utility);
  text-align: center;
  text-transform: uppercase;
}

.discipline-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  max-width: 46rem;
  margin: 1.25rem auto 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.6rem;
  background: var(--color-panel);
  min-inline-size: 0;
}

.discipline-grid label {
  display: grid;
  gap: 0.45rem;
}

.discipline-grid span {
  color: var(--color-muted);
  font: 600 0.63rem/1.35 var(--font-utility);
}

.discipline-grid input {
  width: 100%;
  min-width: 0;
  padding: 0.55rem;
  border: 1px solid var(--color-line-strong);
  border-radius: 0.35rem;
  background: var(--color-panel-deep);
  color: var(--color-chalk);
}

@media (max-width: 720px) {
  .round-header {
    align-items: flex-start;
  }

  .round-actions {
    flex-wrap: wrap;
  }

  .scoreline {
    grid-template-columns: minmax(0, 1fr) 7rem minmax(0, 1fr);
    gap: 0.5rem;
  }

  .score-center {
    grid-template-columns: 2.75rem 0.5rem 2.75rem;
    gap: 0.25rem;
  }

  .score-value,
  .score-input {
    width: 2.75rem;
    height: 2.75rem;
  }

  .discipline-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .round-header {
    display: grid;
  }

  .round-actions {
    justify-content: flex-start;
  }

  .team-name {
    font-size: 0.95rem;
  }
}
</style>
