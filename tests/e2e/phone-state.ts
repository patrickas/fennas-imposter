/**
 * What a test phone has in localStorage when its page first opens (Playwright `storageState`).
 * playwright.config.ts gives every test a paid phone with the tap guard switched off; a spec that
 * needs otherwise opts out with `test.use({ storageState: phoneState({ … }) })`.
 */
export function phoneState(opts: { paid: boolean; realTapGuard?: boolean }) {
  const localStorage: { name: string; value: string }[] = []
  if (opts.paid) {
    // Already unlocked, so the free limit (2 rounds a day) never gets in the way.
    localStorage.push({
      name: 'fennas-imposter:license',
      value: JSON.stringify({ secret: 0, unlocked: true, owner: false, day: '', used: 0 }),
    })
  }
  if (!opts.realTapGuard) {
    // Screens ignore taps for their first 0.5 s (Screen.vue); a test taps once, so it need not wait.
    localStorage.push({ name: 'fennas-imposter:armDelayMs', value: '0' })
  }
  return { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage }] }
}
