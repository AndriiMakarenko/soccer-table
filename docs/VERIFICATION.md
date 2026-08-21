# Cross-platform persistence verification

This document is the evidence checklist for the Tauri v2 migration. Automated
results are reproducible from the repository; native and packaged checks are
recorded separately because they exercise the operating system rather than the
mocked renderer.

## Automated gate

Run from a clean checkout with locked dependencies:

```bash
pnpm install --frozen-lockfile
pnpm check:desktop
```

`check:desktop` covers both production renderer configurations and the native host:

- ESLint, Prettier, Vue/TypeScript typechecking, Vitest, release-script tests,
  and the production renderer build;
- Playwright desktop and tablet workflows using isolated browser localStorage,
  including CRUD, fixture generation, result editing, standings, reload
  restoration, JSON transfer, responsive layout, accessible roles, quota failure
  UI, and retained edits;
- a static production audit that rejects developer tooling, non-production
  capabilities, broad filesystem/shell/SQL permissions, arbitrary SQL commands,
  renderer test-adapter installation, unapproved plugin permissions, and desktop
  production `localStorage` persistence;
- Rust formatting, Clippy with warnings denied, repository/command/database tests
  using temporary SQLite paths, and a non-bundled Tauri debug build.

The Rust suite supplies deterministic coverage for first-run migration,
app-data placement, CRUD persistence, locked random tiebreakers, busy/locked and
write failures, bridge error mapping, and close coordination. The renderer suite
supplies the corresponding startup, retry, newest-write-wins, retained-edit, and
shutdown-prompt behavior.

Unit and component coverage additionally verifies browser missing/corrupt/quota
storage, Tauri failure without browser fallback, serialized write ordering,
interchange schema/version rejection, replace cancellation and atomic rollback,
merge conflicts, identifier remapping, picker cancellation, and transfer status
announcements.

## Renderer UAT

Use Playwright MCP against the browser/localStorage app at
`http://localhost:5173`. Verify at both 1440 x 900 and 768 x 1024:

1. Create a league and season with at least four teams.
2. Generate fixtures, edit scores and yellow/red cards, and inspect standings in
   Overall, Home only, and Away only modes.
3. Reload and confirm the route and data restore.
4. Confirm keyboard focus, accessible names, alerts, table semantics, and the
   absence of horizontal page overflow.

## Native macOS smoke record

Launch a disposable native instance with:

```bash
FIXTURE_BOARD_TEST_APP_DATA_DIR="$(mktemp -d)" pnpm tauri:dev:mcp
```

Use Tauri MCP to record the connected app identity, window state, IPC traffic,
and app-data contents. Complete and record each outcome:

| Check              | Required evidence                                                      |
| ------------------ | ---------------------------------------------------------------------- |
| First launch       | `db.sqlite` exists only in the disposable app-data directory           |
| CRUD and fixtures  | League, season, generated schedule, score, and cards survive relaunch  |
| Standings          | Overall/home/away values match the entered native data                 |
| Random lock        | A completed tied season keeps the same locked order after relaunch     |
| Database lock      | UI identifies the busy database and retains recoverable state          |
| Disk/write failure | UI reports the mapped failure without silently discarding edits        |
| Bridge failure     | Startup presents the unavailable-host recovery message                 |
| Interrupted close  | Pending save completes, or close is cancelled with a recoverable error |
| Clean shutdown     | No pending write remains and a subsequent launch loads valid data      |

The environment override and MCP capability are compiled/configured for debug
verification only. Repeat the core workflow against the packaged `.app` without
either override before release.

## Packaged-build record

Run `pnpm release:macos`, then follow `docs/RELEASING.md`. Record the macOS
version, architecture, Git commit, artifact SHA-256, signature/notarization
status, installation path, launch, upgrade-preserved data, relaunch, and
uninstall/reinstall outcomes. Inspect the bundle to confirm it embeds the Rust
host and renderer and contains no dependency on Deno, Electron, a custom CEF
host, Node.js, pnpm, `localhost:5173`, or another development server.

Do not mark a manual item passed from automated or source inspection alone.

## T28 verification record — 2026-08-21

- `pnpm check:desktop`: passed. This run included 132 Vitest tests, 2 Node
  release-preparation tests, 4 Playwright desktop/tablet tests, the production
  security audit, Rust formatting and Clippy, 19 Rust tests, and a Tauri debug
  build.
- Playwright MCP: confirmed the direct-browser recovery state exposes an alert
  and retry button at 1440 x 900 and 768 x 1024. Both sizes had equal document
  and viewport widths (no page-level horizontal overflow).
- Tauri MCP: connected to Tauri 2.11.5 as
  `space.andymac.roundrobin` on macOS/aarch64, confirmed one focused `main`
  window, and created `Native UAT League`.
- Native app-data isolation: the first launch created only `db.sqlite`,
  `db.sqlite-wal`, and `db.sqlite-shm` under the disposable
  `/private/tmp/fixture-board-t28.NNwuRe` directory. No `db.sqlite` file was
  found in the worktree. Relaunching against the same directory restored
  `Native UAT League`.

Database fault injection, interrupted-close recovery, and install/upgrade/
uninstall behavior remain release-operator smoke items. They are not represented
as passed by this record; their required evidence is defined above and in
`docs/RELEASING.md`.

## T31 verification record — 2026-08-21

- `pnpm check`: passed with 159 Vitest tests, 2 release-preparation tests,
  ESLint, Prettier, Vue/TypeScript typechecking, and the browser/localStorage
  production build.
- `pnpm test:e2e`: passed all 8 desktop/tablet journeys after correcting the
  persistence-failure journey to exercise the active browser adapter. The suite
  verified CRUD, fixtures, scores/cards, standings, actual localStorage reload
  restoration, quota failure with retained edits, and JSON export/import.
- `pnpm audit:desktop`: passed with an explicit native-transfer allowlist of
  `dialog:allow-open`, `dialog:allow-save`, `fs:allow-read-text-file`, and
  `fs:allow-write-text-file`. Unreviewed dialog/filesystem permissions and all
  shell, SQL, and MCP permissions remain rejected in the production capability.
- Rust formatting and Clippy passed. All 19 Rust tests passed, including schema,
  repository transactions, typed command validation, database placement,
  corruption, lock/busy, write failure mapping, and exact state round trips.
- `cargo tauri build --debug --no-bundle` and `cargo tauri build` passed after
  building the renderer in `tauri` mode. The latter produced
  `src-tauri/target/release/bundle/macos/Round Robin Tournament Manager.app`.
  This proves both native build paths select the SQLite adapter; the ordinary
  browser build selected localStorage. Bundle inspection found the renderer
  embedded in the native executable; its dynamic dependencies are macOS system
  frameworks (including WebKit) and system libraries, with no Deno, Electron,
  custom CEF host, Node.js, pnpm, or development-server runtime dependency.
- Playwright MCP inspected the live browser at 1440 x 900 and 768 x 1024. Both
  sizes exposed the skip link, semantic banner/main/breadcrumb/region structure,
  accessible `IMPORT` then `EXPORT` controls, and equal document/viewport widths.
  The browser had no Tauri host object.
- Tauri MCP connected to Tauri 2.11.5 on macOS/aarch64 with identifier
  `space.andymac.roundrobin`, one focused `main` window, SQLite returning empty
  state, and no state imported from a same-origin localStorage envelope. First
  launch created only `db.sqlite`, `db.sqlite-wal`, and `db.sqlite-shm` in the
  disposable `/private/tmp/fixture-board-t31.ArHrms` app-data directory; no
  worktree database existed.
- The native save dialog opened from `EXPORT`. macOS denied automation access
  for the synthetic Escape key, so native dialog cancellation was not marked
  passed. A packaged native file round trip, relaunch/random-lock flow, injected
  desktop failures, interrupted shutdown, and install/upgrade/uninstall smoke
  remain release-operator checks. T31 stays open until those results are recorded;
  automated or source evidence is not substituted for them.
