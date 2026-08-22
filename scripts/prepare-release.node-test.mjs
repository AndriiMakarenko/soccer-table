import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { URL } from 'node:url'

const scriptPath = new URL('./prepare-release.mjs', import.meta.url)
const repositoryRoot = new URL('..', import.meta.url)

/**
 * GIVEN a packaged macOS application archive
 * WHEN the release preparation script runs with explicit release metadata
 * THEN it copies the artifact and writes a matching manifest and SHA-256 file
 */
test('prepares a checksummed release manifest', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soccer-table-release-'))
  const artifactPath = join(directory, 'Tournament.app.zip')
  const outputPath = join(directory, 'output')
  const artifactContents = Buffer.from('packaged-app')
  await writeFile(artifactPath, artifactContents)

  const result = spawnSync(
    process.execPath,
    [scriptPath.pathname, artifactPath],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        RELEASE_ARCH: 'aarch64',
        RELEASE_COMMIT: '0123456789abcdef',
        RELEASE_EXPECTED_VERSION: '1.0.1',
        RELEASE_OUTPUT_DIRECTORY: outputPath,
        RELEASE_PLATFORM: 'macos',
      },
    },
  )

  assert.equal(result.status, 0, result.stderr)
  const expectedChecksum = createHash('sha256')
    .update(artifactContents)
    .digest('hex')
  const manifest = JSON.parse(
    await readFile(join(outputPath, 'release-manifest-macos-aarch64.json')),
  )
  const checksums = await readFile(
    join(outputPath, 'SHA256SUMS-macos-aarch64'),
    'utf8',
  )

  assert.equal(manifest.identifier, 'space.andymac.roundrobin')
  assert.equal(manifest.version, '1.0.1')
  assert.equal(manifest.commit, '0123456789abcdef')
  assert.deepEqual(manifest.artifacts, [
    {
      file: 'Tournament.app.zip',
      bytes: artifactContents.byteLength,
      sha256: expectedChecksum,
    },
  ])
  assert.equal(checksums, `${expectedChecksum}  Tournament.app.zip\n`)
})

/**
 * GIVEN a release ref whose version differs from the application metadata
 * WHEN the release preparation script validates the inputs
 * THEN it fails before producing a release artifact
 */
test('rejects a mismatched release version', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soccer-table-release-'))
  const artifactPath = join(directory, 'Tournament.app.zip')
  await writeFile(artifactPath, 'packaged-app')

  const result = spawnSync(
    process.execPath,
    [scriptPath.pathname, artifactPath],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        RELEASE_EXPECTED_VERSION: '9.9.9',
        RELEASE_OUTPUT_DIRECTORY: join(directory, 'output'),
      },
    },
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match application version 1\.0\.1/)
})
