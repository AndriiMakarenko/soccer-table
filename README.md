# Soccer Table

Just a fun soccer table tracker for Nazar.

## What is it?

Soccer Table is a local-first round robin tournament manager for browsers and Tauri v2 desktop. It lets you create leagues and seasons, add teams in bulk, generate fixtures, record scores and cards, and follow live overall, home, and away standings.

The persistence backend is selected at build time:

- `pnpm dev` and `pnpm build` use the browser adapter and store state in the versioned `round-robin-tournament-manager:v1` localStorage entry. They do not create or require SQLite.
- `pnpm tauri:dev` and `pnpm tauri:build` use the native adapter and store state in SQLite under Tauri's platform app-data directory. A database or bridge failure is reported and never falls back to localStorage.

Both variants use the same asynchronous persistence interface and the same versioned JSON backup format.

## Development commands

### Prerequisites

Install pnpm, the Rust toolchain, and the Tauri v2 CLI. The desktop commands use
the Cargo-installed CLI directly:

```bash
cargo install tauri-cli --version "^2"
cargo tauri -V
```

The version command must report Tauri CLI 2.x. Platform-specific Tauri build
dependencies may also be required; macOS uses the Xcode command-line tools.

Install the project dependencies:

```bash
pnpm install
```

On macOS, install Xcode Command Line Tools with `xcode-select --install`. Tauri
uses the system WebKit runtime. Windows development additionally requires the
Microsoft C++ Build Tools and WebView2; end users normally receive WebView2 with
supported Windows installations.

Start the browser/localStorage development server:

```bash
pnpm dev
```

Vite will print the local address, usually <http://localhost:5173>.

Start the SQLite-backed application in its native Tauri development window:

```bash
pnpm tauri:dev
```

Build the browser/localStorage renderer:

```bash
pnpm build
```

Build the SQLite renderer and native desktop bundles:

```bash
pnpm tauri:build
```

For reproducible macOS and Windows release artifacts, signing inputs, checksums,
upgrade behavior, and the installation smoke checklist, see
[`docs/RELEASING.md`](docs/RELEASING.md).

Prepare a verified, unsigned local macOS `.app.zip` plus its release manifest
and SHA-256 checksum with:

```bash
pnpm release:macos
```

Run the TypeScript checks:

```bash
pnpm typecheck
```

Check Vue and TypeScript code with ESLint:

```bash
pnpm lint
```

Automatically fix supported lint issues:

```bash
pnpm lint:fix
```

Check that files follow the project formatting rules:

```bash
pnpm format:check
```

Format project files with Prettier:

```bash
pnpm format
```

Run the test suite once:

```bash
pnpm test
```

Run tests in watch mode while developing:

```bash
pnpm test:watch
```

Typecheck and create a production build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm exec vite preview
```

The production preview address is usually <http://localhost:4173>.

To run linting, formatting checks, typechecking, tests, and the production build in one command:

```bash
pnpm check
```

## Desktop verification

T26's repeatable desktop gate runs renderer checks, Playwright desktop/tablet
journeys with an isolated in-process Tauri IPC mock, the production security
audit, Rust formatting/clippy/tests, and a non-bundled Tauri debug build:

```bash
pnpm check:desktop
```

Install Playwright's Chromium once before the first run with
`pnpm exec playwright install chromium`. Rust repository and command tests use
temporary SQLite databases. For an isolated manual native smoke test, launch a
debug host with a fresh app-data directory:

```bash
FIXTURE_BOARD_TEST_APP_DATA_DIR="$(mktemp -d)" pnpm tauri:dev:mcp
```

The supplemental `tauri.mcp.conf.json` enables the global Tauri object and the
`mcp-automation` capability only for this explicit debug command. Use the Tauri
MCP bridge only with that launch. Verify first launch,
create/edit/relaunch persistence, a completed-season random tie, database-lock
error presentation, and clean close while saving. The override is compiled out
of release builds; production always resolves `db.sqlite` through Tauri's
platform app-data directory. The MCP bridge is likewise registered only in
debug builds and is not granted to the production main-window capability.

The completed verification matrix and the distinction between automated and
manual native evidence are recorded in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Persistence, backups, and recovery

### Browser data

Browser builds store the complete application state under localStorage key
`round-robin-tournament-manager:v1` for that page's origin and browser profile.
Clearing site data, using a different origin, or switching browser profiles does
not retain that state. A corrupt or unsupported stored envelope is ignored and
the app starts safely with empty state. If quota is exhausted, accepted edits
remain in memory and the app asks you to export or remove old tournaments before
retrying.

### Desktop data

The desktop renderer cannot access SQLite directly. Its
typed persistence service invokes only the commands listed in
`src-tauri/permissions/persistence.toml`. The `main` window receives the
least-privilege `default` capability. Native transfer is limited to open/save
dialogs and text reads/writes for paths explicitly selected by the user; shell,
arbitrary SQL, remote navigation, developer tooling, broad filesystem access,
and the debug MCP bridge are not production permissions.

On macOS the database is
`~/Library/Application Support/space.andymac.roundrobin/db.sqlite`; on Windows
it is `%APPDATA%\space.andymac.roundrobin\db.sqlite`. Close the app before a
backup and copy `db.sqlite` plus `db.sqlite-wal` and `db.sqlite-shm` if present.
Restoring those files to the same directory while the app is closed restores the
local tournaments. Application upgrades and normal uninstall preserve this
directory.

If startup or saving fails:

- For a busy/locked database, close other app instances and retry after the
  current writer finishes.
- For disk-full or permission errors, free space or restore write access to the
  app-data directory, then retry; accepted edits remain in memory while the app
  stays open.
- For corruption, close the app and restore a known-good backup. Do not overwrite
  the damaged files before preserving a diagnostic copy.
- A bridge-unavailable message means the renderer was opened directly in a
  browser. Launch with `pnpm tauri:dev` or use the installed desktop app.

The desktop backend never redirects state to localStorage after one of these
failures.

### JSON export and import

Use `EXPORT` to download a browser file or select a native save location. The
deterministic UTF-8 JSON file is named `fixture-board-backup.json` by default and
has this top-level envelope:

```json
{
  "version": 1,
  "state": {
    "leagues": [],
    "seasons": []
  }
}
```

The nested state contains leagues, seasons, teams, fixtures, scores, cards, and
locked random tiebreakers. Import validates the version, complete schema, and
relationships before changing anything.

- **Merge** preserves current data and imports only leagues whose normalized
  names do not already exist. A conflicting league and all its seasons are
  skipped together, and every skipped league is listed in the result. Identifier
  collisions in accepted leagues are remapped safely.
- **Replace all** atomically replaces current data only after a second explicit
  destructive confirmation.
- Cancelling a picker or confirmation changes nothing. Read, validation, file,
  or persistence failures never apply partial imported state; persistence
  failure restores the prior in-memory state.

For a portable backup, export JSON and store it separately from the browser
profile or desktop app-data directory. Restore with `IMPORT`, choose Replace all,
review the warning, and confirm. Use Merge when adding non-conflicting leagues
to existing data.

Release construction, signing/notarization inputs, checksums, upgrade/uninstall
behavior, and the packaged-build smoke checklist are documented in
[`docs/RELEASING.md`](docs/RELEASING.md).
