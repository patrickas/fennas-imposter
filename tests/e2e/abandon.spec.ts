import { expect, test } from '@playwright/test'
import { addPlayers } from './helpers'

// A spoiled round (someone peeked, a card was lost, the Game Master typo'd) needs a way out that
// doesn't force the group to play it through and hand out points. Installed iPhone apps have no
// back button, so the way out must be on screen.

test('a spoiled round can be left from the screen and abandoned without touching the scores', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'], { scoring: true })
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()

  await page.getByTestId('leave-round').click()
  await page.getByTestId('dialog-confirm').click()
  await page.getByTestId('abandon-round').click()
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('abandon-round')).toHaveCount(0)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fennas-imposter')!))
  expect(stored.round).toBeNull()
  expect(stored.session).toEqual({ scores: {}, rounds: 0 })
  await page.getByTestId('play').click()
  await expect(page.getByTestId('between-rounds')).toContainText('Round 1')
})
