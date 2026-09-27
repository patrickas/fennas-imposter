import { expect, test, type Page } from '@playwright/test'
import { addPlayers, dealCards, startGame, startGmRound } from './helpers'

// Confirmations use the app's own dialog, never the browser's alert/confirm/prompt: those look
// foreign, can't be styled or translated consistently, and are suppressed by some browsers.

function recordNativeDialogs(page: Page): string[] {
  const seen: string[] = []
  page.on('dialog', (dialog) => {
    seen.push(dialog.message())
    void dialog.dismiss()
  })
  return seen
}

test('leaving and abandoning a round ask in the app: cancel stays, confirm proceeds', async ({ page }) => {
  const native = recordNativeDialogs(page)
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGame(page)
  await page.getByTestId('start-round').click()

  await page.getByTestId('leave-round').click()
  await expect(page.getByTestId('dialog')).toContainText('Leave the round?')
  await page.getByTestId('dialog-cancel').click()
  await expect(page.getByTestId('dialog')).toHaveCount(0)
  await expect(page.getByTestId('pass-screen')).toBeVisible()

  await page.getByTestId('leave-round').click()
  await page.getByTestId('dialog-confirm').click()
  await page.getByTestId('abandon-round').click()
  await expect(page.getByTestId('dialog')).toContainText('Abandon the round in progress?')
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('abandon-round')).toHaveCount(0)
  expect(native).toEqual([])
})

test('ending the game asks in the app', async ({ page }) => {
  const native = recordNativeDialogs(page)
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGame(page)
  await page.getByTestId('end-game').click()
  await expect(page.getByTestId('dialog')).toContainText('End the game and clear the scores?')
  await page.getByTestId('dialog-cancel').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
  await page.getByTestId('end-game').click()
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('play')).toHaveText("Let's play")
  expect(native).toEqual([])
})

test('deleting a custom word and category asks in the app', async ({ page }) => {
  const native = recordNativeDialogs(page)
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGmRound(page, { word: 'Mansaf', newCategory: 'Jordanian food' })
  await dealCards(page, 3)
  await page.getByTestId('leave-round').click()
  await page.getByTestId('dialog-confirm').click()
  await page.getByTestId('nav-words').click()

  await page.getByTestId('custom-word').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('dialog')).toContainText('Delete this word?')
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('custom-word')).toHaveCount(0)

  await page.getByTestId('custom-category').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('dialog')).toContainText('Delete this category')
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('words-empty')).toBeVisible()
  expect(native).toEqual([])
})
