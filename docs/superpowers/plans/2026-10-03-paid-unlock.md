# Paid Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free phone plays 2 rounds a day. The magic word Alex gives for the phone's secret word unlocks it for good. Alex's own phone, unlocked with the owner password, makes those magic words.

**Architecture:**
- **`src/data/license.ts`** holds all the paywall logic as plain functions, with no Vue: the key list, the formula, word matching, the daily count, and loading and saving the license. The license is stored under its own localStorage key.
- **`useApp.ts`** loads the license next to the main save. It adds a `'locked'` round blocker and counts dealt rounds.
- **The screens** are a new `/about` view, plus small changes to Home and Between rounds.

**Tech Stack:** Vue 3.5, vue-router 5 (hash history), TypeScript 6, Bun 1.4 (`bun test`), Playwright 1.63. Everything runs in podman containers.

**Spec:** `docs/superpowers/specs/2026-10-03-paid-unlock-design.md`. Read it before starting any task; "§" below refers to it.

## Global Constraints

- **Containers:** run every project command inside podman: `podman compose exec web …` for unit tests, lint and build, and `podman compose run --rm e2e …` for Playwright. Never run them on the Windows host. Never run `podman machine start|stop|restart`. If podman says the machine is down, stop and ask the user.
- **Bun only:** no `npm`, `npx` or `pnpm`. No new dependencies.
- **VCS is jj.** Commit with `jj commit -m "…"`, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Never push.**
- **No browser dialogs:** never use `alert`, `confirm` or `prompt`.
- **Line endings:** files are LF. After editing, check that `jj diff --stat` is about the size of your change.
- **Exact values, copied from the spec:**
  - `FREE_ROUNDS_PER_DAY = 2`
  - 256 key words: the first 256 English `SEED_WORDS`
  - `magicIndex(s) = (s * 167 + 89) % 256`
  - `OWNER_PASSWORD = 'wrong horse battery staple'`
  - license key `fennas-imposter:license`
  - help email `fennas.game@abisalloum.com`, subject `Fennass key`, body `My secret word: <word>`
- **Words:** secret and magic words are always shown in English, with `dir="ltr"`. All other new text has English and Arabic strings, and `i18n.test.ts` checks that both have the same keys. The Arabic strings below are drafts for the user to review.
- **Dev server:** the limit never blocks there (`devTools`). Production builds, including the e2e preview, apply it.
- **Small deviations from the spec, all deliberate:**
  - The About screen's secret word uses the test id `my-secret-word`, not the spec's `secret-word`, which the round card already uses (`tests/e2e/helpers.ts` reads it).
  - On a wrong word, the "That's not it" message shakes, not the text box. Shaking the box would mean re-creating the input, and on a phone that closes the keyboard.
  - The spec's single `paywall.spec.ts` is split in two: `about.spec.ts` (Task 3) and `paywall.spec.ts` (Task 4). Each task then ships with its own e2e test.

## Review Focus

These are the failure modes a family member is most likely to hit that the spec doesn't spell out. Each one has a test in the task named after it.

1. **The browser blocks storage (private tab).** The game must still open, About must still show a secret word, and the magic word must still unlock until the page reloads. *Task 2.*
2. **A reload in the middle of a round** must not count that round twice or give a free round back. *Task 2.*
3. **A magic word bought for a different phone** must not unlock this one. *Task 2.*
4. **The About screen in Arabic** must still show the English secret word, readable left to right, so the customer can read it out to Alex. *Task 3.*
5. **Phone keyboards** add a capital letter and a trailing space ("Camel "). That must still match. *Task 1 (`keyText`), Task 4 (e2e types an all-caps word).*

---

### Task 1: License module

**Files:**
- Modify: `src/data/limits.ts` (add one constant)
- Create: `src/data/license.ts`
- Test: `src/data/license.test.ts`

**Interfaces:**
- Consumes:
  - `SEED_WORDS` from `src/data/seed`
  - `normalizeText` from `src/data/normalize`
  - `STORAGE_KEY`, `StorageLike`, `memoryStorage` from `src/data/storage`
  - `randomInt`, `Rng`, `seededRng` from `src/engine/rng`
- Produces, for Tasks 2–4:
  - `LICENSE_KEY: string` (`'fennas-imposter:license'`)
  - `KEY_COUNT = 256`
  - `OWNER_PASSWORD: string`
  - `KEY_WORDS: readonly string[]`
  - `interface License { secret: number; unlocked: boolean; owner: boolean; day: string; used: number }`
  - `magicIndex(secret: number): number`
  - `magicWord(secret: number): string`
  - `keyText(s: string): string`
  - `findKeyIndex(input: string): number | null`
  - `isOwnerPassword(input: string): boolean`
  - `localDay(now: number): string`
  - `freeRoundsLeft(license: License, day: string): number`
  - `countRound(license: License, day: string): License`
  - `loadLicense(storage: StorageLike | null, rng: Rng): License`
  - `saveLicense(storage: StorageLike | null, license: License): boolean`
  - `FREE_ROUNDS_PER_DAY = 2` in `src/data/limits.ts`

- [ ] **Step 1: Add the limit constant**

Append to `src/data/limits.ts`:

```ts

/** Rounds a free (not unlocked) phone may deal per local calendar day (paid-unlock spec §2). */
export const FREE_ROUNDS_PER_DAY = 2
```

- [ ] **Step 2: Write the failing tests**

Create `src/data/license.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { seededRng } from '../engine/rng'
import { FREE_ROUNDS_PER_DAY } from './limits'
import { memoryStorage, type StorageLike } from './storage'
import {
  KEY_WORDS, LICENSE_KEY, countRound, findKeyIndex, freeRoundsLeft, isOwnerPassword, keyText, loadLicense, localDay,
  magicIndex, magicWord, saveLicense, type License,
} from './license'

const fresh: License = { secret: 3, unlocked: false, owner: false, day: '', used: 0 }

describe('key words', () => {
  it('are 256 different words, so a secret word Alex types finds exactly one entry', () => {
    expect(KEY_WORDS).toHaveLength(256)
    expect(new Set(KEY_WORDS.map(keyText)).size).toBe(256)
  })

  // Keys sold on one version only match phones on the same version. Changing the first 256 English
  // built-in words changes every key, so update these two lines only on purpose.
  it('are the first 256 English built-in words, in shipping order', () => {
    expect(KEY_WORDS[0]).toBe('Falafel')
    expect(KEY_WORDS[255]).toBe('Airport')
  })
})

describe('magic word', () => {
  it('is different for every secret word, so one bought key never unlocks a phone that did not pay', () => {
    const all = Array.from({ length: 256 }, (_, s) => magicIndex(s))
    expect(new Set(all).size).toBe(256)
    expect(all.every((m) => Number.isInteger(m) && m >= 0 && m < 256)).toBe(true)
  })

  it('is never the secret word itself, which the customer can read on their own screen', () => {
    for (let s = 0; s < 256; s++) expect(magicIndex(s)).not.toBe(s)
  })

  // Alex's phone and the customer's must work out the same key; changing the formula breaks every key already sold.
  it('comes from a fixed formula', () => {
    expect(magicIndex(0)).toBe(89)
    expect(magicIndex(1)).toBe(0)
    expect(magicIndex(255)).toBe(178)
    expect(magicWord(1)).toBe(KEY_WORDS[0])
  })
})

describe('typed words', () => {
  it('match however a phone keyboard capitalises or spaces them', () => {
    expect(keyText('Camel ')).toBe(keyText('camel'))
    expect(keyText('  ICE   cream ')).toBe(keyText('Ice cream'))
    expect(keyText('icecream')).toBe(keyText('Ice cream'))
  })

  it('findKeyIndex finds a key word typed any way, and nothing for other text', () => {
    expect(findKeyIndex(KEY_WORDS[5].toUpperCase())).toBe(5)
    expect(findKeyIndex(` ${KEY_WORDS[200]} `)).toBe(200)
    const multi = KEY_WORDS.findIndex((w) => /\s/.test(w))
    expect(multi).toBeGreaterThan(-1)
    expect(findKeyIndex(KEY_WORDS[multi].replace(/\s+/g, '').toLowerCase())).toBe(multi)
    expect(findKeyIndex('definitely not a word')).toBeNull()
    expect(findKeyIndex('')).toBeNull()
    expect(findKeyIndex('   ')).toBeNull()
  })

  it('accept the owner password in any capitals and spacing, and nothing shorter', () => {
    expect(isOwnerPassword('wrong horse battery staple')).toBe(true)
    expect(isOwnerPassword(' Wrong Horse  Battery STAPLE ')).toBe(true)
    expect(isOwnerPassword('wronghorsebatterystaple')).toBe(true)
    expect(isOwnerPassword('wrong horse')).toBe(false)
    expect(isOwnerPassword('')).toBe(false)
  })
})

describe('free rounds', () => {
  it('allow 2 rounds a day, then none, and start again the next day', () => {
    expect(FREE_ROUNDS_PER_DAY).toBe(2)
    let l = fresh
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(2)
    l = countRound(l, '2026-10-03')
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(1)
    l = countRound(l, '2026-10-03')
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(0)
    expect(freeRoundsLeft(l, '2026-10-04')).toBe(2)
    expect(countRound(l, '2026-10-04')).toMatchObject({ day: '2026-10-04', used: 1 })
  })

  it("follow the phone's own date, so the rounds come back at local midnight, not UTC midnight", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
    expect(localDay(new Date(2026, 0, 6, 0, 1).getTime())).toBe('2026-01-06')
  })
})

describe('saved license', () => {
  it('gets a secret word once and keeps it, so the word Alex was told never changes', () => {
    const storage = memoryStorage()
    const first = loadLicense(storage, seededRng(1))
    expect(first).toMatchObject({ unlocked: false, owner: false, day: '', used: 0 })
    expect(Number.isInteger(first.secret) && first.secret >= 0 && first.secret < 256).toBe(true)
    expect(JSON.parse(storage.dump()[LICENSE_KEY])).toEqual(first)
    expect(loadLicense(storage, seededRng(99))).toEqual(first)
  })

  it('replaces a damaged license with a new locked one', () => {
    const damaged = [
      '{oops',
      '[]',
      'null',
      JSON.stringify({ secret: 300, unlocked: true, owner: false, day: '', used: 0 }),
      JSON.stringify({ secret: 1, unlocked: 'yes', owner: false, day: '', used: 0 }),
    ]
    for (const raw of damaged) {
      expect(loadLicense(memoryStorage({ [LICENSE_KEY]: raw }), seededRng(1)).unlocked).toBe(false)
    }
  })

  it('keeps working in memory when storage is missing or refuses', () => {
    expect(loadLicense(null, seededRng(1)).unlocked).toBe(false)
    const blocked: StorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(loadLicense(blocked, seededRng(1)).unlocked).toBe(false)
    expect(saveLicense(blocked, fresh)).toBe(false)
    expect(saveLicense(null, fresh)).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `podman compose exec web bun test src/data/license.test.ts`
Expected: FAIL. The module `./license` cannot be found.

- [ ] **Step 4: Write the implementation**

Create `src/data/license.ts`:

```ts
import { randomInt, type Rng } from '../engine/rng'
import { FREE_ROUNDS_PER_DAY } from './limits'
import { normalizeText } from './normalize'
import { SEED_WORDS } from './seed'
import { STORAGE_KEY, type StorageLike } from './storage'

// Paid unlock (paid-unlock spec). This is not real protection: the recipe and the owner password ship in the code.

/** Kept apart from the main save, which is reset when damaged; a paying customer must not lose the unlock with it. */
export const LICENSE_KEY = `${STORAGE_KEY}:license`
export const KEY_COUNT = 256
export const OWNER_PASSWORD = 'wrong horse battery staple'

/**
 * The first 256 English built-in words, in shipping order. Derived, not frozen: keys only match
 * between phones running the same version of the packs.
 */
export const KEY_WORDS: readonly string[] = SEED_WORDS.flatMap((w) => (w.text.en ? [w.text.en] : [])).slice(0, KEY_COUNT)

export interface License {
  /** Index into KEY_WORDS, chosen once per phone. */
  secret: number
  unlocked: boolean
  owner: boolean
  /** Local date that `used` counts, 'YYYY-MM-DD'; '' before the first round. */
  day: string
  /** Rounds dealt on `day`. */
  used: number
}

/** 167 is odd, so every secret word gets its own magic word; 89 is odd, so 166·s + 89 is odd and no word is its own key. */
export function magicIndex(secret: number): number {
  return (secret * 167 + 89) % KEY_COUNT
}

export function magicWord(secret: number): string {
  return KEY_WORDS[magicIndex(secret)]
}

/** Comparison key for typed words: like normalizeText, but without spaces, so "icecream" matches "Ice cream". */
export function keyText(s: string): string {
  return normalizeText(s).replace(/\s+/g, '')
}

/** Position of a typed key word in KEY_WORDS, or null when it is not one. */
export function findKeyIndex(input: string): number | null {
  const typed = keyText(input)
  if (!typed) return null
  const index = KEY_WORDS.findIndex((w) => keyText(w) === typed)
  return index === -1 ? null : index
}

export function isOwnerPassword(input: string): boolean {
  return keyText(input) === keyText(OWNER_PASSWORD)
}

/** The phone's local date as 'YYYY-MM-DD': the free rounds come back at local midnight. */
export function localDay(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function freeRoundsLeft(license: License, day: string): number {
  return Math.max(0, FREE_ROUNDS_PER_DAY - (license.day === day ? license.used : 0))
}

export function countRound(license: License, day: string): License {
  return { ...license, day, used: (license.day === day ? license.used : 0) + 1 }
}

function isLicense(x: unknown): x is License {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const l = x as Record<string, unknown>
  return (
    typeof l.secret === 'number' && Number.isInteger(l.secret) && l.secret >= 0 && l.secret < KEY_COUNT &&
    typeof l.unlocked === 'boolean' &&
    typeof l.owner === 'boolean' &&
    typeof l.day === 'string' &&
    typeof l.used === 'number' && Number.isInteger(l.used) && l.used >= 0
  )
}

/** The saved license, or a new locked one, saved at once so the secret word never changes. Damaged counts as missing. */
export function loadLicense(storage: StorageLike | null, rng: Rng): License {
  try {
    const raw = storage?.getItem(LICENSE_KEY)
    if (raw) {
      const saved: unknown = JSON.parse(raw)
      if (isLicense(saved)) return saved
    }
  } catch {
    // Unreadable or damaged: same as missing.
  }
  const fresh: License = { secret: randomInt(rng, 0, KEY_COUNT - 1), unlocked: false, owner: false, day: '', used: 0 }
  saveLicense(storage, fresh)
  return fresh
}

/** False when it could not be saved; the license then lives in memory until the page reloads. */
export function saveLicense(storage: StorageLike | null, license: License): boolean {
  if (!storage) return false
  try {
    storage.setItem(LICENSE_KEY, JSON.stringify(license))
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `podman compose exec web bun test src/data/license.test.ts`
Expected: PASS, every test.

If `are the first 256 English built-in words` fails, the seed packs changed since the spec was written. Stop and report it; do not edit the expected words.

- [ ] **Step 6: Run the full unit suite, typecheck and lint**

Run: `podman compose exec web bun test`, then `podman compose exec web bun run typecheck`, then `podman compose exec web bun run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
jj commit -m "feat(data): paid-unlock license: key words, magic-word formula, daily free rounds, separate save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Free limit and unlock in the app store

**Files:**
- Modify: `src/composables/useApp.ts`
- Modify: `playwright.config.ts` (existing e2e specs start unlocked)
- Test: `src/composables/useApp.test.ts`

**Interfaces:**
- Consumes everything in Task 1's "Produces" list. Import it as `import * as lic from '../data/license'`.
- Produces, for Tasks 3–4. The `AppStore` gains:
  - `RoundBlocker` now includes `'locked'`
  - `isUnlocked: ComputedRef<boolean>`
  - `isOwner: ComputedRef<boolean>`
  - `secretWord: ComputedRef<string>` (English)
  - `freeRoundsLeft(): number`
  - `unlock(input: string): 'unlocked' | 'owner' | 'wrong'`
  - `makeKey(secretWordInput: string): string | null`
- In templates, read these as `app.isUnlocked.value` etc., the same way the views use `app.content.value`.

- [ ] **Step 1: Make the existing tests start unlocked**

The existing tests play many rounds and were written for an unlimited game.

In `src/composables/useApp.test.ts`:

1. Add this import right after the `../data/storage` import:

```ts
import { LICENSE_KEY } from '../data/license'
```

2. Add this helper right above `function setup(`:

```ts
/** A phone that already paid, so tests about the game itself never meet the free limit. */
function paidStorage(): StorageLike & { dump(): Record<string, string> } {
  return memoryStorage({ [LICENSE_KEY]: JSON.stringify({ secret: 0, unlocked: true, owner: false, day: '', used: 0 }) })
}
```

3. Replace **every** existing `memoryStorage()` in this file with `paidStorage()`, including the default parameter of `setup` (10 places). Do this before adding the new tests below, which use `memoryStorage()` on purpose.

Run: `podman compose exec web bun test src/composables/useApp.test.ts`
Expected: PASS. Nothing has changed in behaviour yet.

- [ ] **Step 2: Write the failing tests**

Change the license import from Step 1 to:

```ts
import { KEY_WORDS, LICENSE_KEY, magicWord } from '../data/license'
```

Then append to `src/composables/useApp.test.ts`:

```ts
describe('free version (paid-unlock spec)', () => {
  const EVENING = new Date(2026, 9, 3, 20, 0).getTime()
  const NEXT_MORNING = new Date(2026, 9, 4, 9, 0).getTime()

  function freeApp(storage: StorageLike | null = memoryStorage(), clock = { now: EVENING }, devTools = false): AppStore {
    let n = 0
    return createAppStore({ storage, rng: seededRng(1), now: () => clock.now, newId: () => `id${++n}`, devTools })
  }
  function storedLicense(storage: { dump(): Record<string, string> }) {
    return JSON.parse(storage.dump()[LICENSE_KEY])
  }
  function wrongMagicWord(app: AppStore): string {
    const mine = magicWord(KEY_WORDS.indexOf(app.secretWord.value))
    return KEY_WORDS.find((w) => w !== mine)!
  }

  it('plays 2 rounds a day, counting a round when it is dealt, then blocks until the next day', () => {
    const clock = { now: EVENING }
    const app = freeApp(memoryStorage(), clock)
    withPlayers(app)
    expect(app.freeRoundsLeft()).toBe(2)
    app.beginRound({ kind: 'random' })
    playOut(app)
    app.beginRound({ kind: 'random' })
    app.abandonRound() // the cards were dealt, so it counts
    expect(app.freeRoundsLeft()).toBe(0)
    expect(app.roundBlocker({ kind: 'random' })).toBe('locked')
    expect(app.roundBlocker({ kind: 'outsideGm' })).toBe('locked')
    expect(() => app.beginRound({ kind: 'random' })).toThrow(/locked/)
    clock.now = NEXT_MORNING
    expect(app.freeRoundsLeft()).toBe(2)
    expect(app.roundBlocker({ kind: 'random' })).toBeNull()
  })

  it('remembers the count after a reload, and a reload mid-round neither counts it again nor gives it back', () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    const reloaded = freeApp(storage)
    expect(reloaded.state.round).not.toBeNull()
    expect(reloaded.freeRoundsLeft()).toBe(1)
    playOut(reloaded)
    reloaded.beginRound({ kind: 'random' })
    playOut(reloaded)
    expect(freeApp(storage).roundBlocker({ kind: 'random' })).toBe('locked')
  })

  it('shows the other reasons first, since unlocking would not help a round that cannot start anyway', () => {
    const spent = JSON.stringify({ secret: 0, unlocked: false, owner: false, day: '2026-10-03', used: 2 })
    const app = freeApp(memoryStorage({ [LICENSE_KEY]: spent }))
    withPlayers(app, ['Rami', 'Lina'])
    expect(app.roundBlocker({ kind: 'random' })).toBe('needPlayers')
  })

  it('never blocks or counts on an unlocked phone', () => {
    const storage = paidStorage()
    const app = freeApp(storage)
    withPlayers(app)
    for (let i = 0; i < 4; i++) {
      expect(app.roundBlocker({ kind: 'random' })).toBeNull()
      app.beginRound({ kind: 'random' })
      playOut(app)
    }
    expect(storedLicense(storage)).toMatchObject({ day: '', used: 0 })
  })

  it('never blocks on the dev server, so the UI can be tried again and again', () => {
    const app = freeApp(memoryStorage(), { now: EVENING }, true)
    withPlayers(app)
    for (let i = 0; i < 3; i++) {
      expect(app.roundBlocker({ kind: 'random' })).toBeNull()
      app.beginRound({ kind: 'random' })
      playOut(app)
    }
  })

  it('keeps the unlock when the main save is damaged and reset', () => {
    const paid = JSON.stringify({ secret: 7, unlocked: true, owner: false, day: '', used: 0 })
    const app = freeApp(memoryStorage({ [STORAGE_KEY]: '{damaged', [LICENSE_KEY]: paid }))
    expect(app.meta.status).toBe('corrupt')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.secretWord.value).toBe(KEY_WORDS[7])
  })

  it("unlocks only with this phone's magic word, typed any way, and stays unlocked after a reload", () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    expect(app.unlock(app.secretWord.value)).toBe('wrong') // the word on the customer's own screen is not the key
    expect(app.unlock(wrongMagicWord(app))).toBe('wrong') // a key bought for a different phone
    expect(app.unlock('')).toBe('wrong')
    expect(app.isUnlocked.value).toBe(false)
    const magic = magicWord(KEY_WORDS.indexOf(app.secretWord.value))
    expect(app.unlock(`  ${magic.toUpperCase()} `)).toBe('unlocked')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.isOwner.value).toBe(false)
    const reloaded = freeApp(storage)
    expect(reloaded.isUnlocked.value).toBe(true)
    expect(reloaded.secretWord.value).toBe(app.secretWord.value)
  })

  it("the owner password makes the phone Alex's key maker", () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    expect(app.unlock('Wrong Horse Battery Staple')).toBe('owner')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.isOwner.value).toBe(true)
    expect(freeApp(storage).isOwner.value).toBe(true)
    expect(app.makeKey(KEY_WORDS[42].toLowerCase())).toBe(magicWord(42))
    expect(app.makeKey('not one of them')).toBeNull()
  })

  it('still shows a secret word and unlocks for the session when storage is blocked (private tab)', () => {
    const app = freeApp(null)
    expect(KEY_WORDS).toContain(app.secretWord.value)
    expect(app.unlock(magicWord(KEY_WORDS.indexOf(app.secretWord.value)))).toBe('unlocked')
    expect(app.isUnlocked.value).toBe(true)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `podman compose exec web bun test src/composables/useApp.test.ts`
Expected: the new `free version` tests FAIL, for example `app.freeRoundsLeft is not a function` or `Cannot read properties of undefined (reading 'value')`. The older tests still pass.

- [ ] **Step 4: Implement in `src/composables/useApp.ts`**

1. Imports: change `import { computed, reactive } from 'vue'` to `import { computed, reactive, ref } from 'vue'`, and add after the `storage` import:

```ts
import * as lic from '../data/license'
```

2. Change the blocker type:

```ts
export type RoundBlocker = 'needPlayers' | 'noWords' | 'noGm' | 'locked'
```

3. Right after the line `const testModeActive = computed(() => devTools && state.testMode !== false)`, add:

```ts

  // The paid unlock lives apart from the main save, so a reset game never loses it (paid-unlock spec §4).
  const license = ref(lic.loadLicense(deps.storage, deps.rng))
  const isUnlocked = computed(() => license.value.unlocked)
  const isOwner = computed(() => license.value.owner)
  const secretWord = computed(() => lic.KEY_WORDS[license.value.secret])

  function setLicense(next: lic.License): void {
    license.value = next
    lic.saveLicense(deps.storage, next)
  }

  function freeRoundsLeft(): number {
    return lic.freeRoundsLeft(license.value, lic.localDay(deps.now()))
  }
```

4. In `roundBlocker`, add just before its final `return null`:

```ts
    // Checked last: unlocking would not help a round that cannot start anyway. Never on the dev server.
    if (!devTools && !license.value.unlocked && freeRoundsLeft() === 0) return 'locked'
```

5. In `beginRound`, replace its final `persist()` (the one right after `state.round = startRound(…).round`) with:

```ts
    if (!license.value.unlocked) setLicense(lic.countRound(license.value, lic.localDay(deps.now())))
    persist()
```

6. Add these two functions right after `dismissNotice`:

```ts

  /** This phone's magic word unlocks it; the owner's password also makes it Alex's key maker. */
  function unlock(input: string): 'unlocked' | 'owner' | 'wrong' {
    if (lic.isOwnerPassword(input)) {
      setLicense({ ...license.value, unlocked: true, owner: true })
      return 'owner'
    }
    if (lic.findKeyIndex(input) !== lic.magicIndex(license.value.secret)) return 'wrong'
    setLicense({ ...license.value, unlocked: true })
    return 'unlocked'
  }

  /** Owner's phone: the magic word for a customer's secret word, or null when it is not one of the secret words. */
  function makeKey(secretWordInput: string): string | null {
    const index = lic.findKeyIndex(secretWordInput)
    return index === null ? null : lic.magicWord(index)
  }
```

7. In the returned object, add a line after `devTools, testModeActive, setTestMode,`:

```ts
    isUnlocked, isOwner, secretWord, freeRoundsLeft, unlock, makeKey,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `podman compose exec web bun test src/composables/useApp.test.ts`
Expected: PASS, every test, old and new.

- [ ] **Step 6: Start the existing e2e specs on an unlocked phone**

`playwright.config.ts` runs against the production preview, where the limit applies, and several specs play 3 or more rounds. In its `use` block, add `storageState` after `trace`:

```ts
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
```

- [ ] **Step 7: Run the full unit suite, typecheck and lint**

Run: `podman compose exec web bun test`, then `podman compose exec web bun run typecheck`, then `podman compose exec web bun run lint`
Expected: all pass.

`BetweenRounds.vue`'s `switch` already returns `null` by default, so `'locked'` needs no UI change to compile. Task 4 adds its message.

- [ ] **Step 8: Commit**

```bash
jj commit -m "feat: a free phone deals 2 rounds a day; its magic word or the owner password unlocks it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: About screen (unlock box, help link, Make a key)

**Files:**
- Create: `src/views/AboutView.vue`
- Modify: `src/router.ts`
- Modify: `src/views/HomeView.vue` (About button only)
- Modify: `src/styles/animations.css`
- Modify: `src/i18n/en.ts`, `src/i18n/ar.ts`
- Test: `tests/e2e/about.spec.ts`

**Interfaces:**
- Consumes, from Task 2: `app.isUnlocked`, `app.isOwner`, `app.secretWord`, `app.unlock(input)`, `app.makeKey(input)`.
- Consumes, from Task 1 (in the e2e test only): `KEY_WORDS`, `magicWord`, imported from `../../src/data/license`.
- Produces, for Task 4:
  - the route `/about`
  - Home button test id `nav-about`
  - About test ids: `my-secret-word`, `magic-input`, `unlock`, `unlock-wrong`, `unlocked`, `help-email`, `owner-tools`, `key-input`, `make-key`, `key-result`, `back`
  - CSS classes `anim-spin` and `anim-nope`

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/about.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { KEY_WORDS, magicWord } from '../../src/data/license'

// Alex sells the game face to face: About shows the phone's secret word, takes the magic word he
// gives for it, and on his own phone (after the owner password) works out magic words for others.
test.use({ storageState: { cookies: [], origins: [] } }) // a phone that has not paid

test('About shows the secret word, refuses a wrong word, and the right magic word unlocks the phone', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-about').click()
  const secret = (await page.getByTestId('my-secret-word').innerText()).trim()
  const index = KEY_WORDS.indexOf(secret)
  expect(index).toBeGreaterThanOrEqual(0)

  const help = await page.getByTestId('help-email').getAttribute('href')
  expect(help).toMatch(/^mailto:fennas\.game@abisalloum\.com\?/)
  expect(decodeURIComponent(help!)).toContain(`My secret word: ${secret}`)
  await expect(page.getByTestId('help-email')).toHaveText('Email us')

  await page.getByTestId('magic-input').fill(secret) // the word on the customer's own screen is not the key
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlock-wrong')).toHaveText("That's not it")

  await page.getByTestId('magic-input').fill(`${magicWord(index)} `)
  await page.getByTestId('magic-input').press('Enter')
  await expect(page.getByTestId('unlocked')).toBeVisible()
  await expect(page.getByTestId('magic-input')).toHaveCount(0)
  await expect(page.getByTestId('help-email')).toHaveCount(0)
  await expect(page.getByTestId('owner-tools')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('unlocked')).toBeVisible()
})

test("the owner password turns a phone into Alex's key maker", async ({ page }) => {
  await page.goto('/#/about')
  await page.getByTestId('magic-input').fill('Wrong Horse Battery Staple')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlocked')).toBeVisible()
  await page.getByTestId('key-input').fill(KEY_WORDS[42].toLowerCase())
  await page.getByTestId('make-key').click()
  await expect(page.getByTestId('key-result')).toHaveText(magicWord(42))
  await page.getByTestId('key-input').fill('not a secret word')
  await page.getByTestId('make-key').click()
  await expect(page.getByTestId('key-result')).toHaveText("That's not one of the secret words")
  await page.reload()
  await expect(page.getByTestId('owner-tools')).toBeVisible()
})

test('in Arabic, the secret word is still the English word, laid out left to right', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await page.getByTestId('nav-about').click()
  const word = page.getByTestId('my-secret-word')
  await expect(word).toHaveAttribute('dir', 'ltr')
  expect(KEY_WORDS).toContain((await word.innerText()).trim())
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `podman compose run --rm e2e sh -c "bun install && bun run test:e2e tests/e2e/about.spec.ts"`
Expected: FAIL. The tests time out waiting for `nav-about`, or for `magic-input` on `/#/about` (that route redirects home).

- [ ] **Step 3: Add the strings**

In `src/i18n/en.ts`:

1. After `'home.abandon': 'Abandon',` add:

```ts
  'home.about': 'About',
```

2. After `'data.problems': 'The file has problems:',` add:

```ts

  'about.title': 'About',
  'about.free': 'Free version: 2 rounds a day. Ask Alex for the magic word to unlock the game.',
  'about.secretWord': 'Your secret word:',
  'about.magicWord': 'Magic word',
  'about.unlock': 'Unlock',
  'about.wrong': "That's not it",
  'about.unlocked': 'Unlocked! Thanks for supporting Alex.',
  'about.help': 'Trouble getting a key?',
  'about.helpLink': 'Email us',
  'about.makeKey': 'Make a key',
  'about.theirWord': 'Their secret word',
  'about.makeKeyButton': 'Make key',
  'about.notAWord': "That's not one of the secret words",
```

In `src/i18n/ar.ts` (drafts; the user reviews the Arabic):

1. After `'home.abandon': 'الغي',` add:

```ts
  'home.about': 'عن اللعبة',
```

2. After `'data.problems': 'في مشاكل بالملف:',` add:

```ts

  'about.title': 'عن اللعبة',
  'about.free': 'النسخة المجانية: جولتين باليوم. اطلب من أليكس الكلمة السحرية لتفتح اللعبة.',
  'about.secretWord': 'كلمتك السرّية:',
  'about.magicWord': 'الكلمة السحرية',
  'about.unlock': 'افتح',
  'about.wrong': 'لأ، مش هي',
  'about.unlocked': 'انفتحت! شكراً لأنك دعمت أليكس.',
  'about.help': 'في مشكلة بالمفتاح؟',
  'about.helpLink': 'ابعتلنا إيميل',
  'about.makeKey': 'اعمل مفتاح',
  'about.theirWord': 'الكلمة السرّية تبعهم',
  'about.makeKeyButton': 'اعمل المفتاح',
  'about.notAWord': 'هيدي مش وحدة من الكلمات السرّية',
```

- [ ] **Step 4: Add the two animations**

In `src/styles/animations.css`:

1. After the `confetti-fall` keyframes line, add:

```css
@keyframes spin { to { transform: rotate(360deg); } }
/* Sideways only, a few pixels: the screen clips anything wider. */
@keyframes nope { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
```

2. After `.anim-squish { … }`, add:

```css
.anim-spin { animation: spin 8s linear infinite; }
.anim-nope { animation: nope 150ms ease-in-out 2; }
```

3. In the `@media (prefers-reduced-motion: reduce)` block, change `.anim-loop { animation: none !important; }` to:

```css
  .anim-loop, .anim-nope { animation: none !important; }
```

- [ ] **Step 5: Create the view**

Create `src/views/AboutView.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'

const HELP_EMAIL = 'fennas.game@abisalloum.com'

const app = useApp()
const router = useRouter()

const magic = ref('')
/** Counts wrong tries; keying the message on it replays the shake every time. */
const wrongTries = ref(0)

function tryUnlock(): void {
  if (app.unlock(magic.value) === 'wrong') wrongTries.value++
}

const theirWord = ref('')
const keyResult = ref<{ word: string | null } | null>(null)

function makeKey(): void {
  keyResult.value = { word: app.makeKey(theirWord.value) }
}

// English on purpose: it lands in Alex's inbox, and the secret word is English anyway.
const helpLink = computed(() => {
  const subject = encodeURIComponent('Fennass key')
  const body = encodeURIComponent(`My secret word: ${app.secretWord.value}`)
  return `mailto:${HELP_EMAIL}?subject=${subject}&body=${body}`
})
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('about.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <img src="/pwa-512x512.png" alt="" class="face anim-loop anim-spin" data-testid="about-face">

    <template v-if="!app.isUnlocked.value">
      <p class="guide">{{ app.t('about.free') }}</p>
      <section class="panel stack">
        <p class="label">{{ app.t('about.secretWord') }}</p>
        <p class="big" dir="ltr" data-testid="my-secret-word">{{ app.secretWord.value }}</p>
        <form class="stack" @submit.prevent="tryUnlock">
          <label class="field">
            {{ app.t('about.magicWord') }}
            <input
              v-model="magic"
              type="text"
              dir="ltr"
              class="input"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              data-testid="magic-input"
            >
          </label>
          <p v-if="wrongTries > 0" :key="wrongTries" class="error-text anim-nope" role="alert" data-testid="unlock-wrong">
            {{ app.t('about.wrong') }}
          </p>
          <PopButton type="submit" data-testid="unlock">{{ app.t('about.unlock') }}</PopButton>
        </form>
      </section>
      <p class="guide">
        {{ app.t('about.help') }}
        <a :href="helpLink" data-testid="help-email">{{ app.t('about.helpLink') }}</a>
      </p>
    </template>
    <p v-else class="guide" role="status" data-testid="unlocked">{{ app.t('about.unlocked') }}</p>

    <section v-if="app.isOwner.value" class="panel stack" data-testid="owner-tools">
      <h2>{{ app.t('about.makeKey') }}</h2>
      <form class="stack" @submit.prevent="makeKey">
        <label class="field">
          {{ app.t('about.theirWord') }}
          <input
            v-model="theirWord"
            type="text"
            dir="ltr"
            class="input"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            data-testid="key-input"
          >
        </label>
        <PopButton type="submit" variant="secondary" data-testid="make-key">{{ app.t('about.makeKeyButton') }}</PopButton>
      </form>
      <p v-if="keyResult" :class="keyResult.word ? 'big' : 'error-text'" dir="ltr" data-testid="key-result">
        {{ keyResult.word ?? app.t('about.notAWord') }}
      </p>
    </section>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
h2 { font-size: 1.3rem; }
.face { align-self: center; width: min(50vw, 200px); height: auto; }
.label { font-weight: 700; text-align: center; }
.big { color: var(--grape); font-size: clamp(1.8rem, 9vw, 2.6rem); font-weight: 800; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
a { color: var(--grape); font-weight: 800; }
</style>
```

Notes:
- `dir="ltr"` on `key-result` is harmless for the Arabic "not a word" message: a whole sentence in one script still reads correctly.
- `/pwa-512x512.png` is the splash's image (`index.html`). It is precached by the service worker and allowed by the CSP (`img-src 'self'`).

- [ ] **Step 6: Add the route**

In `src/router.ts`, add `import AboutView from './views/AboutView.vue'` after the `DataView` import. Then add this route right before the catch-all `{ path: '/:pathMatch(.*)*', … }`:

```ts
    { path: '/about', name: 'about', component: AboutView },
```

- [ ] **Step 7: Add the About button to Home**

In `src/views/HomeView.vue`, after the `nav-data` button, add:

```vue
      <PopButton variant="secondary" data-testid="nav-about" @click="router.push('/about')">{{ app.t('home.about') }}</PopButton>
```

- [ ] **Step 8: Run the e2e test to verify it passes**

Run: `podman compose run --rm e2e sh -c "bun install && bun run test:e2e tests/e2e/about.spec.ts"`
Expected: 3 passed.

If the import from `../../src/data/license` fails under Playwright, report the error rather than duplicating the key list in the test. A duplicated list can't catch the app and the test disagreeing.

- [ ] **Step 9: Run the unit suite, typecheck and lint**

Run: `podman compose exec web bun test`, then `podman compose exec web bun run typecheck`, then `podman compose exec web bun run lint`
Expected: all pass. `i18n.test.ts` confirms that the Arabic and English keys match.

`typecheck` also runs `tsconfig.node.json`, which now type-checks `src/data/license.ts` and its imports through the e2e spec. If that fails, report it.

- [ ] **Step 10: Commit**

```bash
jj commit -m "feat(ui): About screen: Alex's spinning face, the secret word, the unlock box, a help email and Make a key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Free-round count on Home and the lock between rounds

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `src/components/phases/BetweenRounds.vue`
- Modify: `src/i18n/en.ts`, `src/i18n/ar.ts`
- Test: `tests/e2e/paywall.spec.ts`

**Interfaces:**
- Consumes, from Task 2: `app.isUnlocked`, `app.freeRoundsLeft()`, and the `'locked'` value of `app.roundBlocker()`.
- Consumes, from Task 3: the `/about` route and the test ids `my-secret-word`, `magic-input`, `unlock`, `unlocked`, `back`.
- Consumes, in e2e: `addPlayers`, `dealCards`, `startGame`, `startPlaying` from `tests/e2e/helpers.ts`.
- Produces: the test ids `free-rounds` (Home) and `go-unlock` (Between rounds). The existing `round-blocker` shows the locked message.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/paywall.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { KEY_WORDS, magicWord } from '../../src/data/license'
import { addPlayers, dealCards, startGame, startPlaying } from './helpers'

// A free phone plays 2 rounds a day; after that, between rounds, the only way on is to unlock.
test.use({ storageState: { cookies: [], origins: [] } }) // a phone that has not paid

const PLAYERS = ['Rami', 'Lina', 'Omar']

async function playRound(page: Page): Promise<void> {
  await page.getByTestId('start-round').click()
  await dealCards(page, PLAYERS.length)
  await startPlaying(page)
  await page.getByTestId('end-discussion').click()
  await page.getByTestId('next-round').click()
  await expect(page.getByTestId('between-rounds')).toBeVisible()
}

test('a free phone plays 2 rounds, then must unlock; the magic word lets the game go on', async ({ page }) => {
  test.slow() // two full deals
  await page.goto('/')
  await expect(page.getByTestId('free-rounds')).toHaveText('2 free rounds left today')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await playRound(page)
  await playRound(page)

  await expect(page.getByTestId('round-blocker')).toHaveText('No free rounds left today.')
  await expect(page.getByTestId('start-round')).toHaveCount(0)
  await page.getByTestId('go-unlock').click()

  const secret = (await page.getByTestId('my-secret-word').innerText()).trim()
  await page.getByTestId('magic-input').fill(magicWord(KEY_WORDS.indexOf(secret)).toUpperCase())
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('unlocked')).toBeVisible()

  await page.getByTestId('back').click()
  await expect(page.getByTestId('free-rounds')).toHaveCount(0)
  await page.getByTestId('play').click()
  await expect(page.getByTestId('between-rounds')).toContainText('Round 3')
  await expect(page.getByTestId('start-round')).toBeEnabled()
})

test('Home counts down the free rounds as they are dealt', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await startGame(page)
  await page.getByTestId('start-round').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
  await page.getByTestId('leave-round').click()
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByTestId('free-rounds')).toHaveText('1 free round left today')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `podman compose run --rm e2e sh -c "bun install && bun run test:e2e tests/e2e/paywall.spec.ts"`
Expected: FAIL. The test times out waiting for `free-rounds`.

- [ ] **Step 3: Add the strings**

In `src/i18n/en.ts`:

1. After `'home.about': 'About',` add:

```ts
  'home.freeRounds': { one: '{count} free round left today', other: '{count} free rounds left today' },
```

2. After `'play.hideStats': 'Hide stats',` add:

```ts
  'play.locked': 'No free rounds left today.',
  'play.unlock': 'Unlock',
```

In `src/i18n/ar.ts` (drafts):

1. After `'home.about': 'عن اللعبة',` add:

```ts
  'home.freeRounds': {
    zero: 'ما باقي ولا جولة مجانية اليوم',
    one: 'باقي جولة مجانية وحدة اليوم',
    two: 'باقي جولتين مجانيات اليوم',
    few: 'باقي {count} جولات مجانية اليوم',
    many: 'باقي {count} جولة مجانية اليوم',
    other: 'باقي {count} جولة مجانية اليوم',
  },
```

2. After `'play.hideStats': 'خبّوا الإحصائيات',` add:

```ts
  'play.locked': 'خلصت الجولات المجانية لليوم.',
  'play.unlock': 'افتح اللعبة',
```

- [ ] **Step 4: Show the count on Home**

In `src/views/HomeView.vue`, right after `<p class="guide">{{ app.t('app.tagline') }}</p>`, add:

```vue
    <p v-if="!app.isUnlocked.value" class="guide" data-testid="free-rounds">
      {{ app.t('home.freeRounds', { count: app.freeRoundsLeft() }) }}
    </p>
```

- [ ] **Step 5: Lock the Start button between rounds**

In `src/components/phases/BetweenRounds.vue`:

1. In the `blockerText` switch, add a case before `default:`:

```ts
    case 'locked':
      return app.t('play.locked')
```

2. Replace the `start-round` button:

```vue
      <PopButton attention :disabled="blocker !== null" data-testid="start-round" @click="start">
        {{ app.t('play.startRound') }}
      </PopButton>
```

with:

```vue
      <PopButton v-if="blocker === 'locked'" attention data-testid="go-unlock" @click="router.push('/about')">
        {{ app.t('play.unlock') }}
      </PopButton>
      <PopButton v-else attention :disabled="blocker !== null" data-testid="start-round" @click="start">
        {{ app.t('play.startRound') }}
      </PopButton>
```

- [ ] **Step 6: Run the e2e test to verify it passes**

Run: `podman compose run --rm e2e sh -c "bun install && bun run test:e2e tests/e2e/paywall.spec.ts"`
Expected: 2 passed.

- [ ] **Step 7: Full verification**

Run, in order:
1. `podman compose exec web bun test`
2. `podman compose exec web bun run lint`
3. `podman compose exec web bun run build` (typecheck and production build)
4. `podman compose run --rm e2e`, the whole e2e suite. It checks that the `storageState` from Task 2 keeps the older specs unlocked.

Expected: all pass, with nothing skipped. Report the exact counts.

- [ ] **Step 8: Commit**

```bash
jj commit -m "feat(ui): Home shows the free rounds left today; between rounds, a spent phone gets Unlock instead of Start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
