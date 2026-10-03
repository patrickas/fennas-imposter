import { defineConfig, devices } from '@playwright/test'
import { phoneState } from './tests/e2e/phone-state'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // A paid phone with the tap guard off (see phone-state.ts); specs that test those opt out.
    storageState: phoneState({ paid: true }),
    // Skips the splash turn and screen animations. Specs that check motion itself opt out.
    reducedMotion: 'reduce',
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
