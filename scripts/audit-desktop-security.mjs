import { readFileSync } from 'node:fs'
import process from 'node:process'

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const capability = JSON.parse(
  readFileSync('src-tauri/capabilities/default.json', 'utf8'),
)
const commands = readFileSync('src-tauri/src/commands.rs', 'utf8')
const productionEntry = readFileSync('src/main.ts', 'utf8')
const productionPersistence = readFileSync('src/services/storage.ts', 'utf8')

const failures = []
const serializedConfig = JSON.stringify(config)
const permissions = capability.permissions ?? []
const enabledCapabilities = config.app?.security?.capabilities ?? []
const allowedStateTransferPermissions = new Set([
  'dialog:allow-open',
  'dialog:allow-save',
  'fs:allow-read-text-file',
  'fs:allow-write-text-file',
])

if (serializedConfig.match(/devtools|remote-debugging/i))
  failures.push('production configuration enables developer tooling')
if (
  permissions.some(
    (permission) =>
      /^(dialog|fs|shell|sql|mcp-bridge):/.test(permission) &&
      !allowedStateTransferPermissions.has(permission),
  )
)
  failures.push(
    'main-window capabilities include an unapproved plugin permission',
  )
if (enabledCapabilities.some((identifier) => identifier !== 'default'))
  failures.push('production enables a non-default capability')
if (/#\[tauri::command\][\s\S]{0,160}(execute|query)_sql/.test(commands))
  failures.push('an arbitrary SQL command is exposed')
if (
  /createMemoryPersistenceAdapter|createFailingPersistenceAdapter/.test(
    productionEntry,
  )
)
  failures.push('production entry points install a test persistence adapter')
if (/localStorage/.test(productionPersistence))
  failures.push('production persistence references localStorage')

if (failures.length > 0) {
  for (const failure of failures)
    console.error(`Desktop security audit: ${failure}`)
  process.exitCode = 1
} else {
  console.log('Desktop security audit passed.')
}
