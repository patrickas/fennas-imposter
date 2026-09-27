import { expect, type Page } from '@playwright/test'

/** From Home: open Setup, add players (fresh browser context assumed), optionally enable scoring, press Done. */
export async function addPlayers(page: Page, names: readonly string[], opts: { scoring?: boolean } = {}): Promise<void> {
  await page.getByTestId('nav-setup').click()
  for (const name of names) {
    await page.getByTestId('new-player').fill(name)
    await page.getByTestId('add-player').click()
  }
  await expect(page.getByTestId('player-row')).toHaveCount(names.length)
  if (opts.scoring) await page.getByTestId('toggle-scoring').click()
  await page.getByTestId('setup-done').click()
}
