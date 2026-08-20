import type { BrowserContext } from '@playwright/test'

import type { AppState } from '../../src/domain/models'

type InvokeArguments = { request?: Record<string, unknown> }

export interface TauriMockController {
  failNextSave(message?: string): void
  readState(): AppState
}

export async function installTauriPersistenceMock(
  context: BrowserContext,
  initialState: AppState = { leagues: [], seasons: [] },
): Promise<TauriMockController> {
  let state = structuredClone(initialState)
  let nextSaveError: string | undefined

  await context.exposeBinding(
    '__fixtureBoardInvoke',
    async (_source, command: string, args?: InvokeArguments) => {
      if (command === 'initialize_database') return { success: true }
      if (command === 'load_app_state') return structuredClone(state)
      if (command === 'persist_app_state') {
        if (nextSaveError) {
          const message = nextSaveError
          nextSaveError = undefined
          throw { code: 'disk-full', message }
        }
        state = structuredClone(args?.request?.state as AppState)
        return { success: true }
      }
      if (command.startsWith('plugin:event|')) return 1
      if (command.startsWith('plugin:window|')) return null
      throw new Error(`Unexpected Tauri command: ${command}`)
    },
  )

  await context.addInitScript(() => {
    const invoke = (
      window as typeof window & {
        __fixtureBoardInvoke: (
          command: string,
          args?: InvokeArguments,
        ) => Promise<unknown>
      }
    ).__fixtureBoardInvoke

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: false,
      value: {
        invoke,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main', windowLabel: 'main' },
        },
        transformCallback: () => 1,
        unregisterCallback: () => undefined,
      },
    })
  })

  return {
    failNextSave(message = 'The database disk is full.') {
      nextSaveError = message
    },
    readState: () => structuredClone(state),
  }
}
