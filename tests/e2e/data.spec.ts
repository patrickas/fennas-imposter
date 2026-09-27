import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, startGmRound } from './helpers'

const PACK = {
  format: 'fennas-imposter',
  version: 1,
  categories: [{ id: 'levant-sweets', name: { en: 'Levantine sweets', ar: 'حلويات شامية' } }],
  words: [
    { id: 'levant-sweets.baklava', categoryId: 'levant-sweets', text: { en: 'Baklava', ar: 'بقلاوة' }, hint: { en: 'Syrup', ar: 'قطر' } },
    { id: 'levant-sweets.halawa', categoryId: 'levant-sweets', text: { ar: 'حلاوة' }, hint: { ar: 'طحينة' } },
  ],
}

test('a backup exported on one phone restores players and custom words on another', async ({ page, browser }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGmRound(page, { word: 'Mansaf', newCategory: 'Jordanian food' })
  await dealCards(page, 3)
  await page.goto('/#/data')
  await page.getByTestId('dialog-confirm').click() // leave the round in progress
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()])
  expect(download.suggestedFilename()).toMatch(/^fennas-imposter-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const phone2 = await other.newPage()
  await phone2.goto('/#/data')
  await phone2.getByTestId('import-file').setInputFiles(file)
  await expect(phone2.getByTestId('import-summary')).toContainText('Adds 1 category')
  await expect(phone2.getByTestId('import-summary')).toContainText('Adds 3 players')
  await phone2.getByTestId('import-confirm').click()
  await expect(phone2.getByTestId('import-done')).toBeVisible()
  await phone2.goto('/#/words')
  await expect(phone2.getByTestId('custom-word')).toContainText('Mansaf')
  await other.close()
})

test('a word pack can be imported from an https link', async ({ page }) => {
  await page.route('https://packs.example.test/sweets.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(PACK) }),
  )
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('https://packs.example.test/sweets.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-summary')).toContainText('Adds 1 category')
  await expect(page.getByTestId('import-summary')).toContainText('Adds 2 words')
  await page.getByTestId('import-confirm').click()
  await page.goto('/#/words')
  await expect(page.getByTestId('custom-word')).toHaveCount(2)
})

test('a plain http link is refused before any request is made', async ({ page }) => {
  let requested = false
  await page.route('http://packs.example.test/**', (route) => {
    requested = true
    return route.abort()
  })
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('http://packs.example.test/sweets.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-problem')).toHaveText('Only https:// links are allowed')
  expect(requested).toBe(false)
})

test('a broken pack lists its problems and changes nothing', async ({ page }) => {
  await page.route('https://packs.example.test/broken.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ...PACK, words: [{ id: 'x', categoryId: 'nowhere', text: { en: 'X' } }] }) }),
  )
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('https://packs.example.test/broken.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-errors')).toContainText('unknown category')
  await expect(page.getByTestId('import-confirm')).toHaveCount(0)
})
