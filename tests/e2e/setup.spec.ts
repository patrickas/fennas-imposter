import { expect, test } from '@playwright/test'
import { addPlayers } from './helpers'

test('players are remembered after the app is closed and reopened', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await page.reload()
  await page.getByTestId('nav-setup').click()
  await expect(page.getByTestId('player-row')).toHaveCount(3)
})

test('names that only differ by case, spacing or Arabic spelling are rejected', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-setup').click()
  for (const [first, duplicate] of [['Rami', ' rami '], ['أحمد', 'احمد']]) {
    await page.getByTestId('new-player').fill(first)
    await page.getByTestId('add-player').click()
    await expect(page.getByTestId('add-error')).toHaveCount(0)
    await page.getByTestId('new-player').fill(duplicate)
    await page.getByTestId('add-player').click()
    await expect(page.getByTestId('add-error')).toBeVisible()
  }
  await expect(page.getByTestId('player-row')).toHaveCount(2)
})

test('Arabic flips the whole app right-to-left and is remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('the imposter count cannot be raised past what the players allow', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['A', 'B', 'C', 'D', 'E'])
  await page.getByTestId('nav-setup').click()
  await page.getByTestId('imposters-inc').click()
  await expect(page.getByTestId('imposters-value')).toHaveText('2')
  await expect(page.getByTestId('imposters-inc')).toBeDisabled()
})

test('the dev-only test mode is never offered in the production build', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-setup').click()
  await expect(page.getByTestId('toggle-scoring')).toBeVisible()
  await expect(page.getByTestId('toggle-test-mode')).toHaveCount(0)
})

test('the discussion timer cannot be set below 1 minute (spec: 1–10 min)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-setup').click()
  await page.getByTestId('toggle-timer').click()
  const dec = page.getByTestId('timer-seconds-dec')
  while (await dec.isEnabled()) await dec.click()
  await expect(page.getByTestId('timer-seconds-value')).toHaveText('1:00')
})
