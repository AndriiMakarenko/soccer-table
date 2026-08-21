const JSON_FILTER = [{ name: 'Fixture Board JSON', extensions: ['json'] }]

export interface StateTransferFileAdapter {
  pickImportFile(): Promise<string | null>
  saveExportFile(contents: string): Promise<boolean>
}

function isTauriHost(): boolean {
  return '__TAURI_INTERNALS__' in window
}

async function pickBrowserFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(resolve, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

function saveBrowserFile(contents: string): boolean {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'fixture-board-backup.json'
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export const stateTransferFileAdapter: StateTransferFileAdapter = {
  async pickImportFile() {
    if (!isTauriHost()) return pickBrowserFile()
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ])
    const path = await open({ multiple: false, filters: JSON_FILTER })
    return typeof path === 'string' ? readTextFile(path) : null
  },

  async saveExportFile(contents) {
    if (!isTauriHost()) return saveBrowserFile(contents)
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ])
    const path = await save({
      defaultPath: 'fixture-board-backup.json',
      filters: JSON_FILTER,
    })
    if (!path) return false
    await writeTextFile(path, contents)
    return true
  },
}
