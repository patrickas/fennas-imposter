import { expect, test, type Page } from '@playwright/test'
import { dealCards, startGame, startPlaying } from './helpers'

// Spec behaviours that were first checked by hand (the final verification checklist), kept as tests.

async function seed(page: Page, over: Record<string, unknown>, settings: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([o, s]) => {
      const doc = {
        version: 1,
        language: 'en',
        players: [{ id: 'a', name: 'Rami' }, { id: 'b', name: 'Lina' }, { id: 'c', name: 'Omar' }, { id: 'd', name: 'Sara' }],
        activePlayerIds: ['a', 'b', 'c', 'd'],
        settings: { imposterCount: 1, randomImposterCount: false, hints: true, timer: { enabled: false, seconds: 180 }, scoring: false, ...s },
        selectedCategoryIds: ['food'],
        customCategories: [],
        customWords: [],
        usedWordIds: { en: [], ar: [] },
        lastImportUrl: null,
        session: null,
        round: null,
        ...o,
      }
      localStorage.setItem('fennas-imposter', JSON.stringify(doc))
    },
    [over, settings] as const,
  )
  await page.reload()
}

test('clamp notice, hints off, count chip, leave-round confirm with resume, and End game clearing scores', async ({ page }) => {
  await page.goto('/')
  await seed(page, {}, { imposterCount: 2, hints: false, scoring: true })
  await startGame(page)
  await expect(page.getByTestId('clamp-notice')).toContainText('using 1')
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 4)
  expect(deal.imposters).toHaveLength(1)
  expect(deal.hints).toHaveLength(0)
  await startPlaying(page)
  await expect(page.getByTestId('imposter-count')).toHaveText('There is 1 imposter among you')

  await page.evaluate(() => {
    location.hash = '#/'
  })
  await expect(page.getByTestId('dialog')).toHaveText(/Leave the round\? You can continue it later\./)
  await page.getByTestId('dialog-cancel').click()
  await expect(page.getByTestId('discussion')).toBeVisible()
  await page.evaluate(() => {
    location.hash = '#/'
  })
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('play')).toHaveText('Continue game')
  await page.getByTestId('play').click()
  await expect(page.getByTestId('discussion')).toBeVisible()

  await page.getByTestId('end-discussion').click()
  await page.getByTestId('vote-nobody').click()
  await page.getByTestId('next-round').click()
  await page.getByTestId('end-game').click()
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('play')).toHaveText("Let's play")
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fennas-imposter')!).session)).toBeNull()
})

test('a surprise imposter count stays hidden; a GM word without a hint gives the category as hint', async ({ page }) => {
  await page.goto('/')
  await seed(page, {}, { randomImposterCount: true, hints: true })
  await startGame(page)
  await page.getByTestId('source-outsideGm').check()
  await page.getByTestId('start-round').click()
  await page.getByTestId('gm-ready').click()
  await page.getByTestId('gm-word').fill('Mansaf')
  await page.getByTestId('gm-category').selectOption('__new__')
  await page.getByTestId('gm-new-category').fill('Jordanian food')
  await page.getByTestId('gm-submit').click()
  const deal = await dealCards(page, 4)
  expect(deal.hints.length).toBeGreaterThan(0)
  for (const hint of deal.hints) expect(hint).toBe('Hint: ⁨Jordanian food⁩')
  await expect(page.getByTestId('imposter-count')).toHaveText('How many imposters? Nobody knows…')
})

test('every Arabic screen is right-to-left with no English left (except the "English" switch label)', async ({ page }) => {
  await page.goto('/')
  await seed(
    page,
    {
      language: 'ar',
      players: [{ id: 'a', name: 'رامي' }, { id: 'b', name: 'لينا' }, { id: 'c', name: 'عمر' }, { id: 'd', name: 'سارة' }],
    },
    { scoring: true, timer: { enabled: true, seconds: 120 } },
  )
  const latin: Record<string, string[]> = {}
  const check = async (screen: string) => {
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    const words = ((await page.locator('body').innerText()).match(/[A-Za-z]{2,}/g) ?? []).filter((w) => w !== 'English')
    if (words.length) latin[screen] = words
  }
  await check('home')
  await page.getByTestId('nav-setup').click()
  await check('setup')
  await page.getByTestId('setup-done').click()
  await page.getByTestId('nav-words').click()
  await check('words')
  await page.getByTestId('back').click()
  await page.getByTestId('nav-data').click()
  await check('data')
  await page.getByTestId('back').click()
  await startGame(page)
  await check('between-rounds')
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 4, async () => check('pass/card'))
  await check('starting')
  await startPlaying(page)
  await check('playing')
  await page.getByTestId('end-discussion').click()
  await check('vote')
  await page.getByTestId('vote-player').filter({ hasText: deal.imposters[0] }).click()
  await check('guess')
  await page.getByTestId('guess-no').click()
  await check('result')
  expect(latin).toEqual({})
})
