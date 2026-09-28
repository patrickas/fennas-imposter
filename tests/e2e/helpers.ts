import { expect, type Page } from '@playwright/test'

/** From Home: open Setup, add players (fresh browser context assumed), optionally enable scoring, press Done. */
export async function addPlayers(page: Page, names: readonly string[], opts: { scoring?: boolean } = {}): Promise<void> {
  await page.getByTestId('nav-setup').click()
  for (const name of names) {
    await page.getByTestId('new-player').fill(name)
    await page.getByTestId('add-player').click()
  }
  await expect(page.getByTestId('player-row')).toHaveCount(names.length)
  if (opts.scoring) {
    await openSetupPanel(page, 'settings')
    await page.getByTestId('toggle-scoring').click()
  }
  await page.getByTestId('setup-done').click()
}

/** On Setup: open a folded panel (Categories and Settings start closed) so its controls can be reached. */
export async function openSetupPanel(page: Page, panel: 'categories' | 'settings'): Promise<void> {
  await page.getByTestId(`fold-${panel}`).click()
}

/**
 * From Home with no game running: "Let's play" opens Setup to confirm the players (and, when given, to choose
 * where the word comes from), and its button starts the game.
 */
export async function startGame(page: Page, opts: { source?: 'playerGm' | 'outsideGm'; gmPlayer?: string } = {}): Promise<void> {
  await page.getByTestId('play').click()
  if (opts.source) await chooseWordSource(page, opts.source, opts.gmPlayer)
  await page.getByTestId('setup-done').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
}

/** On Setup: choose where the word comes from, and the player Game Master, in the Settings panel. */
export async function chooseWordSource(page: Page, source: 'random' | 'playerGm' | 'outsideGm', gmPlayer?: string): Promise<void> {
  await openSetupPanel(page, 'settings')
  await page.getByTestId(`source-${source}`).check()
  if (gmPlayer) await page.getByTestId('gm-select').selectOption({ label: gmPlayer })
}

export interface Deal {
  imposters: string[]
  crew: string[]
  crewWords: string[]
  hints: string[]
  /** The "Category: …" line on each card, when the option shows it. */
  categories: string[]
}

/** Passes the phone through `count` players, recording what each one saw, and ends on the Starting screen. `onScreen` runs on every pass/card screen. */
export async function dealCards(page: Page, count: number, onScreen?: () => Promise<void>): Promise<Deal> {
  const deal: Deal = { imposters: [], crew: [], crewWords: [], hints: [], categories: [] }
  for (let i = 0; i < count; i++) {
    await expect(page.getByTestId('pass-screen')).toBeVisible()
    const name = (await page.getByTestId('pass-name').innerText()).trim()
    if (onScreen) await onScreen()
    await page.getByTestId('show-card').click()
    await expect(page.getByTestId('card-screen')).toBeVisible()
    if (onScreen) await onScreen()
    if ((await page.getByTestId('imposter-title').count()) > 0) {
      deal.imposters.push(name)
      if ((await page.getByTestId('imposter-hint').count()) > 0) {
        deal.hints.push((await page.getByTestId('imposter-hint').innerText()).trim())
      }
    } else {
      deal.crew.push(name)
      deal.crewWords.push((await page.getByTestId('secret-word').innerText()).trim())
    }
    if ((await page.getByTestId('card-category').count()) > 0) {
      deal.categories.push((await page.getByTestId('card-category').innerText()).trim())
    }
    await page.getByTestId('hide-pass').click()
  }
  await expect(page.getByTestId('starting')).toBeVisible()
  return deal
}

/** From the Starting screen ("X starts"): tap "Start playing" and land on the playing screen. */
export async function startPlaying(page: Page): Promise<void> {
  await page.getByTestId('start-playing').click()
  await expect(page.getByTestId('discussion')).toBeVisible()
}

/** From Home: start a GM round (player GM when `gmPlayer` is given, otherwise outside GM) and submit a word in a new category. */
export async function startGmRound(page: Page, opts: { gmPlayer?: string; word: string; newCategory: string }): Promise<void> {
  await startGame(page, { source: opts.gmPlayer ? 'playerGm' : 'outsideGm', gmPlayer: opts.gmPlayer })
  await page.getByTestId('start-round').click()
  await page.getByTestId('gm-ready').click()
  await page.getByTestId('gm-word').fill(opts.word)
  await page.getByTestId('gm-category').selectOption('__new__')
  await page.getByTestId('gm-new-category').fill(opts.newCategory)
  await page.getByTestId('gm-submit').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
}
