import { expect, test } from '@playwright/test'
import { GAME_URL } from '../../src/data/share'

// Friends hear about the game from a friend: Home's Share button sends the link, with WhatsApp one tap away.
const MESSAGE = `Play Fennass with me! ${GAME_URL}`

test('a phone with a share menu gets the message and the link there, and no extra buttons', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        ;(window as unknown as { shared: ShareData }).shared = data
        return Promise.resolve()
      },
    })
  })
  await page.goto('/')
  await page.getByTestId('share').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared?.text)).toBe(MESSAGE)
  await expect(page.getByTestId('share-fallback')).toHaveCount(0)
})

test('closing the share menu without picking an app leaves Home as it was', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new DOMException('closed', 'AbortError')) })
  })
  await page.goto('/')
  await page.getByTestId('share').click()
  await expect(page.getByTestId('share')).toBeVisible()
  await expect(page.getByTestId('share-fallback')).toHaveCount(0)
})

test('without a share menu, Share offers WhatsApp with the message ready, and Copy link', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByTestId('share').click()

  const whatsapp = new URL((await page.getByTestId('share-whatsapp').getAttribute('href'))!)
  expect(`${whatsapp.origin}${whatsapp.pathname}`).toBe('https://wa.me/')
  expect(whatsapp.searchParams.get('text')).toBe(MESSAGE)

  await page.getByTestId('share-copy').click()
  await expect(page.getByTestId('share-copy')).toHaveText('Link copied!')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(GAME_URL)
  // Shown as text too, for when copying is not allowed.
  await expect(page.getByTestId('share-link')).toHaveText(GAME_URL)
})
