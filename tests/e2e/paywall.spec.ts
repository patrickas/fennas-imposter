import { expect, test, type Page } from '@playwright/test'
import { KEY_WORDS, localDay, magicWord } from '../../src/data/license'
import { addPlayers, dealCards, startGame, startPlaying } from './helpers'
import { phoneState } from './phone-state'

// A free phone plays 2 rounds a day; after that, between rounds, the only way on is to unlock.
test.use({ storageState: phoneState({ paid: false }) }) // a phone that has not paid

const PLAYERS = ['Rami', 'Lina', 'Omar']

async function playRound(page: Page): Promise<void> {
  await page.getByTestId('start-round').click()
  await dealCards(page, PLAYERS.length)
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  await page.getByTestId('next-round').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
}

test('a free phone plays 2 rounds, then must unlock; the magic word lets the game go on', async ({ page }) => {
  test.slow() // two full deals
  await page.goto('/')
  await expect(page.getByTestId('free-rounds')).toHaveText('2 free rounds left today')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await playRound(page)
  await playRound(page)

  await expect(page.getByTestId('round-blocker')).toHaveText('No free rounds left today.')
  await expect(page.getByTestId('start-round')).toHaveCount(0)
  await page.getByTestId('go-unlock').click()

  const secret = (await page.getByTestId('my-secret-word').innerText()).trim()
  await page.getByTestId('magic-input').fill(magicWord(KEY_WORDS.indexOf(secret)).toUpperCase())
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlocked')).toBeVisible()

  await page.getByTestId('back').click()
  await expect(page.getByTestId('free-rounds')).toHaveCount(0)
  await page.getByTestId('play').click()
  await expect(page.getByTestId('between-rounds')).toContainText('Round 3')
  await expect(page.getByTestId('start-round')).toBeEnabled()
})

test('Home counts down the free rounds as they are dealt', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
  await page.getByTestId('leave-round').click()
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('free-rounds')).toHaveText('1 free round left today')
})

test("a phone left on the locked screen overnight offers the new day's rounds when it is picked up again", async ({ page }) => {
  const evening = new Date(2026, 9, 3, 20, 0)
  await page.clock.setFixedTime(evening)
  await page.goto('/')
  const spent = { secret: 0, unlocked: false, owner: false, day: localDay(evening.getTime()), used: 2 }
  await page.evaluate((v) => localStorage.setItem('fennas-imposter:license', v), JSON.stringify(spent))
  await page.reload()
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await expect(page.getByTestId('go-unlock')).toBeVisible()

  await page.clock.setFixedTime(new Date(2026, 9, 4, 9, 0))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))) // the phone is picked up again
  await expect(page.getByTestId('start-round')).toBeEnabled()
})
