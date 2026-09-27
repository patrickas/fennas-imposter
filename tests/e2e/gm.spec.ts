import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, startGmRound } from './helpers'

test('a player Game Master sits out, and their word is saved to My words', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await startGmRound(page, { gmPlayer: 'Rami', word: 'Mansaf', newCategory: 'Jordanian food' })
  const deal = await dealCards(page, 3)
  expect([...deal.crew, ...deal.imposters]).not.toContain('Rami')
  expect(deal.crewWords.every((w) => w === 'Mansaf')).toBe(true)

  await page.goto('/#/words')
  await expect(page.getByTestId('custom-category')).toContainText('Jordanian food')
  await expect(page.getByTestId('custom-word')).toContainText('Mansaf')
})

test('maximum-length words and names wrap instead of overflowing a small phone', async ({ page }) => {
  // Screens clip their own overflow, so a page-level scrollWidth check could never fail. Instead,
  // check that no element inside the screen pokes outside the viewport or overflows its own box.
  await page.setViewportSize({ width: 360, height: 740 })
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
