import { expect, test } from '@playwright/test'

test('the "saved by a newer version" notice stays up, because nothing is being saved', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('fennas-imposter', JSON.stringify({ version: 99 })))
  await page.reload()
  const banner = page.getByTestId('status-banner')
  await expect(banner).toContainText('newer version')
  await expect(banner.getByRole('button')).toHaveCount(0)
})
