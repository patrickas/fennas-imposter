import { expect, test, type Page } from '@playwright/test'
import { addPlayers, dealCards, openSetupPanel, startGmRound, startPlaying } from './helpers'

const PLAYERS = ['Rami', 'Lina', 'Omar']

/** From Home: "Let's play" opens Setup; pick the difficulty there and start the game. */
async function startGameAt(page: Page, difficulty: 'easy' | 'hard'): Promise<void> {
  await page.getByTestId('play').click()
  await openSetupPanel(page, 'settings')
  await page.getByTestId(`difficulty-${difficulty}`).check()
  await page.getByTestId('setup-done').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
}

test('on Hard, every player sees the Hard badge in the same place, through to the result', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await startGameAt(page, 'hard')
  await page.getByTestId('start-round').click()
  // Same badge on every pass and card screen, imposter or not: it must not give a role away.
  await dealCards(page, PLAYERS.length, async () => {
    await expect(page.getByTestId('level-chip')).toHaveText('Hard')
  })
  await expect(page.getByTestId('level-chip')).toHaveText('Hard')
  await startPlaying(page)
  await expect(page.getByTestId('level-chip')).toHaveText('Hard')
  await page.getByTestId('end-discussion').click()
  await expect(page.getByTestId('level-chip')).toHaveText('Hard')
})

test('Easy is the default, and its rounds say Easy', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await page.getByTestId('play').click()
  await openSetupPanel(page, 'settings')
  await expect(page.getByTestId('difficulty-easy')).toBeChecked()
  await page.getByTestId('setup-done').click()
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('level-chip')).toHaveText('Easy')
})

const SUBTLE_PACK = {
  format: 'fennas-imposter',
  version: 1,
  categories: [{ id: 'sweets', name: { en: 'Sweets' } }],
  words: [
    {
      id: 'sweets.cake', categoryId: 'sweets', text: { en: 'Birthday cake' }, hint: { en: 'Candles' },
      subtle: { hint: { en: 'Lie' }, why: { en: 'The cake is a lie' } },
    },
  ],
}

test('a subtle-hint round gives the imposter the subtle hint and explains it at the end', async ({ page }) => {
  await page.route('https://packs.example.test/subtle.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(SUBTLE_PACK) }),
  )
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('https://packs.example.test/subtle.json')
  await page.getByTestId('import-url-load').click()
  await page.getByTestId('import-confirm').click()
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  // Only the imported category, which has no hard words: every Hard round is a subtle-hint round.
  await page.getByTestId('play').click()
  await openSetupPanel(page, 'categories')
  const others = page.locator('input[data-testid^="category-"]:not([data-testid="category-sweets"])')
  for (const box of await others.all()) await box.uncheck()
  await openSetupPanel(page, 'settings')
  await page.getByTestId('difficulty-hard').check()
  await page.getByTestId('setup-done').click()

  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, PLAYERS.length)
  expect(deal.crewWords[0]).toBe('Birthday cake')
  expect(deal.hints.map((h) => h.replace(/[\u2066-\u2069]/g, ''))).toEqual(['Hint: Lie']) // the hint is bidi-isolated
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  await expect(page.getByTestId('result-hint')).toHaveText('Lie')
  await expect(page.getByTestId('result-why')).toHaveText('The cake is a lie')
})

test('Game Master rounds have no level: no Difficulty choice and no badge', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await page.getByTestId('nav-setup').click()
  await openSetupPanel(page, 'settings')
  await expect(page.getByTestId('difficulty-hard')).toBeVisible()
  await page.getByTestId('source-outsideGm').check()
  await expect(page.getByTestId('difficulty-hard')).toHaveCount(0)
  await page.getByTestId('source-random').check()
  await page.getByTestId('setup-done').click()
  await startGmRound(page, { word: 'Mansaf', newCategory: 'Jordan' })
  await expect(page.getByTestId('level-chip')).toHaveCount(0)
  await page.getByTestId('show-card').click()
  await expect(page.getByTestId('card-screen')).toBeVisible()
  await expect(page.getByTestId('level-chip')).toHaveCount(0)
})
