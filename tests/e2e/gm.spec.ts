import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, openSetupPanel, startGame, startGmRound, startPlaying } from './helpers'

test('a player Game Master sits out, and their word is saved to My words', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await startGmRound(page, { gmPlayer: 'Rami', word: 'Mansaf', newCategory: 'Jordanian food' })
  const deal = await dealCards(page, 3)
  expect([...deal.crew, ...deal.imposters]).not.toContain('Rami')
  expect(deal.crewWords.every((w) => w === 'Mansaf')).toBe(true)

  await page.goto('/#/words')
  await page.getByTestId('dialog-confirm').click() // leave the round in progress
  await expect(page.getByTestId('custom-category')).toContainText('Jordanian food')
  await expect(page.getByTestId('custom-word')).toContainText('Mansaf')
})

// The source used to be picked on the round screen and went back to "Random word" before every round.
test('where the word comes from is set in Settings and kept for the next rounds; the round screen shows the title', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await startGame(page, { source: 'playerGm', gmPlayer: 'Lina' })
  await expect(page.getByTestId('title-card')).toHaveText('Fennass, Imposter')
  await expect(page.getByTestId('source-random')).toHaveCount(0)

  await page.reload()
  await page.getByTestId('edit-setup').click()
  await openSetupPanel(page, 'settings')
  await expect(page.getByTestId('source-playerGm')).toBeChecked()
  await expect(page.getByTestId('gm-select').locator('option:checked')).toHaveText('Lina')
  await page.getByTestId('setup-done').click()
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('gm-pass')).toContainText('Lina')
})

test('the Game Master has to pick a category, so nothing is filed under the first one by accident', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGame(page, { source: 'outsideGm' })
  await page.getByTestId('start-round').click()
  await page.getByTestId('gm-ready').click()
  await page.getByTestId('gm-word').fill('Mansaf')
  await expect(page.getByTestId('gm-category')).toHaveValue('')
  await page.getByTestId('gm-submit').click()
  await expect(page.getByTestId('gm-form')).toContainText('Choose a category')
  await expect(page.getByTestId('pass-screen')).toHaveCount(0)
})

test('maximum-length words and names wrap instead of overflowing a small phone', async ({ page }) => {
  // Screens clip their own overflow, so a page-level scrollWidth check could never fail. Instead,
  // check that no element inside the screen pokes outside the viewport or overflows its own box.
  await page.setViewportSize({ width: 360, height: 740 })
  await page.emulateMedia({ reducedMotion: 'no-preference' }) // wobbling cards must stay on screen too
  const longName = 'W'.repeat(20) // widest glyph, at the 20-character limit
  await page.goto('/')
  await addPlayers(page, [longName, 'Lina', 'Omar', 'Sara'], { scoring: true })
  await startGmRound(page, { word: 'W'.repeat(40), newCategory: 'C'.repeat(30) })
  const fitsOnScreen = async (where: string) => {
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      return [...document.querySelectorAll('main.screen .inner *')]
        .filter((el) => !el.closest('.confetti')) // decorative layer, clipped by its own fixed box
        .filter((el) => {
          const r = el.getBoundingClientRect()
          // Text overflow shows up on the leaf that holds the text. (Containers also report scroll
          // overflow from their wobbling, transformed stickers, which stay inside the viewport.)
          const overflowsOwnBox = el.children.length === 0 && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1
          return r.left < -1 || r.right > vw + 1 || overflowsOwnBox
        })
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
    })
    expect(offenders, where).toEqual([])
  }
  await dealCards(page, 4, () => fitsOnScreen('pass/card'))
  await fitsOnScreen('starting')
  await startPlaying(page)
  await fitsOnScreen('discussion')
  await page.getByTestId('end-discussion').click()
  await fitsOnScreen('vote')
  await page.getByTestId('vote-nobody').click()
  await expect(page.getByTestId('result')).toBeVisible()
  await fitsOnScreen('result + scoreboard')
  await page.getByTestId('next-round').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
  await fitsOnScreen('between rounds + scoreboard')
})
