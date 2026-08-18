import { describe, expect, it, vi } from 'vitest'

import {
  coordinateDesktopShutdown,
  type DesktopWindow,
} from './desktopLifecycle'

describe('desktop shutdown coordination', () => {
  /**
   * GIVEN persistence operations are pending during a native close request
   * WHEN the queued operations finish successfully
   * THEN the request is held until persistence completes and the window is destroyed safely
   */
  it('waits for pending saves before closing', async () => {
    let closeHandler!: (event: { preventDefault(): void }) => Promise<void>
    const desktopWindow: DesktopWindow = {
      onCloseRequested: vi.fn(async (handler) => {
        closeHandler = handler as typeof closeHandler
        return () => undefined
      }),
      destroy: vi.fn(async () => undefined),
    }
    const preventDefault = vi.fn()
    const waitForPendingSaves = vi.fn(async () => true)

    await coordinateDesktopShutdown(waitForPendingSaves, vi.fn(), desktopWindow)
    await closeHandler({ preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(waitForPendingSaves).toHaveBeenCalledOnce()
    expect(desktopWindow.destroy).toHaveBeenCalledOnce()
  })

  /**
   * GIVEN a pending database write finishes with a recoverable failure
   * WHEN the native window requests shutdown
   * THEN the window remains open and the renderer presents recovery guidance
   */
  it('keeps the window open when pending persistence fails', async () => {
    let closeHandler!: (event: { preventDefault(): void }) => Promise<void>
    const desktopWindow: DesktopWindow = {
      onCloseRequested: vi.fn(async (handler) => {
        closeHandler = handler as typeof closeHandler
        return () => undefined
      }),
      destroy: vi.fn(async () => undefined),
    }
    const onFailure = vi.fn()

    await coordinateDesktopShutdown(async () => false, onFailure, desktopWindow)
    await closeHandler({ preventDefault: vi.fn() })

    expect(desktopWindow.destroy).not.toHaveBeenCalled()
    expect(onFailure).toHaveBeenCalledOnce()
  })
})
