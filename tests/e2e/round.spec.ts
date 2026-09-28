import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, startGame, startPlaying } from './helpers'

const PLAYERS = ['Rami', 'Lina', 'Omar', 'Sara']

test('every player sees exactly one card, the crew share one word, and the imposter gets a hint', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, PLAYERS.length)
  expect(new Set([...deal.imposters, ...deal.crew])).toEqual(new Set(PLAYERS))
  expect(deal.imposters).toHaveLength(1)
  expect(new Set(deal.crewWords).size).toBe(1)
  expect(deal.hints).toHaveLength(1)
  expect(deal.categories).toHaveLength(0) // the category stays off the cards unless Setup switches it on
  await expect(page.getByTestId('lang-en')).toHaveCount(0) // language is locked mid-round
})

test('reloading in the middle of dealing never re-shows a card', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await page.getByTestId('start-round').click()
  const first = (await page.getByTestId('pass-name').innerText()).trim()
  await page.getByTestId('show-card').click()
  await expect(page.getByTestId('card-screen')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
  await expect(page.getByTestId('card-screen')).toHaveCount(0)
  await expect(page.getByTestId('pass-name')).toHaveText(first)
})

test('a scored round: catching the imposter who then misses the word gives each crew member a point', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS, { scoring: true })
  await startGame(page)
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, PLAYERS.length)
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  await page.getByTestId('vote-player').filter({ hasText: deal.imposters[0] }).click()
  await page.getByTestId('guess-no').click()
  await expect(page.getByTestId('winner')).toHaveText('The crew wins!')
  await expect(page.getByTestId('result-word')).toHaveText(deal.crewWords[0])
  await expect(page.getByTestId('result-imposters')).toContainText(deal.imposters[0])
  const rows = page.getByTestId('score-row')
  for (const name of deal.crew) await expect(rows.filter({ hasText: name })).toContainText('1 pt')
  await expect(rows.filter({ hasText: deal.imposters[0] })).toContainText('0 pts')
  await page.getByTestId('next-round').click()
  await expect(page.getByTestId('between-rounds')).toContainText('Round 2')
})

test('an Arabic round is right-to-left and deals Arabic words', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await addPlayers(page, ['رامي', 'لينا', 'عمر'])
  await startGame(page)
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 3)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(deal.crewWords[0]).toMatch(/[؀-ۿ]/)
  expect(deal.hints[0]).toMatch(/^تلميح: .*[\u0600-\u06FF]/) // spec §14 e2e #2: the Arabic hint
})

test('too few players blocks the round with an explanation', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina'])
  await startGame(page)
  await expect(page.getByTestId('round-blocker')).toBeVisible()
  await expect(page.getByTestId('start-round')).toBeDisabled()
})

test('after the last card the starter is announced, and the timer only starts with "Start playing"', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await page.getByTestId('nav-setup').click()
  await page.getByTestId('toggle-timer').click()
  await page.getByTestId('setup-done').click()
  await startGame(page)
  await page.getByTestId('start-round').click()
  await dealCards(page, PLAYERS.length)
  await expect(page.getByTestId('starter')).toContainText('starts')
  await expect(page.getByTestId('timer')).toHaveCount(0)
  await page.waitForTimeout(2_000) // the group settles down; the clock must not be running yet
  await startPlaying(page)
  await expect(page.getByTestId('timer')).toHaveText('3:00')
})
