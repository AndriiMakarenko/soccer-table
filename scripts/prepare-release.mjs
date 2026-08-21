import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

const artifactArguments = process.argv.slice(2)

if (artifactArguments.length === 0) {
  throw new Error('Pass at least one packaged artifact to prepare-release.mjs')
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const tauriConfig = JSON.parse(
  await readFile('src-tauri/tauri.conf.json', 'utf8'),
)
const cargoManifest = await readFile('src-tauri/Cargo.toml', 'utf8')
const cargoVersion = cargoManifest.match(/^version = "([^"]+)"/m)?.[1]

if (
  packageJson.version !== tauriConfig.version ||
  packageJson.version !== cargoVersion
) {
  throw new Error(
    `Version mismatch: package.json=${packageJson.version}, tauri.conf.json=${tauriConfig.version}, Cargo.toml=${cargoVersion ?? 'missing'}`,
  )
}

const expectedVersion = process.env.RELEASE_EXPECTED_VERSION?.replace(/^v/, '')
if (expectedVersion && expectedVersion !== packageJson.version) {
  throw new Error(
    `Release ref version ${expectedVersion} does not match application version ${packageJson.version}`,
  )
}

const outputDirectory = resolve(
  process.env.RELEASE_OUTPUT_DIRECTORY ?? 'release-artifacts',
)
await mkdir(outputDirectory, { recursive: true })

const artifacts = []
const artifactNames = new Set()
for (const argument of artifactArguments) {
  const source = resolve(argument)
  const sourceStat = await stat(source)
  if (!sourceStat.isFile()) {
    throw new Error(`Release artifact must be a file: ${argument}`)
  }

  const fileName = basename(source)
  if (artifactNames.has(fileName)) {
    throw new Error(`Release artifact names must be unique: ${fileName}`)
  }
  artifactNames.add(fileName)

  const destination = resolve(outputDirectory, fileName)
  await copyFile(source, destination, constants.COPYFILE_EXCL)
  const contents = await readFile(destination)
  artifacts.push({
    file: fileName,
    bytes: contents.byteLength,
    sha256: createHash('sha256').update(contents).digest('hex'),
  })
}

artifacts.sort((left, right) => left.file.localeCompare(right.file))
const manifest = {
  schemaVersion: 1,
  productName: tauriConfig.productName,
  identifier: tauriConfig.identifier,
  version: packageJson.version,
  platform: process.env.RELEASE_PLATFORM ?? process.platform,
  architecture: process.env.RELEASE_ARCH ?? process.arch,
  commit: process.env.RELEASE_COMMIT ?? null,
  artifacts,
}
const metadataSuffix = `${manifest.platform}-${manifest.architecture}`

await writeFile(
  resolve(outputDirectory, `release-manifest-${metadataSuffix}.json`),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
await writeFile(
  resolve(outputDirectory, `SHA256SUMS-${metadataSuffix}`),
  `${artifacts.map(({ file, sha256 }) => `${sha256}  ${file}`).join('\n')}\n`,
)

console.log(`Prepared ${artifacts.length} artifact(s) in ${outputDirectory}`)
