import { expect, test } from '@playwright/test'

import { installTauriPersistenceMock } from './tauriMock'

test.describe('desktop tournament workflow', () => {
  /**
   * GIVEN an empty isolated desktop persistence adapter
   * WHEN a user creates a league and season, records a result, and reloads
   * THEN CRUD, fixtures, standings, accessibility, and restoration remain usable
   */
  test('covers the representative persisted tournament journey', async ({
    context,
    page,
  }) => {
    const persistence = await installTauriPersistenceMock(context)
    await page.goto('/')

    await page.getByRole('button', { name: 'Create your first league' }).click()
    await page
      .getByRole('textbox', { name: 'League name' })
      .fill('Agent League')
    await page
      .getByRole('button', { name: 'Create league', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Agent League' }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Open league' }).click()
    await page.getByRole('link', { name: 'Create season' }).click()
    await page.getByRole('textbox', { name: 'Season name' }).fill('2026/27')
    await page
      .getByRole('textbox', { name: 'Team names' })
      .fill('Northside FC\nRiverside United')
    await page.getByRole('button', { name: 'Create season & fixtures' }).click()

    await page.getByRole('link', { name: /Fixtures & results/ }).click()
    const firstLeg = page.getByRole('region', { name: 'Leg 1' })
    await firstLeg
      .getByRole('button', { name: 'Edit results for Round 1' })
      .click()
    await firstLeg
      .getByRole('spinbutton', {
        name: /Northside FC score|Riverside United score/,
      })
      .first()
      .fill('2')
    await firstLeg
      .getByRole('spinbutton', {
        name: /Northside FC score|Riverside United score/,
      })
      .last()
      .fill('1')
    await firstLeg
      .getByRole('button', { name: 'Save results for Round 1' })
      .click()

    await page.getByRole('link', { name: '2026/27', exact: true }).click()
    await page.getByRole('link', { name: /Standings table/ }).click()
    await expect(
      page.getByRole('table', { name: 'Season standings' }),
    ).toBeVisible()
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    expect(
      persistence.readState().seasons[0]?.matches[0]?.homeScore,
    ).not.toBeNull()
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  })

  /**
   * GIVEN the native adapter reports a recoverable disk-full failure
   * WHEN the user creates a league
   * THEN the unsaved edit remains visible and an accessible global error is shown
   */
  test('preserves edits and presents persistence failures', async ({
    context,
    page,
  }) => {
    const persistence = await installTauriPersistenceMock(context)
    persistence.failNextSave()
    await page.goto('/')

    await page.getByRole('button', { name: 'Create your first league' }).click()
    await page
      .getByRole('textbox', { name: 'League name' })
      .fill('Unsaved League')
    await page
      .getByRole('button', { name: 'Create league', exact: true })
      .click()

    await expect(page.getByRole('alert')).toContainText('disk is full')
    await expect(
      page.getByRole('heading', { name: 'Unsaved League' }),
    ).toBeVisible()
  })
})
