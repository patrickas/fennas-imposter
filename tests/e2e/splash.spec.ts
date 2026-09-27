import { expect, test, type Page } from '@playwright/test'

// Every load — launching the installed app or refreshing the page — opens on the game icon: still
// for 500 ms, then one full clockwise turn in 1 s, and only then the game.

interface SplashLog {
  seen: boolean
  goneAt: number
  maxTurn: number
}

/** Watches the splash frame by frame from before the page's own scripts run: when it went, and how far its icon turned. */
async function watchSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: SplashLog = { seen: false, goneAt: 0, maxTurn: 0 }
    Object.assign(window, { splashLog: log })
    const watch = (): void => {
      const icon = document.querySelector('[data-testid="splash-icon"]')
      if (icon) {
        log.seen = true
        const m = new DOMMatrix(getComputedStyle(icon).transform)
        log.maxTurn = Math.max(log.maxTurn, Math.abs((Math.atan2(m.b, m.a) * 180) / Math.PI))
      } else if (log.seen) {
        log.goneAt = performance.now()
        return
      }
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
}

const splashLog = (page: Page): Promise<SplashLog> =>
  page.evaluate(() => (window as unknown as { splashLog: SplashLog }).splashLog)

/**
 * The icon's clockwise rotation, in degrees, over time windows of the splash (ms from its start).
 * Seeks the running animation in 10 ms steps, so it is exact and independent of frame timing.
 */
async function turnsBetween(page: Page, windows: readonly [number, number][]): Promise<number[]> {
  return page.getByTestId('splash-icon').evaluate((icon, windows) => {
    const [spin] = icon.getAnimations()
    if (!spin) return windows.map(() => 0)
    spin.pause()
    const angleAt = (ms: number): number => {
      spin.currentTime = ms
      const m = new DOMMatrix(getComputedStyle(icon).transform)
      return (Math.atan2(m.b, m.a) * 180) / Math.PI
    }
    return windows.map(([from, to]) => {
      let total = 0
      for (let t = from; t < to; t += 10) total += ((angleAt(t + 10) - angleAt(t) + 540) % 360) - 180
      return Math.round(total)
    })
  }, windows)
}

test('every load, refresh included, opens on the icon: still for 500 ms, then exactly one turn in 1 s', async ({ page }) => {
  for (const load of [() => page.goto('/'), () => page.reload()]) {
    await load()
    await expect(page.getByTestId('splash-icon')).toBeVisible()
    // still → one full turn → nothing more
    expect(await turnsBetween(page, [[0, 500], [500, 1500], [1500, 2500]])).toEqual([0, 360, 0])
  }
})

test('the game takes over right after the turn, not before', async ({ page }) => {
  await watchSplash(page)
  await page.goto('/')
  await expect.poll(async () => (await splashLog(page)).goneAt).toBeGreaterThan(0)
  const { goneAt } = await splashLog(page)
  expect(goneAt).toBeGreaterThanOrEqual(1500) // 500 ms still + 1 s turn, counted from the start of the page load
  expect(goneAt).toBeLessThan(2500) // and no lingering once the turn is done
  await page.getByTestId('play').click()
  await expect(page.getByTestId('setup-done')).toBeVisible()
})

test('with reduced motion the icon never turns and the game shows as soon as it is ready', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await watchSplash(page)
  await page.goto('/')
  await expect(page.getByTestId('splash')).toHaveCount(0)
  const { goneAt, maxTurn } = await splashLog(page)
  expect(maxTurn).toBe(0)
  expect(goneAt).toBeLessThan(1500) // not held for the 1.5 s the turn would take
})
