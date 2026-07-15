<script setup lang="ts">
import { computed } from 'vue'

import type { Match, Season } from '@/domain/models'
import type { RoundMatchResultInput } from '@/stores/season'

import FixtureRoundPanel from './FixtureRoundPanel.vue'

interface FixtureRound {
  leg: number
  round: number
  matches: Match[]
}

const props = defineProps<{
  season: Season
}>()

const emit = defineEmits<{
  saveRound: [updates: RoundMatchResultInput[]]
}>()

const roundsByLeg = computed(() => {
  const groups = new Map<number, Map<number, Match[]>>()

  for (const match of props.season.matches) {
    const rounds = groups.get(match.leg) ?? new Map<number, Match[]>()
    const matches = rounds.get(match.round) ?? []
    matches.push(match)
    rounds.set(match.round, matches)
    groups.set(match.leg, rounds)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([leg, rounds]) => ({
      leg,
      rounds: [...rounds.entries()]
        .sort(([left], [right]) => left - right)
        .map(([round, matches]): FixtureRound => ({ leg, round, matches })),
    }))
})
</script>

<template>
  <div class="fixtures-board">
    <section
      v-for="legGroup in roundsByLeg"
      :key="legGroup.leg"
      class="leg-group"
      :aria-labelledby="`leg-${legGroup.leg}-title`"
    >
      <header class="leg-header">
        <p>Schedule block</p>
        <h2 :id="`leg-${legGroup.leg}-title`">Leg {{ legGroup.leg }}</h2>
        <span>
          {{ legGroup.rounds.length }}
          {{ legGroup.rounds.length === 1 ? 'round' : 'rounds' }}
        </span>
      </header>

      <div class="round-list">
        <FixtureRoundPanel
          v-for="roundGroup in legGroup.rounds"
          :key="`${roundGroup.leg}-${roundGroup.round}`"
          :leg="roundGroup.leg"
          :round="roundGroup.round"
          :matches="roundGroup.matches"
          :teams="season.teams"
          @save="emit('saveRound', $event)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.fixtures-board,
.leg-group,
.round-list {
  display: grid;
}

.fixtures-board {
  gap: clamp(1.5rem, 3.5vw, 2.5rem);
}

.leg-group {
  gap: 0.55rem;
}

.leg-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: baseline;
  gap: 0.45rem;
  padding-inline: 0.15rem;
}

.leg-header p,
.leg-header span {
  margin: 0;
  color: var(--color-muted);
  font: 600 0.58rem/1 var(--font-utility);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.leg-header h2 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: clamp(1.2rem, 2.5vw, 1.55rem);
  letter-spacing: -0.04em;
}

.leg-header::after {
  grid-column: 1 / -1;
  height: 1px;
  content: '';
  background: linear-gradient(
    90deg,
    var(--color-floodlight),
    var(--color-line) 35%,
    transparent
  );
}

.round-list {
  gap: 0.5rem;
}

@media (max-width: 520px) {
  .leg-header {
    grid-template-columns: 1fr auto;
  }

  .leg-header p {
    display: none;
  }
}
</style>
