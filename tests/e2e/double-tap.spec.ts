import { expect, test, type Locator, type Page } from '@playwright/test'
import { addPlayers, dealCards, startPlaying } from './helpers'

// A tap that lands twice — a double tap, or an impatient re-tap — must never fall through to the
// button that appears in the same spot on the next screen. Falling through shows a card to the
// wrong player, destroys a card before it is read, or skips (and scores) part of the round.

const PLAYERS = ['Rami', 'Lina', 'Omar']

async function startRound(page: Page, opts: { scoring?: boolean } = {}): Promise<void> {
  await page.goto('/')
  await addPlayers(page, PLAYERS, opts)
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
}

/**
 * Tap `target`, wait until the next screen has put `appearing` in the same spot, then tap the
 * same spot again ~250 ms later — an impatient re-tap. Deterministic, unlike a fixed-gap double tap.
 */
async function tapThenRetap(page: Page, target: Locator, appearing: Locator): Promise<void> {
  await target.click({ trial: true }) // the first tap is a real one: wait until the button accepts input
  const box = await target.boundingBox()
  if (!box) throw new Error('target not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.click(x, y)
  await expect(appearing).toBeVisible()
  await page.waitForTimeout(250)
  await page.mouse.click(x, y)
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(300) // let any fall-through second tap finish rendering
}

test('re-tapping "show me" keeps the card on screen for that same player', async ({ page }) => {
  await startRound(page)
  const first = (await page.getByTestId('pass-name').innerText()).trim()
  await tapThenRetap(page, page.getByTestId('show-card'), page.getByTestId('hide-pass'))
  await settle(page)
  await expect(page.getByTestId('card-screen')).toBeVisible()
  await expect(page.getByTestId('card-screen')).toContainText(first)
})

test('re-tapping "Hide & pass" never shows the next player\'s card', async ({ page }) => {
  await startRound(page)
  await page.getByTestId('show-card').click()
  await expect(page.getByTestId('card-screen')).toBeVisible()
  await tapThenRetap(page, page.getByTestId('hide-pass'), page.getByTestId('show-card'))
  await settle(page)
  await expect(page.getByTestId('pass-screen')).toBeVisible()
  await expect(page.getByTestId('card-screen')).toHaveCount(0)
})

test('re-tapping the last "Hide & pass" does not skip the starter announcement', async ({ page }) => {
  await startRound(page)
  for (let i = 0; i < PLAYERS.length - 1; i++) {
    await page.getByTestId('show-card').click()
    await page.getByTestId('hide-pass').click()
    await expect(page.getByTestId('pass-screen')).toBeVisible()
  }
  await page.getByTestId('show-card').click()
  await tapThenRetap(page, page.getByTestId('hide-pass'), page.getByTestId('start-playing'))
  await settle(page)
  await expect(page.getByTestId('starting')).toBeVisible()
})

test('re-tapping "Time to vote" does not vote "Nobody" for the group', async ({ page }) => {
  await startRound(page, { scoring: true })
  await dealCards(page, PLAYERS.length)
  await startPlaying(page)
  await tapThenRetap(page, page.getByTestId('end-discussion'), page.getByTestId('vote-nobody'))
  await settle(page)
  await expect(page.getByTestId('vote')).toBeVisible()
})

test('re-tapping "Nobody" does not skip past the result', async ({ page }) => {
  await startRound(page, { scoring: true })
  await dealCards(page, PLAYERS.length)
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  await tapThenRetap(page, page.getByTestId('vote-nobody'), page.getByTestId('next-round'))
  await settle(page)
  await expect(page.getByTestId('result')).toBeVisible()
})

test('re-tapping "Start playing" does not end the discussion straight away', async ({ page }) => {
  await startRound(page)
  await dealCards(page, PLAYERS.length)
  await tapThenRetap(page, page.getByTestId('start-playing'), page.getByTestId('end-discussion'))
  await settle(page)
  await expect(page.getByTestId('discussion')).toBeVisible()
})
