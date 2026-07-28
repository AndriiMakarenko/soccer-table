# Soccer Table

Just a fun soccer table tracker for Nazar.

## What is it?

Soccer Table is a browser-based round robin tournament manager. It will let you create leagues and seasons, add teams in bulk, generate fixtures, record scores and cards, and follow live overall, home, and away standings. The app is designed for local, single-user use, with tournament data stored in the browser.

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
