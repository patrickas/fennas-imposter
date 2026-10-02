import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Every test starts on a phone that already paid, so the free limit (2 rounds a day) never gets in
    // the way. paywall.spec.ts opts out to test the limit itself.
    storageState: {
      cookies: [],
      origins: [{
        origin: 'http://localhost:4173',
        localStorage: [{
          name: 'fennas-imposter:license',
          value: JSON.stringify({ secret: 0, unlocked: true, owner: false, day: '', used: 0 }),
        }],
      }],
    },
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // The service worker only exists in production builds, so e2e always runs against `vite preview`.
    command: 'bunx --bun vite build && bunx --bun vite preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
