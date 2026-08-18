export interface DesktopWindow {
  onCloseRequested(
    handler: (event: { preventDefault(): void }) => void | Promise<void>,
  ): Promise<() => void>
  destroy(): Promise<void>
}

export function isTauriDesktop(): boolean {
  return '__TAURI_INTERNALS__' in window
}

export async function coordinateDesktopShutdown(
  waitForPendingSaves: () => Promise<boolean>,
  onFailure: () => void,
  desktopWindow?: DesktopWindow,
): Promise<() => void> {
  if (!desktopWindow && !isTauriDesktop()) return () => undefined

  const target =
    desktopWindow ??
    ((
      await import('@tauri-apps/api/window')
    ).getCurrentWindow() as DesktopWindow)

  return target.onCloseRequested(async (event) => {
    event.preventDefault()
    if (await waitForPendingSaves()) await target.destroy()
    else onFailure()
  })
}
