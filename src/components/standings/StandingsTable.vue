<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import type { Season, TableMode } from '@/domain/models'
import { calculateSeasonStandings } from '@/domain/seasonStandings'

interface TableModeOption {
  label: string
  shortLabel: string
  value: TableMode
}

const props = defineProps<{
  season: Season
}>()

const modeOptions: readonly TableModeOption[] = [
  { label: 'Overall', shortLabel: 'All matches', value: 'overall' },
  { label: 'Home only', shortLabel: 'At home', value: 'home' },
  { label: 'Away only', shortLabel: 'On the road', value: 'away' },
]
const activeMode = shallowRef<TableMode>('overall')
const standings = computed(() =>
  calculateSeasonStandings(props.season, activeMode.value),
)
const activeOption = computed(
  () =>
    modeOptions.find((option) => option.value === activeMode.value) ??
    modeOptions[0]!,
)
const tableCaption = computed(
  () => `${activeOption.value.label} standings for ${props.season.name}`,
)
</script>

<template>
  <section class="standings-board" aria-labelledby="standings-board-title">
    <div class="mode-console">
      <div>
        <p class="console-label">Table channel</p>
        <h2 id="standings-board-title">{{ activeOption.shortLabel }}</h2>
      </div>

      <div class="mode-selector" role="group" aria-label="Standings mode">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          class="mode-button"
          :class="{ 'mode-button--active': activeMode === option.value }"
          :aria-pressed="activeMode === option.value"
          aria-controls="season-standings-table"
          @click="activeMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div
      class="table-scroll"
      role="region"
      aria-label="Scrollable standings table"
      tabindex="0"
    >
      <table
        id="season-standings-table"
        class="standings-table"
        aria-label="Season standings"
      >
        <caption class="visually-hidden">
          {{
            tableCaption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="position-column">
              <abbr title="Position">POS</abbr>
            </th>
            <th scope="col" class="team-column">Team</th>
            <th scope="col"><abbr title="Played">PLD</abbr></th>
            <th scope="col"><abbr title="Won">W</abbr></th>
            <th scope="col"><abbr title="Drawn">D</abbr></th>
            <th scope="col"><abbr title="Lost">L</abbr></th>
            <th scope="col"><abbr title="Scored for">SF</abbr></th>
            <th scope="col"><abbr title="Scored against">SA</abbr></th>
            <th scope="col"><abbr title="Score difference">SD</abbr></th>
            <th scope="col" class="points-column">
              <abbr title="Points">PTS</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in standings.rows" :key="row.teamId">
            <td class="position-cell">{{ row.position }}</td>
            <th scope="row" class="team-cell" :title="row.teamName">
              {{ row.teamName }}
            </th>
            <td>{{ row.played }}</td>
            <td>{{ row.won }}</td>
            <td>{{ row.drawn }}</td>
            <td>{{ row.lost }}</td>
            <td>{{ row.scoredFor }}</td>
            <td>{{ row.scoredAgainst }}</td>
            <td>{{ row.scoreDifference }}</td>
            <td class="points-cell">{{ row.points }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="table-footer" aria-live="polite">
      <span>Average total:</span>
      <strong>{{ standings.averageTotal }}</strong>
    </footer>
  </section>
</template>

<style scoped>
.standings-board {
  width: min(100%, calc(40.5rem + 2px));
  overflow: hidden;
  border: 1px solid var(--color-line-strong);
  border-radius: 0.3rem;
  background: var(--color-panel-deep);
  box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 18%);
}

.mode-console {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid var(--color-line-strong);
  background: var(--color-panel-raised);
}

.console-label {
  margin: 0;
  color: var(--color-muted);
  font: 650 0.62rem/1 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mode-console h2 {
  margin: 0.3rem 0 0;
  color: var(--color-chalk);
  font: 750 1.15rem/1 var(--font-headline);
}

.mode-selector {
  display: inline-grid;
  grid-template-columns: repeat(3, auto);
  padding: 0.2rem;
  border: 1px solid var(--color-line-strong);
  border-radius: 0.25rem;
  background: var(--color-panel-deep);
}

.mode-button {
  min-height: 2.75rem;
  padding: 0.55rem 0.9rem;
  border: 0;
  border-radius: 0.15rem;
  background: transparent;
  color: var(--color-soft);
  cursor: pointer;
  font: 700 0.7rem/1 var(--font-utility);
  letter-spacing: 0.02em;
}

.mode-button:hover {
  color: var(--color-chalk);
}

.mode-button--active {
  background: var(--color-floodlight-strong);
  color: #fff;
  box-shadow: inset 0 -2px 0 var(--color-floodlight);
}

.table-scroll {
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.standings-table {
  width: 40.5rem;
  min-width: 40.5rem;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.standings-table th,
.standings-table td {
  height: 2.85rem;
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--color-line);
  text-align: center;
}

.standings-table thead th {
  height: 2.5rem;
  background: var(--color-panel);
  color: var(--color-muted);
  font: 750 0.65rem/1 var(--font-utility);
  letter-spacing: 0.07em;
}

.standings-table abbr {
  text-decoration: none;
}

.standings-table tbody td {
  color: var(--color-soft);
  font: 650 0.8rem/1 var(--font-utility);
}

.standings-table tbody tr:last-child th,
.standings-table tbody tr:last-child td {
  border-bottom: 0;
}

.standings-table tbody tr:hover {
  background: rgb(100 168 220 / 6%);
}

.position-column {
  width: 3.4rem;
}

.team-column {
  width: 9.5rem;
  text-align: left !important;
}

.points-column {
  width: 4.25rem;
  color: var(--color-floodlight) !important;
}

.position-cell {
  color: var(--color-muted) !important;
}

.team-cell {
  overflow: hidden;
  color: var(--color-chalk);
  font: 700 0.9rem/1.2 var(--font-headline);
  text-align: left !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.points-cell {
  color: var(--color-chalk) !important;
  font-weight: 850 !important;
}

.table-footer {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.8rem;
  padding: 1rem 1.15rem;
  border-top: 1px solid var(--color-line-strong);
  background: var(--color-panel);
}

.table-footer span {
  color: var(--color-muted);
  font: 650 0.65rem/1 var(--font-utility);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.table-footer strong {
  color: var(--color-referee);
  font: 800 1.25rem/1 var(--font-utility);
}

@media (max-width: 720px) {
  .mode-console {
    align-items: stretch;
    flex-direction: column;
  }

  .mode-selector {
    grid-template-columns: repeat(3, 1fr);
  }

  .mode-button {
    padding-inline: 0.45rem;
  }
}
</style>
