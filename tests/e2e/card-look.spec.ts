import { expect, test } from '@playwright/test'
import { addPlayers } from './helpers'

// Bystanders see the screen's colour and motion from across the room, even when they can't read
// the text. If crew and imposter cards look different, the role leaks without anyone peeking.

test('the card screen looks the same for crew and imposter; only the text differs', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const looks: Record<'crew' | 'imposter', Set<string>> = { crew: new Set(), imposter: new Set() }
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('show-card').click()
    const screen = page.getByTestId('card-screen')
    await expect(screen).toBeVisible()
    const look = await screen.evaluate((el) => {
      const card = getComputedStyle(el.querySelector('.sticker')!)
      return [getComputedStyle(el).backgroundColor, card.backgroundColor, card.color, card.animationName].join(' | ')
    })
    const role = (await page.getByTestId('imposter-title').count()) > 0 ? 'imposter' : 'crew'
    looks[role].add(look)
    await page.getByTestId('hide-pass').click()
  }
  expect(looks.imposter.size).toBe(1)
  expect([...looks.crew]).toEqual([...looks.imposter])
})
