# Round Robin Tournament Manager — Implementation Tasks

Complete tasks in order unless a task explicitly says it can run independently. Check the task's top-level checkbox only after its implementation, tests, and listed verification are complete.

## Definition of Done for Every Task

- The project builds and all existing tests pass.
- New or changed business logic has focused Vitest coverage.
- TypeScript checks pass without introducing suppressions solely to silence errors.
- User-facing behavior includes appropriate validation and error states.
- The task does not introduce features listed as MVP non-goals in `PRD.md`.

## Foundation

- [x] **T01 — Scaffold the Vue application and test toolchain**
  - Create a Vue 3 + Vite + TypeScript project using pnpm.
  - Configure Pinia, Vue Router, Tailwind CSS, PrimeVue, and Vitest.
  - Add a minimal dark application shell and placeholder dashboard route at `/`.
  - Add scripts for development, build, type checking, and unit tests.
  - Verify the production build and a smoke test both pass.

- [x] **T02 — Define domain models and shared validation helpers**
  - Depends on T01.
  - Add typed models for `Team`, `Match`, `Season`, `League`, `AppState`, and table modes.
  - Represent unplayed scores as `null`, card counts as numbers defaulting to `0`, and locked random tiebreakers in season data.
  - Add reusable helpers for IDs/timestamps and validation of names, non-negative integers, scores, card counts, team count (2–64), and leg count (1–4).
  - Cover validation boundaries and invalid inputs with Vitest.

- [x] **T03 — Implement the isolated localStorage persistence service**
  - Depends on T02.
  - Add a versioned storage key and typed `load`/`save` API so callers do not access localStorage directly.
  - Return safe empty state for missing or corrupted data without crashing the app.
  - Distinguish quota failures and expose the required user-facing storage-full message; never silently report a failed save as successful.
  - Test save/load, missing data, corrupted data, and quota-exceeded behavior with a mocked localStorage.

## Core Business Logic

- [x] **T04 — Build and test the round-robin fixture generator**
  - Depends on T02.
  - Generate fixtures for 2–64 teams and 1–4 legs, using a hidden scheduling BYE when needed but never emitting a BYE match.
  - Ensure every pair meets once per leg, no team plays itself or twice in a round, and each fixture has all required default score/card fields.
  - Reverse home/away in leg 2 and alternate subsequent legs as evenly as possible.
  - Test even and odd team counts, pairing uniqueness, round participation, two-leg reversal, four legs, and the 64-team boundary.

- [ ] **T05 — Calculate standings statistics and table-mode average totals**
  - Depends on T02.
  - Derive PLD, W, D, L, SF, SA, SD, PTS, and penalty points from played fixtures only.
  - Support Overall, Home only, and Away only modes, recalculating every statistic from that mode's match set.
  - Calculate average total as `(sum(SF) / sum(PLD)) * 2`, formatted to exactly two decimals, or `N/A` when no games qualify.
  - Test wins/draws/losses, cleared or partial scores, goals, card penalties, all three modes, and average-total formatting.

- [ ] **T06 — Implement deterministic ranking through penalty points**
  - Depends on T05.
  - Rank by points, goal difference, tied-group head-to-head points, tied-group head-to-head goals scored, total goals scored, then lower penalty points.
  - For three or more tied teams, compute head-to-head values from a mini-table containing only matches among the tied group.
  - While unresolved, assign equal positions using standard competition ranking such as `1, 1, 3`.
  - Apply the same ranking calculation independently to Overall, Home only, and Away only data.
  - Add focused tests for every ranking stage, two-team and multi-team ties, and shared positions.

- [ ] **T07 — Add season completion and locked random tiebreakers**
  - Depends on T06.
  - Detect completion only when every fixture has both scores.
  - Do not randomize unresolved ties while a season is incomplete.
  - On completion, create and persist one random order per fully tied group, then reuse it on later calculations and reloads.
  - Invalidate stale locks when edited results make the season incomplete or change the relevant tie group; preserve unaffected locks.
  - Make random selection injectable in tests and cover generation, stability, reload behavior, and invalidation.

## State Management

- [ ] **T08 — Implement league and season CRUD stores with persistence**
  - Depends on T03.
  - Create Pinia stores for loading, creating, renaming, and deleting leagues and their seasons.
  - Keep league and season relationships consistent; deleting a league also removes its seasons after confirmation by the calling UI.
  - Persist each successful mutation and expose save failures without discarding the current in-memory state.
  - Add store tests for CRUD, relationships, reload, and persistence failures.

- [ ] **T09 — Implement team setup, fixture lifecycle, and result mutations in the season store**
  - Depends on T04, T07, and T08.
  - Parse bulk team input by trimming lines and ignoring empty lines; reject duplicates, fewer than 2 teams, and more than 64 teams.
  - Generate 1–4 legs through the fixture generator and lock team editing once fixtures exist.
  - Validate and update scores/cards, allow scores to be cleared back to `null`, persist mutations, and invalidate random locks as required.
  - Implement reset-all-results and fixture regeneration, requiring the UI caller to explicitly confirm destructive regeneration when results exist.
  - Test parsing, limits, locking, updates/clearing, reset, regeneration guards, persistence, and tiebreaker invalidation.

## League and Season User Flows

- [ ] **T10 — Build dashboard and league-management UI**
  - Depends on T08.
  - Implement `/` with a league list plus create, rename, open, and confirmed-delete actions.
  - Implement `/leagues/:leagueId` with its season list and create, rename, open, and confirmed-delete actions.
  - Add empty states, inline/form validation, missing-league handling, and visible persistence error feedback.
  - Use accessible PrimeVue controls and responsive dark-theme layout for desktop and tablet.
  - Add component tests for the main CRUD interactions and confirmations.

- [ ] **T11 — Build season creation and team-entry flow**
  - Depends on T09 and T10.
  - Implement `/leagues/:leagueId/seasons/new` for season name, bulk team names, and number of legs.
  - Show clear validation for duplicate names, team-count limits, and invalid leg counts.
  - Create the season and generate fixtures, then navigate to its overview.
  - Prevent accidental duplicate submission and surface persistence errors without losing entered form data.
  - Add component tests for valid creation and each major validation path.

- [ ] **T12 — Build the season overview and lifecycle actions**
  - Depends on T09 and T11.
  - Implement `/leagues/:leagueId/seasons/:seasonId` with season summary, team count, leg count, fixture/result progress, and links to fixtures and standings.
  - Support season rename, reset all results, and fixture regeneration.
  - Require explicit confirmation before reset and before regeneration that would delete results; keep team editing locked until the accepted reset/regeneration flow permits it.
  - Handle missing league/season route parameters with a useful not-found state.
  - Test lifecycle confirmations, cancellation, and navigation.

## Fixtures and Results UI

- [ ] **T13 — Build grouped fixture display and round editing UI**
  - Depends on T09 and T12.
  - Implement `/leagues/:leagueId/seasons/:seasonId/fixtures`, grouped by leg and round.
  - Render each round in a bordered dark panel with a strong left-aligned title and prominent right-aligned edit action.
  - Use spacious fixture rows with large team names and score inputs visually centered between the teams.
  - Allow round-level editing of nullable scores and both teams' yellow/red card counts; update standings immediately through store mutations.
  - Enforce non-negative-integer validation, allow score clearing, keep cards defaulted to zero, and show persistence errors.
  - Add component tests for grouping, edit/save, validation, clearing a score, and card entry.

## Standings UI

- [ ] **T14 — Build the standings page with Overall/Home/Away modes**
  - Depends on T07, T09, and T12.
  - Implement `/leagues/:leagueId/seasons/:seasonId/table` with an easy-to-use Overall, Home only, and Away only selector.
  - Display POS, Team, PLD, W, D, L, SF, SA, SD, and PTS in a dense dark table with aligned compact numeric columns and row dividers.
  - Keep team names readable and the table usable with 20+ teams, including horizontal overflow where needed on tablets.
  - Show `Average total: NN.NN` or `Average total: N/A` below the table for the active mode.
  - Correctly render shared positions while incomplete and locked final order when complete.
  - Add component tests for columns, mode switching, filtered values, average total, tied positions, and completed-season ordering.

## Application Integration and Hardening

- [ ] **T15 — Complete routing, navigation, and global error presentation**
  - Depends on T10–T14.
  - Wire all specified routes, breadcrumbs/back navigation, and sensible redirects after create/delete actions.
  - Add a consistent not-found experience for invalid URLs and deleted entities.
  - Present localStorage quota/save errors clearly at application level using the message required by the PRD, while preserving actionable in-memory/form state.
  - Confirm a reload restores leagues, seasons, fixtures, results, cards, and locked random tiebreakers.
  - Add integration tests for representative navigation, reload restoration, invalid routes, and quota-error presentation.

- [ ] **T16 — Perform final responsive UI polish and accessibility pass**
  - Depends on T15.
  - Apply a cohesive dark visual system using PrimeVue for controls and Tailwind for spacing/layout.
  - Verify fixture score controls stay centered, round actions remain prominent, and standings remain scan-friendly at desktop and tablet widths.
  - Add labels, focus states, keyboard access, semantic headings/tables, and adequate contrast for primary workflows.
  - Remove placeholder UI and verify empty, loading, validation, confirmation, and failure states are visually consistent.
  - Run the complete typecheck, unit/component test suite, and production build; manually smoke-test the acceptance criteria in `PRD.md`.
