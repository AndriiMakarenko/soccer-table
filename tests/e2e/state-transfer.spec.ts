import { expect, test } from '@playwright/test'

test.describe('browser state transfer', () => {
  /**
   * GIVEN tournament content created in the browser renderer
   * WHEN it is exported, browser storage is cleared, and the file is imported with replacement
   * THEN the complete league is restored and the responsive header remains contained
   */
  test('round-trips a browser backup through the visible controls', async ({
    page,
  }, testInfo) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByRole('button', { name: 'Create your first league' }).click()
    await page
      .getByRole('textbox', { name: 'League name' })
      .fill('Browser Exchange')
    await page
      .getByRole('button', { name: 'Create league', exact: true })
      .click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'EXPORT' }).click()
    const download = await downloadPromise
    const backupPath = await download.path()
    expect(download.suggestedFilename()).toBe('fixture-board-backup.json')
    if (testInfo.project.name === 'desktop') {
      await download.saveAs('/tmp/fixture-board-browser-export.json')
    }
    await page.getByRole('button', { name: 'Close' }).click()

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText('Browser Exchange')).not.toBeVisible()

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'IMPORT' }).click()
    const chooser = await chooserPromise
    await chooser.setFiles(backupPath!)
    await page.getByRole('button', { name: 'Replace all' }).click()
    await page.getByRole('button', { name: 'Replace all data' }).click()

    await expect(page.getByText('Browser Exchange')).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'imported successfully',
    )

    await page.setViewportSize({ width: 768, height: 1024 })
    const header = page.locator('.shell-header')
    await expect(header.getByRole('button', { name: 'IMPORT' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'EXPORT' })).toBeVisible()
    expect(
      await header.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
  })

  /**
   * GIVEN a backup exported through the standalone application's native save dialog
   * WHEN the browser imports it through its visible file picker and confirms replacement
   * THEN the standalone-created league is restored into browser persistence
   */
  test('imports a standalone backup into the browser', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'IMPORT' }).click()
    const chooser = await chooserPromise
    await chooser.setFiles('/tmp/fixture-board-backup.json')
    await page.getByRole('button', { name: 'Replace all' }).click()
    await page.getByRole('button', { name: 'Replace all data' }).click()

    await expect(page.getByText('Standalone Exchange')).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'imported successfully',
    )
  })
})
