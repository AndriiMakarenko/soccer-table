# Desktop release guide

Round Robin Tournament Manager ships as a self-contained Tauri v2 desktop
application. The macOS release contains an `.app.zip`; Windows uses an NSIS
`.exe` installer. The compiled Rust host embeds the production renderer,
so an installed release does not require Node.js, pnpm, Rust, or a Vite server.

## Version and build inputs

Keep the version identical in `package.json`, `src-tauri/Cargo.toml`, and
`src-tauri/tauri.conf.json`. The release preparation script fails when they
drift. Commit both lockfiles and build tagged releases from a clean checkout.
Install dependencies from the lockfiles and confirm Tauri CLI 2.x before each
platform build.

Every release is built manually on the platform that will execute it. There is
no repository-hosted release automation. On macOS, the repeatable release gate,
`.app` build, metadata-preserving archive, checksum, and manifest are one command:

```bash
pnpm release:macos
```

By default this writes to
`release-artifacts/macos-<architecture>/v<version>/` and refuses to overwrite an
existing release directory. Set `RELEASE_OUTPUT_DIRECTORY` to choose another
new directory. The script records the current commit in the manifest; run it
from the exact clean commit intended for release.

The command refuses a dirty worktree for publishable artifacts. During local
development only, `RELEASE_ALLOW_DIRTY=1 pnpm release:macos` creates a smoke
artifact whose manifest marks the commit with a `-dirty` suffix; do not publish
that artifact.

The equivalent individual verification and build commands are:

```bash
pnpm install --frozen-lockfile
cargo tauri -V
pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri build
```

Tauri cannot cross-compile these application bundles. macOS produces `.app`
under `src-tauri/target/release/bundle/macos/`; Windows produces an NSIS
installer under `src-tauri/target/release/bundle/nsis/`.

The macOS command above archives the generated `.app` with `ditto`, preserving
its metadata. For diagnosis or a deliberately manual release, the equivalent is:

```bash
ditto -c -k --sequesterRsrc --keepParent \
  "src-tauri/target/release/bundle/macos/Round Robin Tournament Manager.app" \
  "Round Robin Tournament Manager.app.zip"
```

Then manually prepare the macOS release directory, substituting the actual
architecture and commit SHA:

```bash
RELEASE_PLATFORM=macos \
RELEASE_ARCH=aarch64 \
RELEASE_EXPECTED_VERSION=0.1.0 \
RELEASE_COMMIT=<full-commit-sha> \
RELEASE_OUTPUT_DIRECTORY=release-artifacts/macos-aarch64 \
pnpm release:prepare \
  "Round Robin Tournament Manager.app.zip"
```

On Windows PowerShell, prepare the NSIS release directory with:

```powershell
$env:RELEASE_PLATFORM = 'windows'
$env:RELEASE_ARCH = 'x86_64'
$env:RELEASE_EXPECTED_VERSION = '0.1.0'
$env:RELEASE_COMMIT = '<full-commit-sha>'
$env:RELEASE_OUTPUT_DIRECTORY = 'release-artifacts/windows-x86_64'
$installer = (Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe').FullName
pnpm release:prepare $installer
```

The preparation command copies the installers and generates an architecture-
specific JSON manifest plus a `SHA256SUMS-*` file. Verify files with
`shasum -a 256 -c SHA256SUMS-*` on macOS or compare against
`Get-FileHash -Algorithm SHA256` on Windows. Upload or distribute the verified
files manually through the chosen release channel.

## Signing credentials

Unsigned local builds intentionally remain available. Public releases should be
signed; signing materials must be supplied by the release operator and must
never be committed.

For macOS, import a Developer ID Application certificate into the login keychain
and expose `APPLE_SIGNING_IDENTITY`. Notarization can use either an App Store
Connect API key (`APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH`)
or Apple ID credentials (`APPLE_ID`, an app-specific `APPLE_PASSWORD`, and
`APPLE_TEAM_ID`). Tauri discovers these variables during `cargo tauri build`.
The app must pass `codesign --verify --deep --strict` and
`spctl --assess --type execute` before publication.

For Windows, import a trusted OV/EV code-signing certificate on the Windows
runner, then provide its SHA-1 thumbprint through an uncommitted Tauri config
overlay at `bundle.windows.certificateThumbprint`. Alternatively configure
`bundle.windows.signCommand` for the organization's hardware token or trusted
signing service. Timestamp with the provider's RFC 3161 endpoint. Validate the
installer with `Get-AuthenticodeSignature`; an unsigned build is expected to
trigger a SmartScreen warning and is suitable only for local testing.

## Data, upgrades, and uninstall

The stable bundle identifier is `space.andymac.roundrobin`. Tauri resolves
`db.sqlite` through its platform app-data directory on every production launch:

- macOS: `~/Library/Application Support/space.andymac.roundrobin/db.sqlite`
- Windows: `%APPDATA%\space.andymac.roundrobin\db.sqlite`

Mutable data is never stored in the `.app`, installer, executable, or
signed resources. Installing a newer version over an older version therefore
preserves the database and applies versioned migrations on launch. Back up the
database (plus `db.sqlite-wal` and `db.sqlite-shm` if present) only while the app
is closed.

Dragging the macOS app to Trash or uninstalling the Windows NSIS application
removes application files but intentionally leaves app data in place, allowing
reinstallation to recover tournaments. To remove all data, first uninstall the
application, then explicitly delete the identifier-named app-data directory.
That deletion is irreversible unless the database was backed up.

## Release smoke checklist

Perform this checklist for every architecture before publishing the draft:

1. Verify the SHA-256 checksum and platform signature/notarization status.
2. Inspect the package and confirm the native executable and renderer assets are
   present, with no `localhost:5173`, Node, pnpm, or test-adapter dependency.
3. Install on a clean supported machine, launch, create a league/season, generate
   fixtures, enter a result, and close cleanly.
4. Reopen and confirm the SQLite-backed data and locked tiebreaker state persist.
5. Install the newer version over the old version and confirm the same data is
   available after migration.
6. Uninstall normally, verify application binaries are removed and app data is
   retained, reinstall, and confirm recovery.
7. Uninstall again and explicitly remove app data only on the disposable smoke
   machine; confirm the next installation starts empty.

Record OS version, architecture, artifact checksum, signing result, install,
launch, upgrade, persistence, and uninstall outcomes in the release notes. Never
publish a draft with an incomplete platform checklist.
