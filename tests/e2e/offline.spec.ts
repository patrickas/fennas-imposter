import { expect, test } from '@playwright/test'
import { addPlayers, dealCards } from './helpers'

test('after one visit the whole game, fonts included, works with no network', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready // installed + precached
  })
  // Every self-hosted font file the stylesheets reference (Latin + Arabic, 3 weights).
  const fontUrls = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) =>
      [...sheet.cssRules]
        .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
        .flatMap((rule) =>
          [...rule.style.getPropertyValue('src').matchAll(/url\("?([^")]+\.woff2)"?\)/g)].map(
            (m) => new URL(m[1], sheet.href ?? location.href).href,
          ),
        ),
    ),
  )
  expect(fontUrls).toHaveLength(6)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('play')).toBeVisible()
  for (const url of fontUrls) {
    expect(await page.evaluate(async (u) => (await fetch(u)).ok, url), url).toBe(true)
  }
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 3)
  expect(deal.imposters).toHaveLength(1)
})

test('the production build ships a Content-Security-Policy that still allows https pack imports', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /default-src 'self'.*connect-src 'self' https:/,
  )
})

test('the web app manifest makes the game installable', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', theme_color: '#FFE14D' })
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
})
