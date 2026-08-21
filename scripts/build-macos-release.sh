#!/bin/sh

set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "macOS release artifacts must be built on macOS." >&2
  exit 1
fi

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repository_root"

version=$(node -p "require('./package.json').version")
architecture=$(rustc -vV | sed -n 's/^host: \([^-]*\)-.*/\1/p')
commit=$(git rev-parse HEAD)
if [ -n "$(git status --porcelain)" ]; then
  if [ "${RELEASE_ALLOW_DIRTY:-0}" != "1" ]; then
    echo "Refusing to prepare a release from a dirty worktree." >&2
    echo "Commit the release inputs or set RELEASE_ALLOW_DIRTY=1 for a local smoke artifact." >&2
    exit 1
  fi
  commit="$commit-dirty"
fi
app_name='Round Robin Tournament Manager.app'
app_path="src-tauri/target/release/bundle/macos/$app_name"
output_directory="${RELEASE_OUTPUT_DIRECTORY:-release-artifacts/macos-$architecture/v$version}"
archive_directory=$(mktemp -d)
archive_path="$archive_directory/$app_name.zip"
trap 'rm -rf "$archive_directory"' EXIT HUP INT TERM

if [ -e "$output_directory" ]; then
  echo "Release output already exists: $output_directory" >&2
  echo "Move it aside or choose a new RELEASE_OUTPUT_DIRECTORY." >&2
  exit 1
fi

pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri build --bundles app

test -x "$app_path/Contents/MacOS/round-robin-tournament-manager"
test -f "$app_path/Contents/Info.plist"
test -f "$app_path/Contents/Resources/icon.icns"

ditto -c -k --sequesterRsrc --keepParent "$app_path" "$archive_path"

RELEASE_PLATFORM=macos \
RELEASE_ARCH="$architecture" \
RELEASE_EXPECTED_VERSION="$version" \
RELEASE_COMMIT="$commit" \
RELEASE_OUTPUT_DIRECTORY="$output_directory" \
pnpm release:prepare "$archive_path"

echo "Prepared macOS release v$version ($architecture) in $output_directory"
