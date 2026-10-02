import { expect, test } from '@playwright/test'
import { KEY_WORDS, magicWord } from '../../src/data/license'

// Alex sells the game face to face: About shows the phone's secret word, takes the magic word he
// gives for it, and on his own phone (after the owner password) works out magic words for others.
test.use({ storageState: { cookies: [], origins: [] } }) // a phone that has not paid

test('About shows the secret word, refuses a wrong word, and the right magic word unlocks the phone', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-about').click()
  const secret = (await page.getByTestId('my-secret-word').innerText()).trim()
  const index = KEY_WORDS.indexOf(secret)
  expect(index).toBeGreaterThanOrEqual(0)

  const help = await page.getByTestId('help-email').getAttribute('href')
  expect(help).toMatch(/^mailto:fennas\.game@abisalloum\.com\?/)
  expect(decodeURIComponent(help!)).toContain(`My secret word: ${secret}`)
  await expect(page.getByTestId('help-email')).toHaveText('Email us')

  await page.getByTestId('magic-input').fill(secret) // the word on the customer's own screen is not the key
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlock-wrong')).toHaveText("That's not it")

  await page.getByTestId('magic-input').fill(`${magicWord(index)} `)
  await page.getByTestId('magic-input').press('Enter')
  await expect(page.getByTestId('unlocked')).toBeVisible()
  await expect(page.getByTestId('magic-input')).toHaveCount(0)
  await expect(page.getByTestId('help-email')).toHaveCount(0)
  await expect(page.getByTestId('owner-tools')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('unlocked')).toBeVisible()
})

test("the owner password turns a phone into Alex's key maker", async ({ page }) => {
  await page.goto('/#/about')
  await page.getByTestId('magic-input').fill('Wrong Horse Battery Staple')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlocked')).toBeVisible()
  await page.getByTestId('key-input').fill(KEY_WORDS[42].toLowerCase())
  await page.getByTestId('make-key').click()
  await expect(page.getByTestId('key-result')).toHaveText(magicWord(42))
  await page.getByTestId('key-input').fill('not a secret word')
  await page.getByTestId('make-key').click()
  await expect(page.getByTestId('key-result')).toHaveText("That's not one of the secret words")
  await page.reload()
  await expect(page.getByTestId('owner-tools')).toBeVisible()
})

test('in Arabic, the secret word is still the English word, laid out left to right', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await page.getByTestId('nav-about').click()
  const word = page.getByTestId('my-secret-word')
  await expect(word).toHaveAttribute('dir', 'ltr')
  expect(KEY_WORDS).toContain((await word.innerText()).trim())
})
