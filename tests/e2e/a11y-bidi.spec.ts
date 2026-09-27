import { expect, test, type Locator } from '@playwright/test'
import { addPlayers, dealCards, startPlaying } from './helpers'

/** True when the "!" of "Sam!" is drawn to the right of the "S" — i.e. the name kept its own direction. */
async function nameKeepsItsShape(locator: Locator): Promise<boolean> {
  return locator.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const i = node.textContent!.indexOf('Sam!')
      if (i < 0) continue
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const s = range.getBoundingClientRect()
      range.setStart(node, i + 3)
      range.setEnd(node, i + 4)
      return range.getBoundingClientRect().left > s.left
    }
    throw new Error('name not found')
  })
}

test('a Latin name with punctuation keeps its shape on Arabic screens ("Sam!" never shows as "!Sam")', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await addPlayers(page, ['Sam!', 'لينا', 'عمر'], { scoring: true })
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  expect(await nameKeepsItsShape(page.getByTestId('pass-name'))).toBe(true)
  await page.getByTestId('show-card').click()
  expect(await nameKeepsItsShape(page.getByTestId('card-screen').locator('.chip'))).toBe(true)
  await page.getByTestId('hide-pass').click()
  await dealCards(page, 2)
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  expect(await nameKeepsItsShape(page.getByTestId('vote-player').filter({ hasText: 'Sam!' }))).toBe(true)
  await page.getByTestId('vote-nobody').click()
  expect(await nameKeepsItsShape(page.getByTestId('score-row').filter({ hasText: 'Sam!' }))).toBe(true)
})

test("each player's checkbox and name field is labelled with that player's name for screen readers", async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await page.getByTestId('nav-setup').click()
  await expect(page.getByRole('checkbox', { name: /Rami\W*is playing/ })).toBeChecked()
  await expect(page.getByRole('textbox', { name: /Rename\W*Rami/ })).toHaveValue('Rami')
})

test('language and notice buttons are thumb-sized (at least 48 px tall)', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('fennas-imposter', '{damaged'))
  await page.reload()
  const tall = async (locator: Locator) => ((await locator.boundingBox())?.height ?? 0) >= 47.5
  expect(await tall(page.getByTestId('lang-en'))).toBe(true)
  expect(await tall(page.getByTestId('status-banner').getByRole('button'))).toBe(true)
})
