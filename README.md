# Soccer Table

Just a fun soccer table tracker for Nazar.

## What is it?

Soccer Table is a Tauri v2 desktop round robin tournament manager. It lets you create leagues and seasons, add teams in bulk, generate fixtures, record scores and cards, and follow live overall, home, and away standings. The app is designed for local, single-user use, with tournament data stored in SQLite under the platform app-data directory.

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

Start the development server:

```bash
pnpm dev
```

Vite will print the local address, usually <http://localhost:5173>.

Start the application in its native Tauri development window:

```bash
pnpm tauri:dev
```

Build the renderer and native desktop bundles:

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

## Persistence, permissions, and recovery

The production renderer cannot access SQLite or the filesystem directly. Its
typed persistence service invokes only the commands listed in
`src-tauri/permissions/persistence.toml`. The `main` window receives the
least-privilege `default` capability; filesystem, shell, arbitrary SQL, remote
navigation, developer tooling, and the debug MCP bridge are not production
permissions.

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

Release construction, signing/notarization inputs, checksums, upgrade/uninstall
behavior, and the packaged-build smoke checklist are documented in
[`docs/RELEASING.md`](docs/RELEASING.md).
