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

- [x] **T05 — Calculate standings statistics and table-mode average totals**
  - Depends on T02.
  - Derive PLD, W, D, L, SF, SA, SD, PTS, and penalty points from played fixtures only.
  - Support Overall, Home only, and Away only modes, recalculating every statistic from that mode's match set.
  - Calculate average total as `(sum(SF) / sum(PLD)) * 2`, formatted to exactly two decimals, or `N/A` when no games qualify.
  - Test wins/draws/losses, cleared or partial scores, goals, card penalties, all three modes, and average-total formatting.

- [x] **T06 — Implement deterministic ranking through penalty points**
  - Depends on T05.
  - Rank by points, goal difference, tied-group head-to-head points, tied-group head-to-head goals scored, total goals scored, then lower penalty points.
  - For three or more tied teams, compute head-to-head values from a mini-table containing only matches among the tied group.
  - While unresolved, assign equal positions using standard competition ranking such as `1, 1, 3`.
  - Apply the same ranking calculation independently to Overall, Home only, and Away only data.
  - Add focused tests for every ranking stage, two-team and multi-team ties, and shared positions.

- [x] **T07 — Add season completion and locked random tiebreakers**
  - Depends on T06.
  - Detect completion only when every fixture has both scores.
  - Do not randomize unresolved ties while a season is incomplete.
  - On completion, create and persist one random order per fully tied group, then reuse it on later calculations and reloads.
  - Invalidate stale locks when edited results make the season incomplete or change the relevant tie group; preserve unaffected locks.
  - Make random selection injectable in tests and cover generation, stability, reload behavior, and invalidation.

## State Management

- [x] **T08 — Implement league and season CRUD stores with persistence**
  - Depends on T03.
  - Create Pinia stores for loading, creating, renaming, and deleting leagues and their seasons.
  - Keep league and season relationships consistent; deleting a league also removes its seasons after confirmation by the calling UI.
  - Persist each successful mutation and expose save failures without discarding the current in-memory state.
  - Add store tests for CRUD, relationships, reload, and persistence failures.

- [x] **T09 — Implement team setup, fixture lifecycle, and result mutations in the season store**
  - Depends on T04, T07, and T08.
  - Parse bulk team input by trimming lines and ignoring empty lines; reject duplicates, fewer than 2 teams, and more than 64 teams.
  - Generate 1–4 legs through the fixture generator and lock team editing once fixtures exist.
  - Validate and update scores/cards, allow scores to be cleared back to `null`, persist mutations, and invalidate random locks as required.
  - Implement reset-all-results and fixture regeneration, requiring the UI caller to explicitly confirm destructive regeneration when results exist.
  - Test parsing, limits, locking, updates/clearing, reset, regeneration guards, persistence, and tiebreaker invalidation.

## League and Season User Flows

- [x] **T10 — Build dashboard and league-management UI**
  - Depends on T08.
  - Implement `/` with a league list plus create, rename, open, and confirmed-delete actions.
  - Implement `/leagues/:leagueId` with its season list and create, rename, open, and confirmed-delete actions.
  - Add empty states, inline/form validation, missing-league handling, and visible persistence error feedback.
  - Use accessible PrimeVue controls and responsive dark-theme layout for desktop and tablet.
  - Add component tests for the main CRUD interactions and confirmations.

- [x] **T11 — Build season creation and team-entry flow**
  - Depends on T09 and T10.
  - Implement `/leagues/:leagueId/seasons/new` for season name, bulk team names, and number of legs.
  - Show clear validation for duplicate names, team-count limits, and invalid leg counts.
  - Create the season and generate fixtures, then navigate to its overview.
  - Prevent accidental duplicate submission and surface persistence errors without losing entered form data.
  - Add component tests for valid creation and each major validation path.

- [x] **T12 — Build the season overview and lifecycle actions**
  - Depends on T09 and T11.
  - Implement `/leagues/:leagueId/seasons/:seasonId` with season summary, team count, leg count, fixture/result progress, and links to fixtures and standings.
  - Support season rename, reset all results, and fixture regeneration.
  - Require explicit confirmation before reset and before regeneration that would delete results; keep team editing locked until the accepted reset/regeneration flow permits it.
  - Handle missing league/season route parameters with a useful not-found state.
  - Test lifecycle confirmations, cancellation, and navigation.

## Fixtures and Results UI

- [x] **T13 — Build grouped fixture display and round editing UI**
  - Depends on T09 and T12.
  - Implement `/leagues/:leagueId/seasons/:seasonId/fixtures`, grouped by leg and round.
  - Render each round in a bordered dark panel with a strong left-aligned title and prominent right-aligned edit action.
  - Use spacious fixture rows with large team names and score inputs visually centered between the teams.
  - Allow round-level editing of nullable scores and both teams' yellow/red card counts; update standings immediately through store mutations.
  - Enforce non-negative-integer validation, allow score clearing, keep cards defaulted to zero, and show persistence errors.
  - Add component tests for grouping, edit/save, validation, clearing a score, and card entry.

## Standings UI

- [x] **T14 — Build the standings page with Overall/Home/Away modes**
  - Depends on T07, T09, and T12.
  - Implement `/leagues/:leagueId/seasons/:seasonId/table` with an easy-to-use Overall, Home only, and Away only selector.
  - Display POS, Team, PLD, W, D, L, SF, SA, SD, and PTS in a dense dark table with aligned compact numeric columns and row dividers.
  - Keep team names readable and the table usable with 20+ teams, including horizontal overflow where needed on tablets.
  - Show `Average total: NN.NN` or `Average total: N/A` below the table for the active mode.
  - Correctly render shared positions while incomplete and locked final order when complete.
  - Add component tests for columns, mode switching, filtered values, average total, tied positions, and completed-season ordering.

## Application Integration and Hardening

- [x] **T15 — Complete routing, navigation, and global error presentation**
  - Depends on T10–T14.
  - Wire all specified routes, breadcrumbs/back navigation, and sensible redirects after create/delete actions.
  - Add a consistent not-found experience for invalid URLs and deleted entities.
  - Present localStorage quota/save errors clearly at application level using the message required by the PRD, while preserving actionable in-memory/form state.
  - Confirm a reload restores leagues, seasons, fixtures, results, cards, and locked random tiebreakers.
  - Add integration tests for representative navigation, reload restoration, invalid routes, and quota-error presentation.

- [x] **T16 — Perform final responsive UI polish and accessibility pass**
  - Depends on T15.
  - Apply a cohesive dark visual system using PrimeVue for controls and Tailwind for spacing/layout.
  - Verify fixture score controls stay centered, round actions remain prominent, and standings remain scan-friendly at desktop and tablet widths.
  - Add labels, focus states, keyboard access, semantic headings/tables, and adequate contrast for primary workflows.
  - Remove placeholder UI and verify empty, loading, validation, confirmation, and failure states are visually consistent.
  - Run the complete typecheck, unit/component test suite, and production build; manually smoke-test the acceptance criteria in `PRD.md`.

## Follow-up UI Refinements

- [x] **T17 — Constrain standings table width and tighten column spacing**
  - Depends on T14.
  - Cap the standings table at 40.5rem on wide screens so numeric columns retain a compact, consistent rhythm instead of stretching with the page.
  - Reduce the Team column from 16rem to 9.5rem, approximately 1.7 times narrower, while preserving readable club names and ellipsis behavior for longer names.
  - Constrain the standings page header to the table width so the season name aligns with the table's right edge instead of sitting at the far side of the viewport.
  - Center the capped standings table and its matching header when the viewport is wider than the table.
  - Preserve contained horizontal scrolling on narrow screens without introducing page-level overflow.
  - Verify the layout at wide desktop and mobile viewport sizes with Playwright, then run the complete project check.

- [x] **T18 — Balance home and away assignments in generated fixtures**
  - Depends on T04 and T09.
  - Replace fully random home/away assignment during fixture generation with a schedule that aims for each team to alternate between home and away matches throughout the season.
  - Prefer a `home, away, home, away` sequence (or its inverse) for every team whenever the round-robin constraints allow it.
  - Allow no more than two consecutive home or two consecutive away matches when strict alternation is not possible.
  - Preserve the existing guarantees for pair uniqueness, round participation, leg count, BYE handling, and home/away reversal across legs.
  - Add focused fixture-generator tests covering even and odd team counts, unavoidable two-match home/away runs, multiple legs, and the absence of runs longer than two matches.
  - Run the complete project check after implementation.

- [x] **T19 — Make the fixture rounds view approximately twice as compact**
  - Depends on T13.
  - Reduce the overall size of the rounds/results editing view by approximately 50% so substantially more rounds and fixtures fit within the viewport.
  - Scale down round panels, titles, fixture rows, team names, score and card controls, edit actions, and other elements while preserving readability and usability.
  - Reduce vertical padding, margins, and gaps within and between round panels and fixture rows by approximately half.
  - Keep score controls aligned, editing actions discoverable, and touch/click targets practical at supported desktop and tablet viewport sizes.
  - Preserve responsive behavior, validation feedback, and contained overflow without changing fixture-result editing behavior.
  - Add or update focused component tests where markup or user-visible behavior changes, verify the denser layout with Playwright at desktop and tablet viewport sizes, then run the complete project check.

## Tauri v2 Desktop and SQLite Migration

Complete these tasks in order. Each top-level task is deliberately scoped to one agent run and must leave the repository in a verified, usable state. Keep pnpm, Vite, Vue, and the existing browser test toolchain for the renderer; use the Rust-backed Tauri v2 host for development and production desktop builds. Use Tauri v2 capabilities rather than the removed v1 allowlist, keep native logic in `src-tauri/src/lib.rs`, and grant only the permissions required by the main window. Prepare a production macOS application bundle. Use Playwright MCP against the Vite renderer for browser interactions and supplement it with native Tauri smoke tests for host, database, lifecycle, and packaged-build behavior.

- [x] **T20 — Scaffold and verify the Tauri v2 desktop host**
  - Confirm the installed CLI reports Tauri v2 with `cargo tauri -V`, then initialize `src-tauri/` around the existing Vue/Vite application without replacing pnpm or the current frontend tooling.
  - Configure `src-tauri/tauri.conf.json` with `devUrl: http://localhost:5173`, `frontendDist: ../dist`, pnpm-powered `beforeDevCommand` and `beforeBuildCommand`, stable product and bundle identifiers, and a single main window.
  - Keep `src-tauri/src/main.rs` as a thin desktop launcher and place builder setup and native application logic in `src-tauri/src/lib.rs`; do not add mobile entry points or mobile-target configuration.
  - Add `src-tauri/capabilities/default.json` using the Tauri v2 desktop schema and the smallest initial `core` permissions needed by the `main` window; do not use a Tauri v1 `allowlist`.
  - Add pnpm scripts for `tauri dev` and `tauri build`, generate application icons, and ensure a production desktop build embeds `dist` instead of depending on the Vite development server.
  - Verify the existing `pnpm check`, `cargo check --manifest-path src-tauri/Cargo.toml`, development launch, and an unsigned local macOS bundle.

- [x] **T21 — Add versioned SQLite schema management and database lifecycle**
  - Depends on T20.
  - Integrate the Tauri v2 SQL plugin with SQLite, register it in `src-tauri/src/lib.rs`, and grant only its required permissions in `src-tauri/capabilities/default.json`.
  - Store `db.sqlite` in Tauri's platform-appropriate per-user app-data directory rather than the installation or resource directory.
  - Define a normalized, foreign-keyed schema for leagues, seasons, teams, matches, and locked random tiebreaker data, preserving IDs, timestamps, nullable scores, card defaults, ordering, and league/season relationships.
  - Add a schema-version table and ordered, transactional migrations that are safe to rerun and reject unsupported future schema versions without modifying the database.
  - Configure foreign keys and appropriate durability settings; handle first run, existing database, corrupt/unopenable database, lock/busy failures, migration failure, and clean shutdown with typed errors and no silent data loss.
  - Add Rust tests against isolated temporary databases for schema creation, constraints, migration idempotency, rollback, reopening, and failure cases.

- [x] **T22 — Implement and test native SQLite repositories**
  - Depends on T21.
  - Add Rust repositories that load the complete typed application state and atomically persist every league, season, team, fixture, result, card count, and random tiebreaker lock.
  - Preserve deterministic collection ordering and exact `null`/zero semantics when mapping between SQLite rows and serializable Rust/TypeScript contracts.
  - Prevent orphaned rows with database constraints and implement league deletion, season deletion, fixture regeneration, round result updates, and result resets as transactions.
  - Keep SQL, row mapping, connection management, and database paths inside the Tauri host; never expose arbitrary SQL to the renderer.
  - Map constraint, busy/locked, disk-full, permission, corruption, and unexpected I/O failures to stable serializable error codes and actionable messages.
  - Add focused Rust tests for round trips, cascades, atomic rollback, ordering, null values, tiebreaker locks, and each important failure mapping.

- [x] **T23 — Expose an allowlisted typed Tauri v2 command bridge**
  - Depends on T22.
  - Add narrow `#[tauri::command]` functions for application-oriented persistence operations, return typed `Result` values, and register every command in `tauri::generate_handler!`.
  - Use owned request values for async commands, runtime-validate payloads at the host boundary, and serialize stable success/error contracts shared with the renderer.
  - Keep Vue components and route views unaware of Tauri by placing calls to `@tauri-apps/api/core` `invoke` behind a renderer-side persistence interface.
  - Restrict commands to the `main` window through Tauri v2 capabilities and CSP; reject malformed messages and avoid filesystem, shell, arbitrary script, and external-navigation permissions.
  - Add Rust command tests and Vitest service tests for dispatch, validation, serialization, unavailable-command behavior, native exceptions, and security boundaries.

- [x] **T24 — Replace synchronous localStorage persistence with asynchronous Tauri persistence**
  - Depends on T23.
  - Replace `src/services/storage.ts` with an asynchronous persistence service backed by the typed Tauri command bridge; no production application state may be read from or written to localStorage.
  - Adapt Pinia hydration and mutations to await persistence, prevent overlapping writes from committing out of order, and expose explicit loading, saving, success, and failure states.
  - Preserve accepted in-memory edits when a save fails, disable or serialize conflicting actions where necessary, and replace browser-quota wording with accurate SQLite/disk error feedback.
  - Keep route-level views thin and retain current component props/events boundaries while updating UI actions for asynchronous completion and duplicate-submission safety.
  - Supply injectable in-memory and failing persistence adapters for unit/component tests so Vue tests do not require a native window or real database.
  - Update all affected tests with GIVEN-WHEN-THEN JSDoc and cover hydration, successful writes, write ordering, retries, unavailable-host behavior, and persistence failures.

- [x] **T25 — Add desktop startup, shutdown, and recoverable-failure UX**
  - Depends on T24.
  - Add an application startup state while the Tauri host and database initialize, and prevent CRUD routes from operating against unhydrated state.
  - Present actionable desktop-specific errors for database open, migration, lock/busy, disk-full, permission, corruption, and bridge failures without discarding recoverable in-memory/form state.
  - Coordinate the Tauri v2 window close request with pending persistence operations so shutdown completes safely or presents an explicit recoverable failure.
  - Handle unsupported direct browser launches with a useful message while keeping an explicitly injected test adapter available to browser-based tests.
  - Add component/integration tests for startup, retry, pending-save shutdown coordination, and global error presentation, each with GIVEN-WHEN-THEN JSDoc.
  - Add native integration coverage for initialization, app-data database placement, close handling, and failure mapping.

- [x] **T26 — Add desktop-focused automated and agentic verification**
  - Depends on T25.
  - Keep Vitest for renderer and service coverage, use Rust tests for repositories and commands, and add a test configuration that uses an isolated temporary app-data/database location.
  - Through Playwright MCP against the Vite renderer with the injected persistence adapter, cover representative CRUD, fixture/result editing, standings, responsive behavior, accessibility, reload restoration, persistence errors, and shutdown prompts.
  - Smoke-test `cargo tauri dev` on macOS and exercise the real Tauri bridge and SQLite path for first launch, persistence across relaunch, random-lock stability, database lock/write failures, and clean shutdown.
  - Verify production configuration does not expose developer tools, remote-debugging endpoints, broad plugin permissions, arbitrary SQL, or test adapters.
  - Run `pnpm check`, Rust formatting/lint/tests, and a Tauri debug build as one documented verification workflow.

- [x] **T27 — Build a reproducible macOS Tauri v2 application artifact**
  - Depends on T26.
  - Configure Tauri v2 bundling for a macOS `.app` artifact with a stable identifier, version metadata, icons, and a platform-appropriate app-data path.
  - Ensure release artifacts contain the compiled Rust host and bundled renderer and require neither Node, pnpm, Rust, nor a Vite server on the user's machine.
  - Ensure upgrades preserve the user database and document uninstallation behavior; never place mutable state inside signed or read-only application resources.
  - Document externally supplied macOS signing/notarization credentials while keeping unsigned local builds available; release builds remain fully manual and require no hosted automation.
  - Generate a checksum and release manifest for the prepared macOS artifact, and smoke-test installation, launch, upgrade-preserved data, and uninstall behavior.

- [ ] **T28 — Complete Tauri migration verification and documentation**
  - Depends on T27.
  - Run the complete pnpm, Rust, and Tauri verification suites and confirm production does not depend on Deno, Electron, a custom CEF host, localStorage persistence, or a development server.
  - Verify first launch, CRUD, fixture generation, result/card editing, standings, relaunch restoration, random-lock stability, persistence failures, and shutdown coordination across automated renderer tests and native macOS smoke tests.
  - Confirm `db.sqlite` is created only in the documented Tauri app-data location and no application state is stored in localStorage.
  - Exercise database lock, disk/write failure, bridge failure, and interrupted-shutdown recovery without silent data loss.
  - Run accessibility and responsive UAT through Playwright MCP against the renderer and capture screenshots for visual review; separately record native window and packaged-build smoke results.
  - Update `README.md`, `PRD.md`, and repository guidance to describe the Tauri v2 desktop product, pnpm/Rust workflow, SQLite persistence, platform prerequisites, backup location, capability model, troubleshooting, and release process.
