# Repository Guidelines

## Project Structure & Module Organization

This is a Vue 3, Vite, and TypeScript application. Application code lives in `src/`:

- `src/components/` contains reusable UI, grouped by feature or layout concern.
- `src/views/` contains route-level composition components.
- `src/router/` owns Vue Router configuration.
- `src/styles/` contains global styles and design tokens.
- `src/test/` contains shared Vitest setup; focused tests are colocated as `*.test.ts`.

Product requirements and ordered implementation work are documented in `PRD.md` and `Tasks.md`. Keep route views thin and move reusable behavior into focused components, stores, services, or composables as the application grows.

## Build, Test, and Development Commands

Use pnpm for all package operations.

- `pnpm install` installs locked dependencies.
- `pnpm dev` starts the browser/localStorage Vite application, normally at `http://localhost:5173`.
- `pnpm test` runs Vitest once; `pnpm test:watch` reruns affected tests.
- `pnpm typecheck` runs strict Vue and TypeScript checks.
- `pnpm lint` checks Vue and TypeScript code with ESLint.
- `pnpm format:check` verifies Prettier formatting; `pnpm format` applies it.
- `pnpm build` typechecks and creates the browser/localStorage production bundle in `dist/`.
- `pnpm check` runs every required automated verification step.
- `pnpm test:e2e` runs desktop and tablet Playwright journeys against the browser/localStorage renderer with isolated browser contexts.
- `pnpm check:desktop` runs the pnpm gate, Playwright journeys, production security audit, Rust formatting/lint/tests, and a non-bundled Tauri debug build.
- `pnpm tauri:dev` starts the SQLite renderer inside the native Tauri host; `pnpm tauri:build` creates desktop bundles with the same backend.
- `pnpm release:macos` verifies and prepares the local macOS artifact, checksum, and manifest.

## Coding Style & Naming Conventions

Use Vue Composition API with `<script setup lang="ts">`. Prefer two-space indentation, single quotes, no semicolons, and trailing commas; Prettier enforces these rules. Name Vue components in PascalCase (`AppShell.vue`), composables with a `use` prefix, and tests after their subject (`App.test.ts`). Keep state minimal, derive values with `computed`, and use typed props and events for component boundaries.

## Testing Guidelines

Use Vitest, Vue Testing Library, and `@testing-library/jest-dom`. Test user-visible behavior through accessible roles and labels instead of implementation details. Add focused coverage for changed business logic, validation boundaries, routing, and important UI states. Run `pnpm check` before requesting review.

Always create a GIVEN-WHEN-THEN JSDoc together with each test. `GIVEN` describes the preconditions, `WHEN` describes the triggering event, and `THEN` describes the expected outcome.

For any tests that include interaction with the browser, use Playwright MCP.

For UAT that includes clicking around a live instance of the application, assume the dev server is already up at `http://localhost:5173`. Only start it in the background terminal if you tried accessing the app and failed.

Native persistence tests must use a temporary app-data directory. Never point automated tests at the user's production `db.sqlite`. Desktop production state belongs only in Tauri's platform app-data directory and must not fall back to `localStorage`; browser production state belongs only in the versioned `round-robin-tournament-manager:v1` localStorage entry and must not create or require SQLite. Backend selection is build-time only. Use the production `default` capability for release behavior; the `mcp-automation` capability and `FIXTURE_BOARD_TEST_APP_DATA_DIR` override are debug-only verification aids.

JSON transfer uses interchange envelope version `1`. Replacement requires explicit destructive confirmation. Merge retains all existing data, skips an entire imported league when its normalized name conflicts, and reports every skipped league. Failed validation or persistence must leave the prior state intact.

## Commit & Pull Request Guidelines

History follows short Conventional Commit-style subjects such as `feat: scaffold Vue tournament manager foundation` and `chore: Define used skills`. Use an imperative, scoped summary with `feat:`, `fix:`, `test:`, `docs:`, or `chore:`.

Pull requests should explain the behavior changed, reference the relevant task or issue, list verification performed, and include screenshots for visual changes. Keep each PR focused and update `Tasks.md` only after implementation and verification are complete.
