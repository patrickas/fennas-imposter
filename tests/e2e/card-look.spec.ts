import { expect, test, type Page } from '@playwright/test'
import { addPlayers } from './helpers'

// Bystanders see the screen's colour, motion and the card's shape from across the room, even when
// they can't read the text. If crew and imposter cards look different, the role leaks without anyone
// peeking. So both cards share the same screen, card, motion and two-line layout; only the text differs.

async function dealAndCompare(page: Page): Promise<void> {
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const looks: Record<'crew' | 'imposter', Set<string>> = { crew: new Set(), imposter: new Set() }
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('show-card').click()
    const screen = page.getByTestId('card-screen')
    await expect(screen).toBeVisible()
    const look = await screen.evaluate((el) => {
      const sticker = el.querySelector('.sticker')!
      const card = getComputedStyle(sticker)
      const layout = [...sticker.children].map((c) => c.classList[0]).join(' + ')
      return [getComputedStyle(el).backgroundColor, card.backgroundColor, card.color, card.animationName, layout].join(' | ')
    })
    const role = (await page.getByTestId('imposter-title').count()) > 0 ? 'imposter' : 'crew'
    if (role === 'crew') await expect(page.getByTestId('crew-title')).toHaveText('The secret word is')
    looks[role].add(look)
    await page.getByTestId('hide-pass').click()
  }
  expect(looks.imposter.size).toBe(1)
  expect([...looks.crew]).toEqual([...looks.imposter])
}

test('crew and imposter cards look the same (with hints): only the text differs', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await dealAndCompare(page)
})

test('crew and imposter cards look the same with hints off too', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await page.getByTestId('nav-setup').click()
  await page.getByTestId('toggle-hints').click()
  await page.getByTestId('setup-done').click()
  await dealAndCompare(page)
})
