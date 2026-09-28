import { expect, test } from '@playwright/test'
import { addPlayers, dealCards } from './helpers'

test('players are remembered after the app is closed and reopened', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await page.reload()
  await page.getByTestId('nav-setup').click()
  await expect(page.getByTestId('player-row')).toHaveCount(3)
})

test('Done is on screen without scrolling Setup, and never covers the last setting', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara', 'Nour', 'Hadi', 'Maya', 'Karim'])
  await page.getByTestId('nav-setup').click()
  const done = page.getByTestId('setup-done')
  await expect(done).toBeInViewport()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(done).toBeInViewport()
  const last = (await page.getByTestId('toggle-scoring').boundingBox())!
  const bar = (await done.boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y)
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

// Who is in the room changes from one evening to the next, so a new game always starts on the player
// list; a game already under way goes straight back in, so scores and rounds aren't interrupted.
test('a new game first shows the players to confirm or change; continuing a game skips them', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])

  await page.getByTestId('play').click()
  await expect(page.getByTestId('player-row')).toHaveCount(3)
  await expect(page.getByTestId('setup-done')).toHaveText("Let's play")
  await page.goBack()
  await expect(page.getByTestId('play')).toHaveText("Let's play") // backing out started nothing

  await page.getByTestId('play').click()
  await page.getByRole('button', { name: /Remove.*Omar/ }).click()
  await page.getByTestId('new-player').fill('Sara')
  await page.getByTestId('add-player').click()
  await page.getByTestId('setup-done').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()

  await page.evaluate(() => {
    location.hash = '#/'
  })
  await expect(page.getByTestId('play')).toHaveText('Continue game')
  await page.getByTestId('play').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()

  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 3)
  expect(new Set([...deal.crew, ...deal.imposters])).toEqual(new Set(['Rami', 'Lina', 'Sara']))
})
