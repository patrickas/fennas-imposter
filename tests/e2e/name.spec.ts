import { expect, test } from '@playwright/test'

// The name comes from فنّاص (Levantine for liar/bluffer) — spelled with ص (sad), not س (seen).

test('the game is called "Fennass, Imposter" in English and «فنّاص» (with ص) in Arabic', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Fennass, Imposter')
  await expect(page).toHaveTitle('Fennass, Imposter')
  await page.getByTestId('lang-ar').click()
  await expect(page.locator('h1')).toHaveText('فنّاص')
  await expect(page).toHaveTitle('فنّاص')
})

test('the installed app carries the same name', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Fennass, Imposter — فنّاص', short_name: 'Fennass' })
})
