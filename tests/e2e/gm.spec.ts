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
  await page.setViewportSize({ width: 360, height: 740 })
  const longName = 'Abcdefghijklmnopqrst' // 20 characters, the limit
  await page.goto('/')
  await addPlayers(page, [longName, 'Lina', 'Omar', 'Sara'])
  await startGmRound(page, { word: 'W'.repeat(40), newCategory: 'Long' })
  const noHorizontalScroll = async () => {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(fits).toBe(true)
  }
  await dealCards(page, 4, noHorizontalScroll)
})
