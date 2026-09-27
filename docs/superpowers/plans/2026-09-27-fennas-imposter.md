# Fenna's Imposter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, installable, bilingual (English / Levantine Arabic) pass-and-play "imposter" party game as a Vue 3 PWA.

**Architecture:** There are three layers with downward-only dependencies:
1. **`src/engine/`** — a pure TypeScript game engine: a deterministic round state machine with an injected RNG.
2. **`src/data/` + `src/composables/useApp.ts`** — the data/app layer: seed packs, localStorage persistence, import/export, and one reactive store.
3. **Vue SFC views** — they render store state and dispatch actions.

A service worker precaches the whole build, so the app runs offline after the first visit.

**Tech Stack:**
- **Toolchain:** Bun 1.4.2 is the package manager, script runner and unit-test runner. Node is used only where a tool cannot run on Bun.
- **App:** Vue 3.5, vue-router 5 (hash history), Vite 8, TypeScript 6.0, vite-plugin-pwa 1.3 (Workbox), @fontsource Baloo Bhaijaan 2.
- **Testing and linting:** `bun test`, Playwright 1.63, ESLint 10.
- Everything runs in podman containers.

**Spec:** `docs/superpowers/specs/2026-09-27-fennas-imposter-design.md`. Read it before starting any task; section numbers (§) below refer to it.

## Global Constraints

**Toolchain: Bun first**
- **Bun 1.4.2** (the user requires Bun ≥ 1.4 over Node wherever possible) does install (`bun install`, lockfile `bun.lock`), scripts (`bun run …`) and unit tests (`bun test`). Vite, ESLint and the icon generator run on the Bun runtime via `bunx --bun`.
- **Node 24 runs only two tools**, which don't work on Bun. Both were verified in a dry run on 2026-09-27:
  - `vue-tsc`: on the Bun runtime it cannot resolve `.vue` imports.
  - Playwright's test runner: Playwright does not support Bun as its runtime.
- **Containers:**
  - `containers/web.Containerfile` is `node:24` with the Bun binary copied in.
  - `containers/e2e.Containerfile` is `mcr.microsoft.com/playwright:v1.63.0-noble` (must match `@playwright/test`) with Bun copied in.
  - Never install pnpm or npm packages globally, and never use `npm`/`pnpm`/`npx` in this project.
- **Run project commands inside the `web` container**, e.g. `podman compose exec web bun run <script>`. Never run them on the Windows host.
- **Podman machine:** never run `podman machine start|stop|restart`. If podman reports the machine is down, stop and ask the user to start it.

**Pinned versions** (exact)

| Package | Version |
|---|---|
| `vue` | `3.5.43` |
| `vue-router` | `5.3.1` |
| `@fontsource/baloo-bhaijaan-2` | `5.3.0` |
| `vite` | `8.3.1` |
| `@vitejs/plugin-vue` | `6.0.9` |
| `@types/bun` | `1.4.2` |
| `@types/node` | `24.19.0` |
| `@playwright/test` | `1.63.0` |
| `vue-tsc` | `3.3.11` |
| `@vue/tsconfig` | `0.9.1` |
| `eslint` | `10.11.0` |
| `eslint-plugin-vue` | `10.11.1` |
| `@vue/eslint-config-typescript` | `14.9.0` |
| `vite-plugin-pwa` | `1.3.0` |
| `workbox-window` | `7.4.1` |
| `@vite-pwa/assets-generator` | `1.0.4` |
| `typescript` | `~6.0.3` |

- `typescript` must stay at `~6.0.3`: typescript-eslint requires `<6.1.0`, and TS 7 is a different, native toolchain.
- `@vite-pwa/assets-generator` stays on 1.x because vite-plugin-pwa's peer range is `^1.0.0`.

**Dependencies not allowed:** no Pinia, no vue-i18n, no animation library, no UI kit, no Vitest (`bun test` is the unit runner). Runtime dependencies are only `vue`, `vue-router` and `@fontsource/baloo-bhaijaan-2`.

**Architecture and code rules**
- **`src/engine/` is pure.** It never imports from `vue`, the DOM, `src/data`, `Date.now()` or `Math.random()`. Time and randomness come in as parameters.
- **Unit tests** import from `'bun:test'` and live next to the code as `src/**/*.test.ts`. `bunfig.toml` sets `root = "./src"` so `bun test` never picks up `tests/e2e`. Test files are type-checked through `tsconfig.test.json` (Bun types); app code never sees Bun types.
- **`v-html` is never used anywhere.** All user and imported text goes through `{{ }}` interpolation.
- **CSS** uses logical properties only: `margin-inline-*`, `padding-inline-*`, `inset-inline-*`, `text-align: start|end`. Never `left`/`right`.
- **Animation:**
  - Only `transform` and `opacity` are animated.
  - Every looping animation carries the class `anim-loop`.
  - `prefers-reduced-motion: reduce` stops loops and hides confetti.
  - Whole-screen transitions move vertically only: no scale or rotation. Even an easing overshoot on a scale overflows the viewport sideways.
- **Imports:** type-only imports use `import type` (`verbatimModuleSyntax` is on).
- **Line endings:** all new files use LF.

**Game and data rules (from the spec)**
- **Language:** one language per round. The language switch is not rendered while `state.round !== null`.
- **Numbers** use Western digits in Arabic via locale `ar-u-nu-latn`.
- **Text limits**, counted in code points after trim and whitespace-collapse:

  | Field | Max characters |
  |---|---|
  | Player name | 20 |
  | Word | 40 |
  | Hint | 40 |
  | Category name | 30 |

- **Round sizes:** `MIN_PARTICIPANTS = 3`, and `maxImposters(n) = max(0, floor((n - 1) / 2))`.
- **Scoring:** crew win = each crew member +1; imposter win = each imposter +2; the GM never scores.
- **Storage:** key `fennas-imposter`, document `version: 1`.
- **Pack files:** `format: "fennas-imposter"`, `version: 1`, max `1_000_000` bytes. URL import is `https://` only with a 15 s timeout.

**Version control**
- VCS is **jj**. Commit with `jj commit -m "<message>"`. **Never push**; the user pushes.
- Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

These are inputs the spec implies but its happy paths don't exercise. Each one has a test in the owning task.

1. **Names that differ only by case, spacing or Arabic spelling** ("Rami" vs " rami ", "أحمد" vs "احمد") must be rejected as taken, or the players can't tell each other apart. Tested in Task 11 (unit) and Task 16 (e2e).
2. **Latin names inside Arabic sentences (and the reverse)** must not scramble the sentence. Interpolated strings are wrapped in Unicode isolates (FSI…PDI, the plain-text form of `<bdi>`). Tested in Task 8.
3. **Removing a player who is dealt into the in-progress round** must be refused with a message, and the round must still complete. Tested in Task 14.
4. **Deleting a custom word or category that the running round uses** must not change that round, because it holds a snapshot. The next random round must never pick the deleted word. Tested in Task 14.
5. **Maximum-length words (40 chars, unbroken) and names (20 chars) on a 360 px-wide phone** must wrap, with no horizontal scroll, including during screen transitions. Tested in Task 19 (e2e).

## Plan Verification (already done)

On 2026-09-27, every code block in this plan was extracted into a scratch project and run in the containers described below. The results:

| Check | Result |
|---|---|
| `bun test` | 149 passed |
| `vue-tsc` | clean |
| `eslint` | clean |
| icon generation | 6 icons |
| `vite build` | PWA precache of 25 entries, including all 6 font files |
| Playwright | 18/18 passed, and 36/36 with every test run twice (no flakes) |
| Vite dev server on the Bun runtime | starts and serves |

Three problems found in that dry run are already fixed in the tasks below:
- the `workbox-window` dependency (Task 21)
- the fetch type under Bun's typings (Task 13)
- the screen-transition overflow (Task 15)

If a step deviates from its stated "Expected" output, treat it as a real finding. Investigate it; don't paper over it.

## File Map

```
compose.yaml                     podman services: web (dev server), e2e (Playwright)
containers/web.Containerfile     node:24 + Bun (Node only for vue-tsc)
containers/e2e.Containerfile     Playwright image + Bun (Node only for Playwright's runner)
package.json / bun.lock          scripts + pinned deps
bunfig.toml                      bun test root = ./src
tsconfig.json                    editor entry (references app + test + node)
tsconfig.app.json                src/ type-check (excludes *.test.ts)
tsconfig.test.json               src/**/*.test.ts with Bun types
tsconfig.node.json               vite/playwright configs + tests/e2e
vite.config.ts                   Vue plugin, dev server polling, PWA, CSP meta
eslint.config.js                 flat config (vue essential + TS)
playwright.config.ts             e2e against production preview
pwa-assets.config.mjs            icon generation config
index.html
public/                          icon.svg, generated PNG icons, favicon.ico, CNAME
.github/workflows/deploy.yml     GitHub Pages deploy
src/
  main.ts  App.vue  router.ts  env.d.ts
  engine/   types.ts rng.ts words.ts assign.ts round.ts scoring.ts   (+ *.test.ts)
  data/     limits.ts normalize.ts storage.ts roster.ts content.ts transfer.ts (+ *.test.ts)
  data/seed/ types.ts index.ts seed.test.ts packs/{food,animals,home,jobs,places,sports,nature,transport,clothes,levant}.ts
  i18n/     en.ts ar.ts index.ts i18n.test.ts
  composables/ useApp.ts useApp.test.ts useTimer.ts useTimer.test.ts useWakeLock.ts useSound.ts usePwaUpdate.ts
  styles/   tokens.css base.css animations.css
  components/ui/     Screen.vue BgShapes.vue PopButton.vue StickerCard.vue Chip.vue Toggle.vue Stepper.vue Confetti.vue LanguageSwitch.vue StatusBanner.vue UpdatePrompt.vue
  components/phases/ BetweenRounds.vue GmEntry.vue RevealStep.vue Discussion.vue VoteStep.vue GuessStep.vue ResultStep.vue Scoreboard.vue
  views/    HomeView.vue SetupView.vue PlayView.vue WordsView.vue DataView.vue
tests/e2e/  helpers.ts setup.spec.ts round.spec.ts gm.spec.ts data.spec.ts offline.spec.ts
README.md
```

---

### Task 1: Project scaffold and dev containers

**Files:**
- Modify: `.gitignore`
- Create:
  - Containers: `containers/web.Containerfile`, `containers/e2e.Containerfile`, `compose.yaml`
  - Package and config: `package.json`, `bunfig.toml`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.test.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`
  - App entry: `index.html`, `src/env.d.ts`, `src/main.ts`, `src/App.vue`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Scripts `dev`, `typecheck`, `build`, `preview`, `test`, `test:e2e`, `lint`.
  - `bun test` picks up `src/**/*.test.ts`.
  - Container service names `web` and `e2e`.

- [ ] **Step 1: Extend `.gitignore`** (jj snapshots every untracked file, so this must happen before installing)

```gitignore
.superpowers/
node_modules/
dist/
dev-dist/
test-results/
playwright-report/
*.tsbuildinfo
```

- [ ] **Step 2: Create the container definitions**

`containers/web.Containerfile`:
```dockerfile
# Bun runs everything; Node is only here for vue-tsc, which cannot resolve .vue files on the Bun runtime.
FROM docker.io/library/node:24
COPY --from=docker.io/oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
```

`containers/e2e.Containerfile`:
```dockerfile
# Playwright's test runner needs Node (it does not support Bun as its runtime); everything else uses Bun.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
COPY --from=docker.io/oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
```

`compose.yaml`:
```yaml
services:
  web:
    build:
      context: ./containers
      dockerfile: web.Containerfile
    image: localhost/fennas-imposter-web
    working_dir: /app
    command: sh -c "bun install && bun run dev"
    ports:
      - "5173:5173"
      - "4173:4173"
    volumes:
      - .:/app
      - /app/node_modules

  e2e:
    build:
      context: ./containers
      dockerfile: e2e.Containerfile
    image: localhost/fennas-imposter-e2e
    working_dir: /app
    ipc: host # Playwright's recommendation: Chromium can run out of shared memory without it
    command: sh -c "bun install && bun run test:e2e"
    environment:
      CI: "true"
    volumes:
      - .:/app
      - e2e_node_modules:/app/node_modules
      - bun_cache:/root/.bun/install/cache

volumes:
  e2e_node_modules:
  bun_cache:
```

The `web` service uses an anonymous `node_modules` volume, as the user's other Vite containers do. The `e2e` service runs with `run --rm`, so it uses named volumes to keep installs cached between runs.

- [ ] **Step 3: Create `package.json` and `bunfig.toml`**

`package.json`:
```json
{
  "name": "fennas-imposter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bunx --bun vite",
    "typecheck": "vue-tsc --noEmit -p tsconfig.app.json && vue-tsc --noEmit -p tsconfig.test.json && vue-tsc --noEmit -p tsconfig.node.json",
    "build": "bun run typecheck && bunx --bun vite build",
    "preview": "bunx --bun vite preview",
    "test": "bun test",
    "test:e2e": "playwright test",
    "lint": "bunx --bun eslint ."
  },
  "dependencies": {
    "@fontsource/baloo-bhaijaan-2": "5.3.0",
    "vue": "3.5.43",
    "vue-router": "5.3.1"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@types/bun": "1.4.2",
    "@types/node": "24.19.0",
    "@vitejs/plugin-vue": "6.0.9",
    "@vue/eslint-config-typescript": "14.9.0",
    "@vue/tsconfig": "0.9.1",
    "eslint": "10.11.0",
    "eslint-plugin-vue": "10.11.1",
    "typescript": "~6.0.3",
    "vite": "8.3.1",
    "vue-tsc": "3.3.11"
  }
}
```

`typecheck` deliberately has no `bunx --bun`: vue-tsc must run on Node (see Global Constraints).

`bunfig.toml`:
```toml
[test]
# Unit tests live next to the code; tests/e2e belongs to Playwright.
root = "./src"
```

- [ ] **Step 4: Create the TypeScript configs**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.test.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:
```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["src/**/*.test.ts"]
}
```

`tsconfig.test.json`:
```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src/**/*.test.ts"],
  "exclude": []
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["vite.config.ts", "playwright.config.ts", "tests/e2e/**/*.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts` and `eslint.config.js`**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Only needed inside the container: file events don't cross the Windows bind mount.
    watch: { usePolling: true, interval: 1000 },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
})
```

`eslint.config.js`:
```js
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'public/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  { rules: { 'vue/multi-word-component-names': 'off' } },
)
```

- [ ] **Step 6: Create the minimal app entry**

`index.html`:
```html
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Fenna's Imposter</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.ts`:
```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`src/App.vue`: this placeholder is replaced in Task 15.
```vue
<template>
  <h1>Fenna's Imposter</h1>
</template>
```

- [ ] **Step 7: Build the images, start the dev container, generate the lockfile**

Run: `podman compose build`
Expected: both images build (`localhost/fennas-imposter-web`, `localhost/fennas-imposter-e2e`).

Run: `podman compose up -d web`, then `podman compose logs web` (repeat until the dev server is up).
Expected: the logs end with `VITE v8.3.1  ready` and `Local: http://localhost:5173/`. `bun.lock` now exists in the repo root.
If `podman compose` says it cannot connect to the podman machine, STOP and ask the user to start it.

- [ ] **Step 8: Verify the toolchain**

Run: `podman compose exec web bun run typecheck`
Expected: exits 0 with no errors.

Run: `podman compose exec web bun test --pass-with-no-tests`
Expected: `No tests found!` and exit code 0.

Run: `podman compose exec web bun run lint`
Expected: exits 0.

Run: `podman compose exec web bun run build`
Expected: `✓ built in …` and `dist/index.html` exists.

Open `http://localhost:5173` on the host. Expected: the heading "Fenna's Imposter".

- [ ] **Step 9: Commit**

```bash
jj commit -m "chore: scaffold Vue 3 + Vite project on Bun with podman dev containers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine types and randomness

**Files:**
- Create: `src/engine/types.ts`, `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`:
    - `Lang`, `LANGS`, `Localized`
    - `Category`, `Word`, `Player`, `TimerSettings`, `Settings`, `Content`
    - `Phase`, `Source`, `Secret`, `RoundSettings`, `Outcome`, `VotedOut`, `RoundState`
    - These are the exact shapes from spec §8/§9.1.
  - `rng.ts`:
    - `interface Rng { next(): number }`
    - `seededRng(seed: number): Rng`
    - `cryptoRng: Rng`
    - `randomInt(rng, min, max): number` (inclusive)
    - `pickOne<T>(rng, items: readonly T[]): T`
    - `sample<T>(rng, items: readonly T[], k: number): T[]`
    - `newId(): string` (UUID v4)

- [ ] **Step 1: Create `src/engine/types.ts`** (types only, no test of its own)

```ts
export type Lang = 'en' | 'ar'
export const LANGS: readonly Lang[] = ['en', 'ar']

/** A text that may exist in English, Arabic, or both. */
export type Localized = Partial<Record<Lang, string>>

export interface Category {
  id: string
  name: Localized
  builtIn: boolean
}

export interface Word {
  id: string
  categoryId: string
  builtIn: boolean
  text: Localized
  hint: Localized
}

export interface Player {
  id: string
  name: string
}

export interface TimerSettings {
  enabled: boolean
  seconds: number
}

export interface Settings {
  imposterCount: number
  randomImposterCount: boolean
  hints: boolean
  timer: TimerSettings
  scoring: boolean
}

export interface Content {
  categories: Category[]
  words: Word[]
}

export type Phase = 'gmEntry' | 'reveal' | 'discussion' | 'vote' | 'guess' | 'result'

export type Source =
  | { kind: 'random' }
  | { kind: 'playerGm'; gmPlayerId: string }
  | { kind: 'outsideGm' }

/** Snapshot of the round's word, so later edits/deletes never change a running round. */
export interface Secret {
  wordId: string
  word: string
  hint: string | null
  categoryName: string
}

export interface RoundSettings {
  hints: boolean
  scoring: boolean
  timer: TimerSettings
  imposterCountHidden: boolean
}

export type Outcome = 'crew' | 'imposters'

/** `null` until the vote happens; `playerId: null` means the group voted out nobody. */
export type VotedOut = { playerId: string | null } | null

export interface RoundState {
  number: number
  lang: Lang
  source: Source
  participantIds: string[]
  imposterIds: string[]
  startingPlayerId: string
  secret: Secret | null
  settings: RoundSettings
  phase: Phase
  revealIndex: number
  timerEndsAt: number | null
  votedOut: VotedOut
  imposterGuessed: boolean | null
  outcome: Outcome | null
}
```

- [ ] **Step 2: Write the failing test `src/engine/rng.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { cryptoRng, newId, pickOne, randomInt, sample, seededRng } from './rng'

describe('seededRng', () => {
  it('replays the same sequence for the same seed, so engine tests are reproducible', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
    expect(new Set(seqA).size).toBe(5)
  })

  it('stays within [0, 1)', () => {
    const rng = seededRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomInt', () => {
  it('reaches both inclusive ends, so every player can be picked', () => {
    const rng = seededRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 1, 4))
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('rejects an empty range instead of returning garbage', () => {
    expect(() => randomInt(seededRng(1), 3, 2)).toThrow()
  })
})

describe('pickOne / sample', () => {
  it('pickOne refuses an empty list instead of returning undefined', () => {
    expect(() => pickOne(seededRng(1), [])).toThrow()
  })

  it('sample returns k distinct members of the input', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    for (let seed = 0; seed < 50; seed++) {
      const picked = sample(seededRng(seed), items, 3)
      expect(new Set(picked).size).toBe(3)
      for (const p of picked) expect(items).toContain(p)
    }
  })

  it('sample refuses to take more items than exist', () => {
    expect(() => sample(seededRng(1), ['a'], 2)).toThrow()
  })
})

describe('cryptoRng and newId', () => {
  it('cryptoRng stays within [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = cryptoRng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('newId makes unique v4 UUIDs without crypto.randomUUID (which needs a secure context)', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()))
    expect(ids.size).toBe(100)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/engine/rng.test.ts`
Expected: FAIL, `error: Cannot find module './rng'`.

- [ ] **Step 4: Implement `src/engine/rng.ts`**

```ts
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
}

/** mulberry32 — small, fast, deterministic. Tests only; the app uses cryptoRng. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

export const cryptoRng: Rng = {
  next: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
}

export function randomInt(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`randomInt: invalid range [${min}, ${max}]`)
  }
  return min + Math.floor(rng.next() * (max - min + 1))
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: empty list')
  return items[randomInt(rng, 0, items.length - 1)]
}

/** k distinct items via a partial Fisher–Yates shuffle. */
export function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  if (k < 0 || k > items.length) throw new Error(`sample: cannot take ${k} of ${items.length}`)
  const copy = [...items]
  for (let i = 0; i < k; i++) {
    const j = randomInt(rng, i, copy.length - 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, k)
}

/** RFC 4122 v4 UUID from getRandomValues (works on plain-http LAN dev URLs too). */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/engine/rng.test.ts`
Expected: `9 pass`, `0 fail`.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(engine): add core types and injectable RNG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Text limits and normalization

**Files:**
- Create: `src/data/limits.ts`, `src/data/normalize.ts`
- Test: `src/data/normalize.test.ts`

**Interfaces:**
- Consumes: `LANGS`, `Localized` from `src/engine/types.ts`.
- Produces:
  - `limits.ts`:
    - `LIMITS = { player: 20, word: 40, hint: 40, category: 30 }`
    - `TIMER = { min: 30, max: 600, step: 30, default: 180 }`
    - `MAX_IMPOSTER_SETTING = 10`
    - `textLength(s): number` (code points)
  - `normalize.ts`:
    - `normalizeText(s): string` (matching only)
    - `cleanText(s): string` (display/storage)
    - `cleanLocalized(l: Localized): Localized`

- [ ] **Step 1: Write the failing test `src/data/normalize.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { textLength } from './limits'

describe('normalizeText (used for matching only, never shown)', () => {
  it('ignores case and extra whitespace', () => {
    expect(normalizeText('  Falafel   Wrap ')).toBe(normalizeText('falafel wrap'))
  })

  it('ignores tashkeel so vowelled and plain spellings match', () => {
    expect(normalizeText('كِتَابٌ')).toBe(normalizeText('كتاب'))
  })

  it('ignores tatweel stretching', () => {
    expect(normalizeText('مـــرحبا')).toBe('مرحبا')
  })

  it('treats أ إ آ as ا because people type them interchangeably', () => {
    expect(normalizeText('أحمد')).toBe('احمد')
    expect(normalizeText('إبريق')).toBe('ابريق')
    expect(normalizeText('آخر')).toBe('اخر')
  })

  it('treats ة as ه and ى as ي, as casual Levantine spelling does', () => {
    expect(normalizeText('مدرسة')).toBe(normalizeText('مدرسه'))
    expect(normalizeText('مستشفى')).toBe(normalizeText('مستشفي'))
  })

  it('folds Arabic presentation forms (copied from PDFs) to normal letters', () => {
    expect(normalizeText('ﻻ')).toBe('لا')
  })
})

describe('cleanText / cleanLocalized (what we store and display)', () => {
  it('keeps the original spelling but trims and collapses spaces', () => {
    expect(cleanText('  أحمد   علي ')).toBe('أحمد علي')
  })

  it('drops languages that are empty after cleaning', () => {
    expect(cleanLocalized({ en: '   ', ar: ' كبّة ' })).toEqual({ ar: 'كبّة' })
  })
})

describe('textLength', () => {
  it('counts an emoji as one character, like a person would', () => {
    expect(textLength('Rami 😎')).toBe(6)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/data/normalize.test.ts`
Expected: FAIL, `error: Cannot find module './normalize'`.

- [ ] **Step 3: Implement `src/data/limits.ts`**

```ts
export const LIMITS = { player: 20, word: 40, hint: 40, category: 30 } as const

export const TIMER = { min: 30, max: 600, step: 30, default: 180 } as const

/** Upper bound accepted from settings/imports; the real cap is maxImposters(participants). */
export const MAX_IMPOSTER_SETTING = 10

/** Length in code points, so an emoji counts as one character. */
export function textLength(s: string): number {
  return [...s].length
}
```

- [ ] **Step 4: Implement `src/data/normalize.ts`**

```ts
import { LANGS, type Localized } from '../engine/types'

/** Trim and collapse whitespace. Safe for display and storage. */
export function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Clean every language and drop the empty ones. */
export function cleanLocalized(value: Localized): Localized {
  const out: Localized = {}
  for (const lang of LANGS) {
    const v = value[lang]
    if (typeof v === 'string') {
      const c = cleanText(v)
      if (c) out[lang] = c
    }
  }
  return out
}

/** Comparison key for duplicate detection. Never display the result. */
export function normalizeText(s: string): string {
  return cleanText(
    s
      .normalize('NFKC')
      .replace(/[ً-ْ]/g, '') // tashkeel
      .replace(/ـ/g, '') // tatweel
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase(),
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/data/normalize.test.ts`
Expected: `9 pass`, `0 fail`.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(data): add text limits and Arabic-aware normalization

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Word eligibility and picking

**Files:**
- Create: `src/engine/words.ts`
- Test: `src/engine/words.test.ts`

**Interfaces:**
- Consumes: types from Task 2; `Rng`, `pickOne` from `rng.ts`.
- Produces:
  - `eligibleCategories(content: Content, lang: Lang): Category[]`
  - `eligibleWords(content: Content, lang: Lang, categoryIds: readonly string[]): Word[]`
  - `pickWord(eligible: readonly Word[], used: readonly string[], rng: Rng): { word: Word; used: string[] }`
  - `makeSecret(word: Word, category: Category, lang: Lang): Secret`
  - `imposterHint(secret: Secret): string`

- [ ] **Step 1: Write the failing test `src/engine/words.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import type { Category, Content, Localized, Word } from './types'
import { seededRng } from './rng'
import { eligibleCategories, eligibleWords, imposterHint, makeSecret, pickWord } from './words'

const categories: Category[] = [
  { id: 'food', name: { en: 'Food', ar: 'أكل' }, builtIn: true },
  { id: 'levant', name: { ar: 'من عنّا' }, builtIn: true },
  { id: 'en-only', name: { en: 'English only' }, builtIn: false },
]
const w = (id: string, categoryId: string, text: Localized, hint: Localized = {}): Word => ({
  id, categoryId, builtIn: true, text, hint,
})
const words: Word[] = [
  w('food.falafel', 'food', { en: 'Falafel', ar: 'فلافل' }, { en: 'Fried', ar: 'مقلي' }),
  w('food.pizza', 'food', { en: 'Pizza', ar: 'بيتزا' }),
  w('food.bread', 'food', { en: '   ', ar: 'خبز' }),
  w('levant.kibbeh', 'levant', { ar: 'كبّة' }, { ar: 'برغل' }),
  w('en-only.bagel', 'en-only', { en: 'Bagel' }),
]
const content: Content = { categories, words }
const ids = (list: Word[]) => list.map((x) => x.id)

describe('eligibleWords', () => {
  it('never deals an Arabic-only word in an English round', () => {
    expect(ids(eligibleWords(content, 'en', ['food', 'levant']))).toEqual(['food.falafel', 'food.pizza'])
  })

  it('treats whitespace-only text as missing', () => {
    expect(ids(eligibleWords(content, 'en', ['food']))).not.toContain('food.bread')
    expect(ids(eligibleWords(content, 'ar', ['food']))).toContain('food.bread')
  })

  it('needs the category to have a name in the round language', () => {
    expect(eligibleWords(content, 'ar', ['en-only'])).toEqual([])
  })

  it('ignores categories that are not selected', () => {
    expect(ids(eligibleWords(content, 'en', ['food']))).not.toContain('en-only.bagel')
  })
})

describe('eligibleCategories', () => {
  it('lists only categories that can actually deal a word in that language', () => {
    expect(eligibleCategories(content, 'en').map((c) => c.id)).toEqual(['food', 'en-only'])
    expect(eligibleCategories(content, 'ar').map((c) => c.id)).toEqual(['food', 'levant'])
  })
})

describe('pickWord', () => {
  const pool = eligibleWords(content, 'ar', ['food'])

  it('does not repeat a word until the whole pool has been used', () => {
    let used: string[] = []
    const rng = seededRng(3)
    const picked: string[] = []
    for (let i = 0; i < pool.length; i++) {
      const r = pickWord(pool, used, rng)
      picked.push(r.word.id)
      used = r.used
    }
    expect(new Set(picked).size).toBe(pool.length)
  })

  it('starts over once the pool is exhausted, keeping history from other pools', () => {
    const used = ['other.word', ...ids(pool)]
    const r = pickWord(pool, used, seededRng(5))
    expect(r.used).toEqual(['other.word', r.word.id])
  })

  it('refuses an empty pool loudly', () => {
    expect(() => pickWord([], [], seededRng(1))).toThrow()
  })
})

describe('makeSecret / imposterHint', () => {
  const food = categories[0]

  it('snapshots the word, hint and category name in the round language', () => {
    expect(makeSecret(words[0], food, 'ar')).toEqual({
      wordId: 'food.falafel', word: 'فلافل', hint: 'مقلي', categoryName: 'أكل',
    })
  })

  it('falls back to the category name when the word has no hint', () => {
    const secret = makeSecret(words[1], food, 'en')
    expect(secret.hint).toBeNull()
    expect(imposterHint(secret)).toBe('Food')
  })

  it('refuses a word that is not playable in that language', () => {
    expect(() => makeSecret(words[3], categories[1], 'en')).toThrow()
  })

  it('refuses a word paired with the wrong category', () => {
    expect(() => makeSecret(words[0], categories[1], 'ar')).toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/engine/words.test.ts`
Expected: FAIL, `error: Cannot find module './words'`.

- [ ] **Step 3: Implement `src/engine/words.ts`**

```ts
import type { Category, Content, Lang, Secret, Word } from './types'
import { pickOne, type Rng } from './rng'

const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== ''

export function eligibleCategories(content: Content, lang: Lang): Category[] {
  const withWords = new Set(content.words.filter((w) => present(w.text[lang])).map((w) => w.categoryId))
  return content.categories.filter((c) => present(c.name[lang]) && withWords.has(c.id))
}

export function eligibleWords(content: Content, lang: Lang, categoryIds: readonly string[]): Word[] {
  const selected = new Set(categoryIds)
  const playable = new Set(
    content.categories.filter((c) => selected.has(c.id) && present(c.name[lang])).map((c) => c.id),
  )
  return content.words.filter((w) => playable.has(w.categoryId) && present(w.text[lang]))
}

/**
 * Picks an unused word. When every eligible word has been used, only this pool's ids are
 * dropped from the history (other languages/categories keep theirs) and picking starts over.
 */
export function pickWord(
  eligible: readonly Word[],
  used: readonly string[],
  rng: Rng,
): { word: Word; used: string[] } {
  if (eligible.length === 0) throw new Error('pickWord: no eligible words')
  const usedSet = new Set(used)
  let pool = eligible.filter((w) => !usedSet.has(w.id))
  let history = [...used]
  if (pool.length === 0) {
    const eligibleIds = new Set(eligible.map((w) => w.id))
    history = history.filter((id) => !eligibleIds.has(id))
    pool = [...eligible]
  }
  const word = pickOne(rng, pool)
  return { word, used: [...history, word.id] }
}

export function makeSecret(word: Word, category: Category, lang: Lang): Secret {
  const text = word.text[lang]
  const categoryName = category.name[lang]
  if (word.categoryId !== category.id) {
    throw new Error(`makeSecret: word ${word.id} is not in category ${category.id}`)
  }
  if (!present(text) || !present(categoryName)) {
    throw new Error(`makeSecret: ${word.id} is not playable in ${lang}`)
  }
  const hint = word.hint[lang]
  return {
    wordId: word.id,
    word: text.trim(),
    hint: present(hint) ? hint.trim() : null,
    categoryName: categoryName.trim(),
  }
}

export function imposterHint(secret: Secret): string {
  return secret.hint ?? secret.categoryName
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/engine/words.test.ts`
Expected: `12 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(engine): add per-language word eligibility and repeat-free picking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Imposter assignment

**Files:**
- Create: `src/engine/assign.ts`
- Test: `src/engine/assign.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 2); `Rng`, `randomInt`, `sample`, `pickOne`.
- Produces:
  - `MIN_PARTICIPANTS = 3`
  - `maxImposters(participants: number): number`
  - `resolveImposterCount(settings: Pick<Settings, 'imposterCount' | 'randomImposterCount'>, participants: number, rng: Rng): { count: number; clamped: boolean }`
  - `assignImposters(participantIds: readonly string[], count: number, rng: Rng): string[]`
  - `pickStartingPlayer(participantIds: readonly string[], rng: Rng): string`

- [ ] **Step 1: Write the failing test `src/engine/assign.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { seededRng } from './rng'
import { assignImposters, maxImposters, pickStartingPlayer, resolveImposterCount } from './assign'

describe('maxImposters', () => {
  it.each([
    [2, 0], [3, 1], [4, 1], [5, 2], [6, 2], [7, 3], [12, 5],
  ])('%i participants allow at most %i imposters', (n, max) => {
    expect(maxImposters(n)).toBe(max)
  })
})

describe('resolveImposterCount', () => {
  it('always leaves the crew outnumbering the imposters, whatever the settings say', () => {
    for (let n = 3; n <= 12; n++) {
      for (let requested = 1; requested <= 10; requested++) {
        for (const randomImposterCount of [false, true]) {
          for (let seed = 0; seed < 10; seed++) {
            const { count } = resolveImposterCount({ imposterCount: requested, randomImposterCount }, n, seededRng(seed))
            expect(count).toBeGreaterThanOrEqual(1)
            expect(n - count).toBeGreaterThan(count)
          }
        }
      }
    }
  })

  it('reports clamping so the between-rounds screen can explain it', () => {
    expect(resolveImposterCount({ imposterCount: 3, randomImposterCount: false }, 4, seededRng(1)))
      .toEqual({ count: 1, clamped: true })
    expect(resolveImposterCount({ imposterCount: 2, randomImposterCount: false }, 5, seededRng(1)))
      .toEqual({ count: 2, clamped: false })
  })

  it('random mode can produce every count from 1 to max', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(resolveImposterCount({ imposterCount: 1, randomImposterCount: true }, 7, seededRng(seed)).count)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('refuses a round with fewer than 3 participants', () => {
    expect(() => resolveImposterCount({ imposterCount: 1, randomImposterCount: false }, 2, seededRng(1))).toThrow()
  })
})

describe('assignImposters / pickStartingPlayer', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']

  it('picks distinct imposters from the participants only', () => {
    for (let seed = 0; seed < 30; seed++) {
      const imposters = assignImposters(ids, 2, seededRng(seed))
      expect(new Set(imposters).size).toBe(2)
      for (const id of imposters) expect(ids).toContain(id)
    }
  })

  it('picks a starting player from the participants', () => {
    expect(ids).toContain(pickStartingPlayer(ids, seededRng(9)))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/engine/assign.test.ts`
Expected: FAIL, `error: Cannot find module './assign'`.

- [ ] **Step 3: Implement `src/engine/assign.ts`**

```ts
import type { Settings } from './types'
import { pickOne, randomInt, sample, type Rng } from './rng'

export const MIN_PARTICIPANTS = 3

/** Crew must always outnumber imposters. */
export function maxImposters(participants: number): number {
  return Math.max(0, Math.floor((participants - 1) / 2))
}

export function resolveImposterCount(
  settings: Pick<Settings, 'imposterCount' | 'randomImposterCount'>,
  participants: number,
  rng: Rng,
): { count: number; clamped: boolean } {
  const max = maxImposters(participants)
  if (max < 1) throw new Error(`Need at least ${MIN_PARTICIPANTS} participants`)
  if (settings.randomImposterCount) return { count: randomInt(rng, 1, max), clamped: false }
  const requested = Math.max(1, Math.floor(settings.imposterCount))
  return { count: Math.min(requested, max), clamped: requested > max }
}

export function assignImposters(participantIds: readonly string[], count: number, rng: Rng): string[] {
  return sample(rng, participantIds, count)
}

export function pickStartingPlayer(participantIds: readonly string[], rng: Rng): string {
  return pickOne(rng, participantIds)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/engine/assign.test.ts`
Expected: `13 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(engine): add imposter assignment with crew-majority guarantee

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Round state machine

**Files:**
- Create: `src/engine/round.ts`
- Test: `src/engine/round.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `Lang`, `RoundState`, `Secret`, `Settings`, `Source`
  - From Task 5: `MIN_PARTICIPANTS`, `resolveImposterCount`, `assignImposters`, `pickStartingPlayer`
  - `Rng`
- Produces:
  - `class IllegalActionError extends Error`
  - `interface StartRoundInput { number; lang; source; activePlayerIds: readonly string[]; settings: Settings; secret: Secret | null }`
  - `type RoundAction`: `setSecret{secret}` | `cardSeen{now}` | `endDiscussion` | `voteOut{playerId: string | null}` | `imposterGuess{correct}`
  - `participantsFor(activePlayerIds, source): string[]`
  - `startRound(input, rng): { round: RoundState; clamped: boolean }`
  - `reduce(state, action): RoundState`

- [ ] **Step 1: Write the failing test `src/engine/round.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import type { RoundState, Secret, Settings } from './types'
import { seededRng } from './rng'
import { IllegalActionError, reduce, startRound, type StartRoundInput } from './round'

const settings = (over: Partial<Settings> = {}): Settings => ({
  imposterCount: 1,
  randomImposterCount: false,
  hints: true,
  timer: { enabled: false, seconds: 180 },
  scoring: true,
  ...over,
})
const secret: Secret = { wordId: 'food.falafel', word: 'Falafel', hint: 'Fried', categoryName: 'Food' }
const players = ['p1', 'p2', 'p3', 'p4']

function start(over: Partial<StartRoundInput> = {}, seed = 1): RoundState {
  return startRound(
    { number: 1, lang: 'en', source: { kind: 'random' }, activePlayerIds: players, settings: settings(), secret, ...over },
    seededRng(seed),
  ).round
}
function revealAll(round: RoundState, now = 1_000): RoundState {
  let s = round
  for (let i = 0; i < round.participantIds.length; i++) s = reduce(s, { type: 'cardSeen', now })
  return s
}
const toVote = (r: RoundState) => reduce(revealAll(r), { type: 'endDiscussion' })
const crewOf = (r: RoundState) => r.participantIds.find((id) => !r.imposterIds.includes(id))!

describe('startRound', () => {
  it('starts a random round dealing immediately, with its word', () => {
    const r = start()
    expect(r.phase).toBe('reveal')
    expect(r.secret).toEqual(secret)
    expect(r.participantIds).toEqual(players)
    expect(r.imposterIds).toHaveLength(1)
  })

  it('makes a Game Master round wait for the word before dealing', () => {
    const r = start({ source: { kind: 'outsideGm' }, secret: null })
    expect(r.phase).toBe('gmEntry')
    expect(r.secret).toBeNull()
    expect(reduce(r, { type: 'setSecret', secret }).phase).toBe('reveal')
  })

  it('never deals the player GM a card, never makes them imposter, never lets them start', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = start({ source: { kind: 'playerGm', gmPlayerId: 'p1' }, secret: null }, seed)
      expect(r.participantIds).toEqual(['p2', 'p3', 'p4'])
      expect(r.imposterIds).not.toContain('p1')
      expect(r.startingPlayerId).not.toBe('p1')
    }
  })

  it('refuses a round that a player GM would shrink below 3 participants', () => {
    expect(() =>
      start({ activePlayerIds: ['p1', 'p2', 'p3'], source: { kind: 'playerGm', gmPlayerId: 'p1' }, secret: null }),
    ).toThrow(IllegalActionError)
  })

  it('refuses a GM who is not an active player', () => {
    expect(() => start({ source: { kind: 'playerGm', gmPlayerId: 'ghost' }, secret: null })).toThrow(IllegalActionError)
  })

  it('treats a missing or unexpected word as a bug', () => {
    expect(() => start({ secret: null })).toThrow(IllegalActionError)
    expect(() => start({ source: { kind: 'outsideGm' }, secret })).toThrow(IllegalActionError)
  })

  it('remembers that the imposter count is a surprise in random-count mode', () => {
    expect(start({ settings: settings({ randomImposterCount: true }) }).settings.imposterCountHidden).toBe(true)
    expect(start().settings.imposterCountHidden).toBe(false)
  })
})

describe('reduce', () => {
  it('shows every participant exactly one card, then starts the discussion', () => {
    let r = start()
    for (let i = 0; i < 3; i++) r = reduce(r, { type: 'cardSeen', now: 0 })
    expect(r.phase).toBe('reveal')
    expect(r.revealIndex).toBe(3)
    r = reduce(r, { type: 'cardSeen', now: 0 })
    expect(r.phase).toBe('discussion')
  })

  it('stores the timer end as an absolute time so a reload can resume it', () => {
    const timed = start({ settings: settings({ timer: { enabled: true, seconds: 120 } }) })
    expect(revealAll(timed, 5_000).timerEndsAt).toBe(125_000)
    expect(revealAll(start(), 5_000).timerEndsAt).toBeNull()
  })

  it('skips voting when scoring is off and just reveals', () => {
    const r = reduce(revealAll(start({ settings: settings({ scoring: false }) })), { type: 'endDiscussion' })
    expect(r.phase).toBe('result')
    expect(r.outcome).toBeNull()
  })

  it('gives the win to the imposters when the group votes out a crew member', () => {
    const r = toVote(start())
    const next = reduce(r, { type: 'voteOut', playerId: crewOf(r) })
    expect(next.phase).toBe('result')
    expect(next.outcome).toBe('imposters')
  })

  it('gives the win to the imposters when the group votes out nobody', () => {
    const next = reduce(toVote(start()), { type: 'voteOut', playerId: null })
    expect(next.outcome).toBe('imposters')
    expect(next.votedOut).toEqual({ playerId: null })
  })

  it('gives a caught imposter one guess: right means imposters win, wrong means crew wins', () => {
    const r = toVote(start())
    const caught = reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] })
    expect(caught.phase).toBe('guess')
    expect(reduce(caught, { type: 'imposterGuess', correct: true }).outcome).toBe('imposters')
    expect(reduce(caught, { type: 'imposterGuess', correct: false }).outcome).toBe('crew')
  })

  it('rejects actions that are out of order, loudly', () => {
    const discussion = revealAll(start())
    expect(() => reduce(discussion, { type: 'cardSeen', now: 0 })).toThrow(IllegalActionError)
    expect(() => reduce(start(), { type: 'setSecret', secret })).toThrow(IllegalActionError)
    expect(() => reduce(toVote(start()), { type: 'voteOut', playerId: 'stranger' })).toThrow(IllegalActionError)
    const result = reduce(toVote(start()), { type: 'voteOut', playerId: null })
    expect(() => reduce(result, { type: 'endDiscussion' })).toThrow(IllegalActionError)
  })

  it('never mutates the previous state, which may already be persisted', () => {
    const r = start()
    const before = structuredClone(r)
    reduce(r, { type: 'cardSeen', now: 0 })
    expect(r).toEqual(before)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/engine/round.test.ts`
Expected: FAIL, `error: Cannot find module './round'`.

- [ ] **Step 3: Implement `src/engine/round.ts`**

```ts
import type { Lang, RoundState, Secret, Settings, Source } from './types'
import type { Rng } from './rng'
import { MIN_PARTICIPANTS, assignImposters, pickStartingPlayer, resolveImposterCount } from './assign'

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalActionError'
  }
}

export interface StartRoundInput {
  number: number
  lang: Lang
  source: Source
  /** Active players in roster order; this is the pass order. */
  activePlayerIds: readonly string[]
  settings: Settings
  /** Required for the random source; must be null for GM sources (the GM types it). */
  secret: Secret | null
}

export type RoundAction =
  | { type: 'setSecret'; secret: Secret }
  | { type: 'cardSeen'; now: number }
  | { type: 'endDiscussion' }
  | { type: 'voteOut'; playerId: string | null }
  | { type: 'imposterGuess'; correct: boolean }

export function participantsFor(activePlayerIds: readonly string[], source: Source): string[] {
  return source.kind === 'playerGm'
    ? activePlayerIds.filter((id) => id !== source.gmPlayerId)
    : [...activePlayerIds]
}

export function startRound(input: StartRoundInput, rng: Rng): { round: RoundState; clamped: boolean } {
  const { source, secret, settings } = input
  if (source.kind === 'playerGm' && !input.activePlayerIds.includes(source.gmPlayerId)) {
    throw new IllegalActionError('The Game Master must be an active player')
  }
  const participantIds = participantsFor(input.activePlayerIds, source)
  if (participantIds.length < MIN_PARTICIPANTS) {
    throw new IllegalActionError(`A round needs at least ${MIN_PARTICIPANTS} participants`)
  }
  if (source.kind === 'random' && !secret) throw new IllegalActionError('A random round needs a word')
  if (source.kind !== 'random' && secret) throw new IllegalActionError('A Game Master round starts without a word')

  const { count, clamped } = resolveImposterCount(settings, participantIds.length, rng)
  const round: RoundState = {
    number: input.number,
    lang: input.lang,
    source,
    participantIds,
    imposterIds: assignImposters(participantIds, count, rng),
    startingPlayerId: pickStartingPlayer(participantIds, rng),
    secret,
    settings: {
      hints: settings.hints,
      scoring: settings.scoring,
      timer: { ...settings.timer },
      imposterCountHidden: settings.randomImposterCount,
    },
    phase: source.kind === 'random' ? 'reveal' : 'gmEntry',
    revealIndex: 0,
    timerEndsAt: null,
    votedOut: null,
    imposterGuessed: null,
    outcome: null,
  }
  return { round, clamped }
}

function expectPhase(state: RoundState, phase: RoundState['phase'], action: RoundAction): void {
  if (state.phase !== phase) {
    throw new IllegalActionError(`"${action.type}" is not allowed during "${state.phase}"`)
  }
}

export function reduce(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'setSecret':
      expectPhase(state, 'gmEntry', action)
      return { ...state, secret: action.secret, phase: 'reveal' }

    case 'cardSeen': {
      expectPhase(state, 'reveal', action)
      const revealIndex = state.revealIndex + 1
      if (revealIndex < state.participantIds.length) return { ...state, revealIndex }
      const { timer } = state.settings
      return {
        ...state,
        revealIndex,
        phase: 'discussion',
        timerEndsAt: timer.enabled ? action.now + timer.seconds * 1000 : null,
      }
    }

    case 'endDiscussion':
      expectPhase(state, 'discussion', action)
      return { ...state, phase: state.settings.scoring ? 'vote' : 'result' }

    case 'voteOut': {
      expectPhase(state, 'vote', action)
      const { playerId } = action
      if (playerId !== null && !state.participantIds.includes(playerId)) {
        throw new IllegalActionError(`${playerId} is not in this round`)
      }
      const votedOut = { playerId }
      if (playerId !== null && state.imposterIds.includes(playerId)) {
        return { ...state, votedOut, phase: 'guess' }
      }
      return { ...state, votedOut, phase: 'result', outcome: 'imposters' }
    }

    case 'imposterGuess':
      expectPhase(state, 'guess', action)
      return {
        ...state,
        imposterGuessed: action.correct,
        phase: 'result',
        outcome: action.correct ? 'imposters' : 'crew',
      }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/engine/round.test.ts`
Expected: `15 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(engine): add round state machine with loud illegal-action errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scoring

**Files:**
- Create: `src/engine/scoring.ts`
- Test: `src/engine/scoring.test.ts`

**Interfaces:**
- Consumes: `RoundState` (Task 2); `startRound`, `reduce` (Task 6), used in tests only.
- Produces: `CREW_WIN_POINTS = 1`, `IMPOSTER_WIN_POINTS = 2`, `scoreDeltas(round: RoundState): Record<string, number>`.

- [ ] **Step 1: Write the failing test `src/engine/scoring.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import type { RoundState, Settings, Source } from './types'
import { seededRng } from './rng'
import { reduce, startRound } from './round'
import { scoreDeltas } from './scoring'

const secret = { wordId: 'w', word: 'Falafel', hint: null, categoryName: 'Food' }

function votingRound(opts: { scoring?: boolean; source?: Source; imposters?: number } = {}): RoundState {
  const settings: Settings = {
    imposterCount: opts.imposters ?? 1, randomImposterCount: false, hints: true,
    timer: { enabled: false, seconds: 180 }, scoring: opts.scoring ?? true,
  }
  const source = opts.source ?? { kind: 'random' }
  let r = startRound(
    { number: 1, lang: 'en', source, activePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'], settings, secret: source.kind === 'random' ? secret : null },
    seededRng(11),
  ).round
  if (r.phase === 'gmEntry') r = reduce(r, { type: 'setSecret', secret })
  for (let i = 0; i < r.participantIds.length; i++) r = reduce(r, { type: 'cardSeen', now: 0 })
  return reduce(r, { type: 'endDiscussion' })
}
const crew = (r: RoundState) => r.participantIds.filter((id) => !r.imposterIds.includes(id))

describe('scoreDeltas', () => {
  it('crew catches the imposter who then misses the word: every crew member +1, imposter nothing', () => {
    const r = votingRound()
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: false })
    const expected = Object.fromEntries(crew(r).map((id) => [id, 1]))
    expect(scoreDeltas(end)).toEqual(expected)
  })

  it('caught imposter guesses the word: every imposter +2', () => {
    const r = votingRound({ imposters: 2 })
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: true })
    expect(scoreDeltas(end)).toEqual(Object.fromEntries(r.imposterIds.map((id) => [id, 2])))
  })

  it('wrong player voted out: every imposter +2', () => {
    const r = votingRound()
    const end = reduce(r, { type: 'voteOut', playerId: crew(r)[0] })
    expect(scoreDeltas(end)).toEqual({ [r.imposterIds[0]]: 2 })
  })

  it('nobody voted out: every imposter +2', () => {
    const r = votingRound()
    expect(scoreDeltas(reduce(r, { type: 'voteOut', playerId: null }))).toEqual({ [r.imposterIds[0]]: 2 })
  })

  it('never gives the Game Master points', () => {
    const r = votingRound({ source: { kind: 'playerGm', gmPlayerId: 'p1' } })
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: false })
    expect(Object.keys(scoreDeltas(end))).not.toContain('p1')
  })

  it('gives nothing when scoring is off or the round is not finished', () => {
    const noScoring = votingRound({ scoring: false })
    expect(noScoring.phase).toBe('result')
    expect(scoreDeltas(noScoring)).toEqual({})
    expect(scoreDeltas(votingRound())).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/engine/scoring.test.ts`
Expected: FAIL, `error: Cannot find module './scoring'`.

- [ ] **Step 3: Implement `src/engine/scoring.ts`**

```ts
import type { RoundState } from './types'

export const CREW_WIN_POINTS = 1
export const IMPOSTER_WIN_POINTS = 2

/** Points earned this round, per participant id. Empty unless the round ended with an outcome. */
export function scoreDeltas(round: RoundState): Record<string, number> {
  if (round.phase !== 'result' || round.outcome === null) return {}
  const imposters = new Set(round.imposterIds)
  const deltas: Record<string, number> = {}
  for (const id of round.participantIds) {
    const isImposter = imposters.has(id)
    if (round.outcome === 'crew' && !isImposter) deltas[id] = CREW_WIN_POINTS
    if (round.outcome === 'imposters' && isImposter) deltas[id] = IMPOSTER_WIN_POINTS
  }
  return deltas
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/engine/scoring.test.ts`
Expected: `6 pass`, `0 fail`.

- [ ] **Step 5: Run the whole engine suite and commit**

Run: `podman compose exec web bun test src/engine`
Expected: PASS (all engine tests).

```bash
jj commit -m "feat(engine): add round scoring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: i18n core and dictionaries

**Files:**
- Create: `src/i18n/en.ts`, `src/i18n/ar.ts`, `src/i18n/index.ts`
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `Lang` from `src/engine/types.ts`.
- Produces:
  - `en.ts`: `type PluralForms`, `type Messages`, `const en`
  - `ar.ts`: `const ar: Messages`
  - `index.ts`:
    - `type MessageKey = keyof Messages`
    - `type Params = Record<string, string | number>`
    - `translate(lang, key, params?): string`
    - `formatNumber(n, lang): string`
    - `formatClock(totalSeconds): string`, which gives `m:ss`
    - `formatList(items, lang): string`
    - `isolate(text): string`
    - `dirFor(lang): 'ltr' | 'rtl'`

**Rules** (spec §4):
- String params are wrapped in U+2068…U+2069 (bidi isolation). Number params are formatted with Western digits.
- A missing param throws. A plural message used without a numeric `count` throws.
- These are the only message keys the UI tasks use. Any new UI text must add a key to **both** files.

- [ ] **Step 1: Write the failing test `src/i18n/i18n.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { en } from './en'
import { ar } from './ar'
import { dirFor, formatClock, formatList, formatNumber, translate } from './index'

describe('dictionaries', () => {
  it('Arabic has exactly the same keys as English, so no screen falls back to a raw key', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
  })

  it('every plural message has an "other" form to fall back on', () => {
    for (const dict of [en, ar]) {
      for (const value of Object.values(dict)) {
        if (typeof value !== 'string') expect(typeof value.other).toBe('string')
      }
    }
  })
})

describe('translate', () => {
  it('picks the grammatically correct Arabic plural (zero, one, two, few, many, other)', () => {
    expect(translate('ar', 'setup.wordCount', { count: 0 })).toBe('ما في كلمات')
    expect(translate('ar', 'setup.wordCount', { count: 1 })).toBe('كلمة وحدة')
    expect(translate('ar', 'setup.wordCount', { count: 2 })).toBe('كلمتين')
    expect(translate('ar', 'setup.wordCount', { count: 3 })).toBe('3 كلمات')
    expect(translate('ar', 'setup.wordCount', { count: 11 })).toBe('11 كلمة')
    expect(translate('ar', 'setup.wordCount', { count: 100 })).toBe('100 كلمة')
  })

  it('uses English one/other plurals', () => {
    expect(translate('en', 'setup.wordCount', { count: 1 })).toBe('1 word')
    expect(translate('en', 'setup.wordCount', { count: 25 })).toBe('25 words')
  })

  it('isolates interpolated names so a Latin name cannot scramble an Arabic sentence', () => {
    expect(translate('ar', 'reveal.show', { name: 'Rami' })).toBe('أنا ⁨Rami⁩ — فرجيني')
    expect(translate('en', 'reveal.show', { name: 'رامي' })).toBe("I'm ⁨رامي⁩ — show me")
  })

  it('writes numbers with Western digits in Arabic', () => {
    expect(translate('ar', 'play.round', { n: 3 })).toBe('الجولة 3')
    expect(formatNumber(12, 'ar')).toBe('12')
  })

  it('throws on a missing parameter instead of showing "{name}" to players', () => {
    expect(() => translate('en', 'reveal.show')).toThrow(/name/)
  })

  it('throws when a plural message gets no numeric count', () => {
    expect(() => translate('en', 'setup.wordCount')).toThrow(/count/)
  })
})

describe('formatting helpers', () => {
  it('dirFor gives rtl only for Arabic', () => {
    expect(dirFor('ar')).toBe('rtl')
    expect(dirFor('en')).toBe('ltr')
  })

  it('formatClock shows minutes and zero-padded seconds', () => {
    expect(formatClock(185)).toBe('3:05')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-4)).toBe('0:00')
  })

  it('formatList joins names the way each language does', () => {
    expect(formatList(['A', 'B', 'C'], 'en')).toBe('⁨A⁩, ⁨B⁩, and ⁨C⁩')
    expect(formatList(['A', 'B'], 'ar')).toContain('و')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test src/i18n`
Expected: FAIL, `error: Cannot find module './en'`.

- [ ] **Step 3: Create `src/i18n/en.ts`**

```ts
export type PluralForms = {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

const messages = {
  'app.title': "Fenna's Imposter",
  'app.tagline': 'One secret word. One faker. Who is it?',

  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.dismiss': 'OK',

  'lang.en': 'English',
  'lang.ar': 'العربية',

  'home.language': 'Language',
  'home.play': "Let's play",
  'home.continue': 'Continue game',
  'home.setup': 'Players & settings',
  'home.words': 'My words',
  'home.data': 'Backup & import',

  'setup.title': 'Setup',
  'setup.players': 'Players',
  'setup.newPlayerPlaceholder': 'Player name',
  'setup.addPlayer': 'Add',
  'setup.playing': 'Playing',
  'setup.removePlayer': 'Remove {name}',
  'setup.activeCount': { one: '{count} player playing', other: '{count} players playing' },
  'setup.categories': 'Categories',
  'setup.wordCount': { one: '{count} word', other: '{count} words' },
  'setup.settings': 'Settings',
  'setup.imposters': 'Imposters',
  'setup.randomImposters': 'Surprise number of imposters',
  'setup.hints': 'Give the imposter a hint',
  'setup.timer': 'Discussion timer',
  'setup.timerLength': 'Timer length',
  'setup.scoring': 'Keep score',
  'setup.done': 'Done',
  'setup.decrease': 'Less',
  'setup.increase': 'More',

  'error.nameEmpty': 'Type a name',
  'error.nameTooLong': 'Names can be at most {max} characters',
  'error.nameTaken': 'That name is already taken',
  'error.inRound': "Can't remove a player who is in the current round",
  'error.noCategories': 'Pick at least one category',
  'error.textEmpty': 'Type something',
  'error.tooLong': 'At most {max} characters',
  'error.needOneLanguage': 'Fill in at least one language',
  'error.unknownCategory': 'That category no longer exists',

  'play.round': 'Round {n}',
  'play.wordSource': 'Where does the word come from?',
  'play.sourceRandom': 'Random word',
  'play.sourcePlayerGm': 'A player is Game Master',
  'play.sourceOutsideGm': 'Outside Game Master',
  'play.pickGm': "Who's the Game Master?",
  'play.startRound': 'Start round',
  'play.editSetup': 'Edit setup',
  'play.endGame': 'End game',
  'play.endGameConfirm': 'End the game and clear the scores?',
  'play.needPlayers': 'You need at least 3 players (not counting the Game Master).',
  'play.noWords': 'No words in the selected categories for this language.',
  'play.clamped': 'Not enough players for that many imposters — using {count}.',
  'play.leaveConfirm': 'Leave the round? You can continue it later.',
  'play.crashed': 'Something went wrong in this round.',
  'play.abandonRound': 'Abandon round',

  'gm.passTo': 'Pass the phone to the Game Master',
  'gm.passToPlayer': 'Pass the phone to {name}, the Game Master',
  'gm.imGm': "I'm the Game Master",
  'gm.guide': 'Game Master only: type a secret word. Everyone except the imposter will see it.',
  'gm.word': 'Secret word',
  'gm.category': 'Category',
  'gm.newCategory': 'New category…',
  'gm.newCategoryName': 'New category name',
  'gm.hint': 'Hint for the imposter (optional)',
  'gm.done': 'Done — hide it',

  'reveal.passTo': 'Pass the phone to',
  'reveal.passGuide': 'Hand the phone to {name}. Make sure nobody else can see the screen.',
  'reveal.show': "I'm {name} — show me",
  'reveal.crewGuide': "Remember this word. When it's your turn, say one word that shows you know it — without giving it away.",
  'reveal.imposterTitle': "You're the imposter!",
  'reveal.imposterGuide': "You don't know the word. Listen to the clues, blend in, and try to work out the word.",
  'reveal.hint': 'Hint: {hint}',
  'reveal.hidePass': 'Hide & pass',

  'discussion.title': 'Discussion time',
  'discussion.guide': '{name} starts. Everyone gives one clue in turn, then discuss and vote out who you think is the imposter.',
  'discussion.imposters': { one: 'There is {count} imposter among you', other: 'There are {count} imposters among you' },
  'discussion.impostersHidden': 'How many imposters? Nobody knows…',
  'discussion.timeUp': "Time's up!",
  'discussion.toVote': 'Time to vote',
  'discussion.toReveal': 'Reveal the imposter',

  'timer.minutesLeft': { one: '{count} minute left', other: '{count} minutes left' },
  'timer.secondsLeft': { one: '{count} second left', other: '{count} seconds left' },

  'vote.title': 'Who did the group vote out?',
  'vote.nobody': 'Nobody',

  'guess.title': '{name} was an imposter! They get one guess at the word — did they get it?',
  'guess.yes': 'Yes, they got it',
  'guess.no': 'No, they missed',

  'result.imposters': { one: 'The imposter was', other: 'The imposters were' },
  'result.word': 'The word was',
  'result.category': 'Category: {category}',
  'result.crewWins': 'The crew wins!',
  'result.impostersWin': { one: 'The imposter wins!', other: 'The imposters win!' },
  'result.nextRound': 'Next round',
  'result.scores': 'Scores',
  'result.points': { one: '{count} pt', other: '{count} pts' },

  'words.title': 'My words',
  'words.empty': 'No custom words yet. Words typed by a Game Master show up here.',
  'words.builtIn': 'built-in',
  'words.english': 'English',
  'words.arabic': 'Arabic',
  'words.word': 'Word',
  'words.hint': 'Hint',
  'words.name': 'Name',
  'words.deleteWordConfirm': 'Delete this word?',
  'words.deleteCategoryConfirm': {
    one: 'Delete this category and its {count} word?',
    other: 'Delete this category and its {count} words?',
  },

  'data.title': 'Backup & import',
  'data.backupTip': 'Your players and words live only on this device. Export a backup now and then.',
  'data.export': 'Export backup',
  'data.importFile': 'Import from a file',
  'data.importUrl': 'Import from a link',
  'data.urlPlaceholder': 'https://…',
  'data.load': 'Load',
  'data.addsCategories': { one: 'Adds {count} category', other: 'Adds {count} categories' },
  'data.updatesCategories': { one: 'Updates {count} category', other: 'Updates {count} categories' },
  'data.addsWords': { one: 'Adds {count} word', other: 'Adds {count} words' },
  'data.updatesWords': { one: 'Updates {count} word', other: 'Updates {count} words' },
  'data.addsPlayers': { one: 'Adds {count} player', other: 'Adds {count} players' },
  'data.replacesSettings': 'Replaces your settings',
  'data.skipsBuiltIn': { one: 'Skips {count} built-in entry', other: 'Skips {count} built-in entries' },
  'data.overwriteNote': 'Updated entries overwrite your local changes to them.',
  'data.nothing': 'Nothing new to import.',
  'data.confirm': 'Import',
  'data.imported': 'Imported!',
  'data.problems': 'The file has problems:',

  'fetch.invalidUrl': "That doesn't look like a link",
  'fetch.httpsOnly': 'Only https:// links are allowed',
  'fetch.offline': "You're offline",
  'fetch.network': "Couldn't reach that link (the server may not allow cross-site access)",
  'fetch.timeout': 'The link took too long to answer',
  'fetch.httpStatus': 'The server answered with error {status}',
  'fetch.tooLarge': 'The file is too large (max 1 MB)',
  'fetch.invalidJson': "That isn't a valid JSON file",

  'pack.badFormat': "not a Fenna's Imposter file",
  'pack.wrongType': 'wrong type',
  'pack.missing': 'missing',
  'pack.invalidId': 'invalid id',
  'pack.empty': 'empty',
  'pack.tooLong': 'too long',
  'pack.unknownCategory': 'unknown category',
  'pack.duplicateId': 'duplicate id',

  'storage.unavailable': "Can't save on this device — changes will be lost when the app closes.",
  'storage.corrupt': 'Saved data was damaged and has been reset. A copy was kept.',
  'storage.newer': 'This data was saved by a newer version of the app. Reload to update.',

  'update.available': 'New version available — tap to reload',
} as const

export const en = messages

export type Messages = {
  [K in keyof typeof messages]: (typeof messages)[K] extends string ? string : PluralForms
}
```

- [ ] **Step 4: Create `src/i18n/ar.ts`**

This is a draft; the user reviews the Arabic wording (spec §16).

```ts
import type { Messages } from './en'

export const ar: Messages = {
  'app.title': 'مين المندسّ؟',
  'app.tagline': 'كلمة سرّية وحدة… وفي حدا عم يمثّل. مين هو؟',

  'common.back': 'رجوع',
  'common.cancel': 'إلغاء',
  'common.save': 'احفظ',
  'common.delete': 'احذف',
  'common.edit': 'عدّل',
  'common.dismiss': 'تمام',

  'lang.en': 'English',
  'lang.ar': 'العربية',

  'home.language': 'اللغة',
  'home.play': 'يلا نلعب',
  'home.continue': 'كمّل اللعبة',
  'home.setup': 'اللاعبين والإعدادات',
  'home.words': 'كلماتي',
  'home.data': 'نسخ احتياطي واستيراد',

  'setup.title': 'التحضير',
  'setup.players': 'اللاعبين',
  'setup.newPlayerPlaceholder': 'اسم اللاعب',
  'setup.addPlayer': 'زيد',
  'setup.playing': 'عم يلعب',
  'setup.removePlayer': 'شيل {name}',
  'setup.activeCount': {
    zero: 'ما حدا عم يلعب',
    one: 'لاعب واحد عم يلعب',
    two: 'لاعبين تنين عم يلعبوا',
    few: '{count} لاعبين عم يلعبوا',
    many: '{count} لاعب عم يلعبوا',
    other: '{count} لاعب عم يلعبوا',
  },
  'setup.categories': 'الفئات',
  'setup.wordCount': {
    zero: 'ما في كلمات',
    one: 'كلمة وحدة',
    two: 'كلمتين',
    few: '{count} كلمات',
    many: '{count} كلمة',
    other: '{count} كلمة',
  },
  'setup.settings': 'الإعدادات',
  'setup.imposters': 'المندسّين',
  'setup.randomImposters': 'عدد مندسّين مفاجأة',
  'setup.hints': 'اعطي المندسّ تلميح',
  'setup.timer': 'مؤقّت النقاش',
  'setup.timerLength': 'مدّة المؤقّت',
  'setup.scoring': 'احسبوا النقاط',
  'setup.done': 'خلصنا',
  'setup.decrease': 'أقل',
  'setup.increase': 'أكتر',

  'error.nameEmpty': 'اكتب اسم',
  'error.nameTooLong': 'الاسم أقصى شي {max} حرف',
  'error.nameTaken': 'هالاسم مأخود',
  'error.inRound': 'ما فيك تشيل لاعب موجود بالجولة الحالية',
  'error.noCategories': 'اختار فئة وحدة عالأقل',
  'error.textEmpty': 'اكتب شي',
  'error.tooLong': 'أقصى شي {max} حرف',
  'error.needOneLanguage': 'عبّي لغة وحدة عالأقل',
  'error.unknownCategory': 'هالفئة ما عادت موجودة',

  'play.round': 'الجولة {n}',
  'play.wordSource': 'منين بتجي الكلمة؟',
  'play.sourceRandom': 'كلمة عشوائية',
  'play.sourcePlayerGm': 'لاعب بيكون الحَكَم',
  'play.sourceOutsideGm': 'حَكَم من برّا',
  'play.pickGm': 'مين الحَكَم؟',
  'play.startRound': 'بلّش الجولة',
  'play.editSetup': 'عدّل التحضير',
  'play.endGame': 'خلّص اللعبة',
  'play.endGameConfirm': 'أكيد بدك تخلّص اللعبة وتمسح النقاط؟',
  'play.needPlayers': 'لازم يكون في 3 لاعبين عالأقل (بدون الحَكَم).',
  'play.noWords': 'ما في كلمات بالفئات المختارة بهاللغة.',
  'play.clamped': 'اللاعبين قلال على هالعدد من المندسّين — رح نلعب بـ{count}.',
  'play.leaveConfirm': 'بدك تطلع من الجولة؟ فيك تكمّلها بعدين.',
  'play.crashed': 'صار في مشكلة بهالجولة.',
  'play.abandonRound': 'اترك الجولة',

  'gm.passTo': 'مرّر التلفون للحَكَم',
  'gm.passToPlayer': 'مرّر التلفون لـ{name}، الحَكَم',
  'gm.imGm': 'أنا الحَكَم',
  'gm.guide': 'بس للحَكَم: اكتب كلمة سرّية. الكل رح يشوفها إلا المندسّ.',
  'gm.word': 'الكلمة السرّية',
  'gm.category': 'الفئة',
  'gm.newCategory': 'فئة جديدة…',
  'gm.newCategoryName': 'اسم الفئة الجديدة',
  'gm.hint': 'تلميح للمندسّ (اختياري)',
  'gm.done': 'خلصت — خبّيها',

  'reveal.passTo': 'مرّر التلفون لـ',
  'reveal.passGuide': 'عطي التلفون لـ{name}. تأكد إنو ما حدا تاني شايف الشاشة.',
  'reveal.show': 'أنا {name} — فرجيني',
  'reveal.crewGuide': 'احفظ هالكلمة. لما يجي دورك، قول كلمة وحدة بتبيّن إنك بتعرفها، بس بدون ما تفضحها.',
  'reveal.imposterTitle': 'إنت المندسّ!',
  'reveal.imposterGuide': 'ما بتعرف الكلمة. اسمع تلميحات الباقيين، اندمج معهم، وحاول تحزر شو هي.',
  'reveal.hint': 'تلميح: {hint}',
  'reveal.hidePass': 'خبّي ومرّر',

  'discussion.title': 'وقت النقاش',
  'discussion.guide': '{name} بيبلّش. كل واحد بيعطي تلميح بدوره، وبعدين تناقشوا وصوّتوا على مين مفكرينه المندسّ.',
  'discussion.imposters': {
    zero: 'ما في مندسّين',
    one: 'في مندسّ واحد بيناتكن',
    two: 'في مندسّين تنين بيناتكن',
    few: 'في {count} مندسّين بيناتكن',
    many: 'في {count} مندسّ بيناتكن',
    other: 'في {count} مندسّ بيناتكن',
  },
  'discussion.impostersHidden': 'كم مندسّ في؟ ما حدا بيعرف…',
  'discussion.timeUp': 'خلص الوقت!',
  'discussion.toVote': 'يلا نصوّت',
  'discussion.toReveal': 'اكشفوا المندسّ',

  'timer.minutesLeft': {
    one: 'باقي دقيقة وحدة',
    two: 'باقي دقيقتين',
    few: 'باقي {count} دقايق',
    other: 'باقي {count} دقيقة',
  },
  'timer.secondsLeft': {
    one: 'باقي ثانية وحدة',
    two: 'باقي ثانيتين',
    few: 'باقي {count} ثواني',
    other: 'باقي {count} ثانية',
  },

  'vote.title': 'مين طلّعتوا بالتصويت؟',
  'vote.nobody': 'ولا حدا',

  'guess.title': '{name} طلع مندسّ! إلو محاولة وحدة يحزر الكلمة — حزرها؟',
  'guess.yes': 'إي، حزرها',
  'guess.no': 'لأ، ما حزرها',

  'result.imposters': { one: 'المندسّ كان', other: 'المندسّين كانوا' },
  'result.word': 'الكلمة كانت',
  'result.category': 'الفئة: {category}',
  'result.crewWins': 'ربحت الجماعة!',
  'result.impostersWin': { one: 'ربح المندسّ!', other: 'ربحوا المندسّين!' },
  'result.nextRound': 'الجولة الجاية',
  'result.scores': 'النقاط',
  'result.points': {
    zero: '{count} نقطة',
    one: 'نقطة وحدة',
    two: 'نقطتين',
    few: '{count} نقاط',
    many: '{count} نقطة',
    other: '{count} نقطة',
  },

  'words.title': 'كلماتي',
  'words.empty': 'ما في كلمات خاصة بعد. الكلمات يلي بيكتبها الحَكَم بتطلع هون.',
  'words.builtIn': 'أساسية',
  'words.english': 'إنكليزي',
  'words.arabic': 'عربي',
  'words.word': 'الكلمة',
  'words.hint': 'التلميح',
  'words.name': 'الاسم',
  'words.deleteWordConfirm': 'أكيد بدك تحذف هالكلمة؟',
  'words.deleteCategoryConfirm': {
    zero: 'أكيد بدك تحذف هالفئة؟',
    one: 'أكيد بدك تحذف هالفئة؟ رح تنحذف معها كلمة وحدة.',
    two: 'أكيد بدك تحذف هالفئة؟ رح تنحذف معها كلمتين.',
    few: 'أكيد بدك تحذف هالفئة؟ رح تنحذف معها {count} كلمات.',
    other: 'أكيد بدك تحذف هالفئة؟ رح تنحذف معها {count} كلمة.',
  },

  'data.title': 'نسخ احتياطي واستيراد',
  'data.backupTip': 'اللاعبين والكلمات محفوظين بس عهالجهاز. اعمل نسخة احتياطية كل فترة.',
  'data.export': 'صدّر نسخة احتياطية',
  'data.importFile': 'استورد من ملف',
  'data.importUrl': 'استورد من رابط',
  'data.urlPlaceholder': 'https://…',
  'data.load': 'حمّل',
  'data.addsCategories': { one: 'بيزيد فئة وحدة', two: 'بيزيد فئتين', few: 'بيزيد {count} فئات', other: 'بيزيد {count} فئة' },
  'data.updatesCategories': { one: 'بيحدّث فئة وحدة', two: 'بيحدّث فئتين', few: 'بيحدّث {count} فئات', other: 'بيحدّث {count} فئة' },
  'data.addsWords': { one: 'بيزيد كلمة وحدة', two: 'بيزيد كلمتين', few: 'بيزيد {count} كلمات', other: 'بيزيد {count} كلمة' },
  'data.updatesWords': { one: 'بيحدّث كلمة وحدة', two: 'بيحدّث كلمتين', few: 'بيحدّث {count} كلمات', other: 'بيحدّث {count} كلمة' },
  'data.addsPlayers': { one: 'بيزيد لاعب واحد', two: 'بيزيد لاعبين تنين', few: 'بيزيد {count} لاعبين', other: 'بيزيد {count} لاعب' },
  'data.replacesSettings': 'بيستبدل الإعدادات تبعك',
  'data.skipsBuiltIn': {
    one: 'بيتجاهل عنصر أساسي واحد',
    two: 'بيتجاهل عنصرين أساسيين',
    few: 'بيتجاهل {count} عناصر أساسية',
    other: 'بيتجاهل {count} عنصر أساسي',
  },
  'data.overwriteNote': 'العناصر المحدّثة بتكتب فوق تعديلاتك عليها.',
  'data.nothing': 'ما في شي جديد للاستيراد.',
  'data.confirm': 'استورد',
  'data.imported': 'تم الاستيراد!',
  'data.problems': 'في مشاكل بالملف:',

  'fetch.invalidUrl': 'هاد ما بيشبه رابط',
  'fetch.httpsOnly': 'بس روابط https:// مسموحة',
  'fetch.offline': 'إنت مش متصل بالإنترنت',
  'fetch.network': 'ما قدرنا نوصل لهالرابط (يمكن السيرفر ما بيسمح بالوصول من مواقع تانية)',
  'fetch.timeout': 'الرابط طوّل كتير ليردّ',
  'fetch.httpStatus': 'السيرفر ردّ بخطأ {status}',
  'fetch.tooLarge': 'الملف كبير كتير (أقصى شي 1 ميغا)',
  'fetch.invalidJson': 'هاد مش ملف JSON صالح',

  'pack.badFormat': 'مش ملف تبع مين المندسّ',
  'pack.wrongType': 'نوع غلط',
  'pack.missing': 'ناقص',
  'pack.invalidId': 'معرّف غلط',
  'pack.empty': 'فاضي',
  'pack.tooLong': 'طويل كتير',
  'pack.unknownCategory': 'فئة مش معروفة',
  'pack.duplicateId': 'معرّف مكرّر',

  'storage.unavailable': 'ما فينا نحفظ عهالجهاز — التغييرات رح تروح لما تسكّر التطبيق.',
  'storage.corrupt': 'البيانات المحفوظة كانت خربانة ورجّعناها للأساس. خلّينا نسخة منها.',
  'storage.newer': 'هالبيانات محفوظة بنسخة أحدث من التطبيق. اعمل تحديث للصفحة.',

  'update.available': 'في نسخة جديدة — كبسة للتحديث',
}
```

- [ ] **Step 5: Implement `src/i18n/index.ts`**

```ts
import type { Lang } from '../engine/types'
import { en, type Messages } from './en'
import { ar } from './ar'

export type MessageKey = keyof Messages
export type Params = Record<string, string | number>

const dictionaries: Record<Lang, Messages> = { en, ar }
const LOCALES: Record<Lang, string> = { en: 'en', ar: 'ar-u-nu-latn' }
const FSI = '⁨'
const PDI = '⁩'

const pluralRules = new Map<Lang, Intl.PluralRules>()
const numberFormats = new Map<Lang, Intl.NumberFormat>()

function rulesFor(lang: Lang): Intl.PluralRules {
  let rules = pluralRules.get(lang)
  if (!rules) {
    rules = new Intl.PluralRules(LOCALES[lang])
    pluralRules.set(lang, rules)
  }
  return rules
}

export function formatNumber(n: number, lang: Lang): string {
  let format = numberFormats.get(lang)
  if (!format) {
    format = new Intl.NumberFormat(LOCALES[lang])
    numberFormats.set(lang, format)
  }
  return format.format(n)
}

/** Plain-text equivalent of <bdi>: keeps mixed-direction text from scrambling a sentence. */
export function isolate(text: string): string {
  return FSI + text + PDI
}

export function dirFor(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatList(items: readonly string[], lang: Lang): string {
  return new Intl.ListFormat(LOCALES[lang], { style: 'long', type: 'conjunction' }).format(items.map(isolate))
}

export function translate(lang: Lang, key: MessageKey, params: Params = {}): string {
  const message = dictionaries[lang][key]
  let template: string
  if (typeof message === 'string') {
    template = message
  } else {
    const count = params.count
    if (typeof count !== 'number') throw new Error(`i18n: "${key}" needs a numeric "count"`)
    template = message[rulesFor(lang).select(count)] ?? message.other
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`i18n: "${key}" is missing "{${name}}"`)
    return typeof value === 'number' ? formatNumber(value, lang) : isolate(value)
  })
}
```

- [ ] **Step 6: Run the tests and the type-check**

Run: `podman compose exec web bun test src/i18n`
Expected: `11 pass`, `0 fail`.

Run: `podman compose exec web bun run typecheck`
Expected: exits 0. This proves `ar` has every key of `en` with the right string/plural shape.

- [ ] **Step 7: Commit**

```bash
jj commit -m "feat(i18n): add typed English/Levantine Arabic dictionaries with plural and bidi handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Seed word packs

**Files:**
- Create: `src/data/seed/types.ts`, `src/data/seed/index.ts`
- Create: one file per pack under `src/data/seed/packs/`: `food.ts`, `animals.ts`, `home.ts`, `jobs.ts`, `places.ts`, `sports.ts`, `nature.ts`, `transport.ts`, `clothes.ts`, `levant.ts`
- Test: `src/data/seed/seed.test.ts`

**Interfaces:**
- Consumes: `Category`, `Word`, `Localized`, `LANGS` (Task 2); `LIMITS`, `textLength` (Task 3); `normalizeText` (Task 3).
- Produces:
  - `SeedRow = readonly [slug, en | null, ar | null, hintEn | null, hintAr | null]`
  - `SeedPack { id; name: Localized; rows: readonly SeedRow[] }`
  - `SEED_PACKS`, `SEED_CATEGORIES`, `SEED_WORDS`
  - `SEED_CATEGORY_IDS: ReadonlySet<string>`, `SEED_WORD_IDS: ReadonlySet<string>`
  - Word ids are `<packId>.<slug>`.

**Content rules** (spec §5.1):
- Each hint is a loosely related word that helps the imposter blend in; it is not a synonym.
- The Arabic is Levantine and colloquial where natural (بندورة، براد، شمسية). It is a draft for the user's review.

- [ ] **Step 1: Write the failing test `src/data/seed/seed.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { LANGS } from '../../engine/types'
import { LIMITS, textLength } from '../limits'
import { normalizeText } from '../normalize'
import { SEED_CATEGORIES, SEED_PACKS, SEED_WORDS } from './index'

describe('seed packs', () => {
  it('have unique, slug-style ids (the used-word history is keyed by them)', () => {
    const ids = SEED_WORDS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/)
    expect(new Set(SEED_CATEGORIES.map((c) => c.id)).size).toBe(SEED_CATEGORIES.length)
  })

  it('offer a healthy number of words per category', () => {
    expect(SEED_PACKS).toHaveLength(10)
    for (const pack of SEED_PACKS) expect(pack.rows.length).toBeGreaterThanOrEqual(20)
  })

  it('give every word a hint in each language it exists in, so the imposter hint always works', () => {
    for (const word of SEED_WORDS) {
      for (const lang of LANGS) {
        if (word.text[lang]) expect(word.hint[lang], `${word.id} hint.${lang}`).toBeTruthy()
      }
    }
  })

  it('stay within the length limits the app enforces on custom words', () => {
    for (const word of SEED_WORDS) {
      for (const lang of LANGS) {
        expect(textLength(word.text[lang] ?? '')).toBeLessThanOrEqual(LIMITS.word)
        expect(textLength(word.hint[lang] ?? '')).toBeLessThanOrEqual(LIMITS.hint)
      }
    }
    for (const c of SEED_CATEGORIES) {
      for (const lang of LANGS) expect(textLength(c.name[lang] ?? '')).toBeLessThanOrEqual(LIMITS.category)
    }
  })

  it('include an Arabic-only category of Levantine culture words', () => {
    const levant = SEED_PACKS.find((p) => p.id === 'levant')!
    expect(levant.name.en).toBeUndefined()
    for (const [, en, ar] of levant.rows) {
      expect(en).toBeNull()
      expect(ar).toBeTruthy()
    }
  })

  it('are otherwise fully bilingual, so English games get nine categories', () => {
    for (const pack of SEED_PACKS.filter((p) => p.id !== 'levant')) {
      expect(pack.name.en && pack.name.ar).toBeTruthy()
      for (const [slug, en, ar] of pack.rows) {
        expect(en, `${pack.id}.${slug} en`).toBeTruthy()
        expect(ar, `${pack.id}.${slug} ar`).toBeTruthy()
      }
    }
  })

  it('never hold two words a GM could not tell apart (same normalized text in one category)', () => {
    for (const pack of SEED_PACKS) {
      for (const lang of LANGS) {
        const keys = SEED_WORDS.filter((w) => w.categoryId === pack.id && w.text[lang]).map((w) => normalizeText(w.text[lang]!))
        expect(new Set(keys).size, `${pack.id}/${lang}`).toBe(keys.length)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test src/data/seed`
Expected: FAIL, `error: Cannot find module './index'`.

- [ ] **Step 3: Create `src/data/seed/types.ts` and `src/data/seed/index.ts`**

`src/data/seed/types.ts`:
```ts
import type { Localized } from '../../engine/types'

/** [slug, English word, Arabic word, English hint, Arabic hint] — null when a language is absent. */
export type SeedRow = readonly [slug: string, en: string | null, ar: string | null, hintEn: string | null, hintAr: string | null]

export interface SeedPack {
  id: string
  name: Localized
  rows: readonly SeedRow[]
}
```

`src/data/seed/index.ts`:
```ts
import type { Category, Localized, Word } from '../../engine/types'
import type { SeedPack } from './types'
import { food } from './packs/food'
import { animals } from './packs/animals'
import { home } from './packs/home'
import { jobs } from './packs/jobs'
import { places } from './packs/places'
import { sports } from './packs/sports'
import { nature } from './packs/nature'
import { transport } from './packs/transport'
import { clothes } from './packs/clothes'
import { levant } from './packs/levant'

export const SEED_PACKS: readonly SeedPack[] = [food, animals, home, jobs, places, sports, nature, transport, clothes, levant]

function localized(en: string | null, ar: string | null): Localized {
  const out: Localized = {}
  if (en) out.en = en
  if (ar) out.ar = ar
  return out
}

export const SEED_CATEGORIES: readonly Category[] = SEED_PACKS.map((p) => ({ id: p.id, name: p.name, builtIn: true }))

export const SEED_WORDS: readonly Word[] = SEED_PACKS.flatMap((p) =>
  p.rows.map(([slug, en, ar, hintEn, hintAr]) => ({
    id: `${p.id}.${slug}`,
    categoryId: p.id,
    builtIn: true,
    text: localized(en, ar),
    hint: localized(hintEn, hintAr),
  })),
)

export const SEED_CATEGORY_IDS: ReadonlySet<string> = new Set(SEED_CATEGORIES.map((c) => c.id))
export const SEED_WORD_IDS: ReadonlySet<string> = new Set(SEED_WORDS.map((w) => w.id))
```

- [ ] **Step 4: Create the ten pack files**

`src/data/seed/packs/food.ts`:
```ts
import type { SeedPack } from '../types'

export const food: SeedPack = {
  id: 'food',
  name: { en: 'Food & drinks', ar: 'أكل وشرب' },
  rows: [
    ['falafel', 'Falafel', 'فلافل', 'Fried', 'مقلي'],
    ['hummus', 'Hummus', 'حمّص', 'Dip', 'تغميسة'],
    ['pizza', 'Pizza', 'بيتزا', 'Italian', 'إيطالي'],
    ['burger', 'Burger', 'برغر', 'Bun', 'خبزة'],
    ['shawarma', 'Shawarma', 'شاورما', 'Sandwich', 'سندويشة'],
    ['ice-cream', 'Ice cream', 'بوظة', 'Cold', 'بارد'],
    ['chocolate', 'Chocolate', 'شوكولا', 'Sweet', 'حلو'],
    ['coffee', 'Coffee', 'قهوة', 'Morning', 'الصبح'],
    ['tea', 'Tea', 'شاي', 'Cup', 'كاسة'],
    ['lemonade', 'Lemonade', 'ليموناضة', 'Summer', 'صيف'],
    ['watermelon', 'Watermelon', 'بطيخ', 'Seeds', 'بزر'],
    ['banana', 'Banana', 'موز', 'Yellow', 'أصفر'],
    ['tomato', 'Tomato', 'بندورة', 'Red', 'أحمر'],
    ['cucumber', 'Cucumber', 'خيار', 'Salad', 'سلطة'],
    ['bread', 'Bread', 'خبز', 'Flour', 'طحين'],
    ['rice', 'Rice', 'رز', 'Grain', 'حبّ'],
    ['eggs', 'Eggs', 'بيض', 'Breakfast', 'فطور'],
    ['cheese', 'Cheese', 'جبنة', 'Milk', 'حليب'],
    ['soup', 'Soup', 'شوربة', 'Spoon', 'معلقة'],
    ['popcorn', 'Popcorn', 'بوشار', 'Cinema', 'سينما'],
    ['cake', 'Cake', 'كاتو', 'Birthday', 'عيد ميلاد'],
    ['honey', 'Honey', 'عسل', 'Bees', 'نحل'],
    ['orange-juice', 'Orange juice', 'عصير برتقال', 'Fresh', 'طازة'],
    ['french-fries', 'French fries', 'بطاطا مقلية', 'Ketchup', 'كاتشب'],
    ['grapes', 'Grapes', 'عنب', 'Vine', 'دالية'],
  ],
}
```

`src/data/seed/packs/animals.ts`:
```ts
import type { SeedPack } from '../types'

export const animals: SeedPack = {
  id: 'animals',
  name: { en: 'Animals', ar: 'حيوانات' },
  rows: [
    ['cat', 'Cat', 'بسّة', 'Meow', 'مياو'],
    ['dog', 'Dog', 'كلب', 'Bark', 'نباح'],
    ['lion', 'Lion', 'أسد', 'King', 'ملك'],
    ['elephant', 'Elephant', 'فيل', 'Trunk', 'خرطوم'],
    ['monkey', 'Monkey', 'قرد', 'Banana', 'موز'],
    ['horse', 'Horse', 'حصان', 'Ride', 'ركوب'],
    ['donkey', 'Donkey', 'حمار', 'Stubborn', 'عنيد'],
    ['camel', 'Camel', 'جمل', 'Desert', 'صحرا'],
    ['chicken', 'Chicken', 'جاجة', 'Farm', 'مزرعة'],
    ['cow', 'Cow', 'بقرة', 'Milk', 'حليب'],
    ['sheep', 'Sheep', 'خاروف', 'Wool', 'صوف'],
    ['fish', 'Fish', 'سمكة', 'Water', 'مي'],
    ['shark', 'Shark', 'قرش', 'Teeth', 'سنان'],
    ['snake', 'Snake', 'حيّة', 'Hiss', 'فحيح'],
    ['frog', 'Frog', 'ضفدعة', 'Jump', 'نطّ'],
    ['butterfly', 'Butterfly', 'فراشة', 'Wings', 'جوانح'],
    ['bee', 'Bee', 'نحلة', 'Honey', 'عسل'],
    ['owl', 'Owl', 'بومة', 'Night', 'ليل'],
    ['penguin', 'Penguin', 'بطريق', 'Ice', 'تلج'],
    ['giraffe', 'Giraffe', 'زرافة', 'Tall', 'طويل'],
    ['rabbit', 'Rabbit', 'أرنب', 'Carrot', 'جزرة'],
    ['mouse', 'Mouse', 'فارة', 'Cheese', 'جبنة'],
    ['turtle', 'Turtle', 'سلحفة', 'Slow', 'بطيء'],
    ['bear', 'Bear', 'دبّ', 'Forest', 'غابة'],
    ['parrot', 'Parrot', 'ببغا', 'Talk', 'حكي'],
  ],
}
```

`src/data/seed/packs/home.ts`:
```ts
import type { SeedPack } from '../types'

export const home: SeedPack = {
  id: 'home',
  name: { en: 'Around the house', ar: 'أغراض البيت' },
  rows: [
    ['sofa', 'Sofa', 'كنباية', 'Living room', 'صالون'],
    ['bed', 'Bed', 'تخت', 'Sleep', 'نوم'],
    ['fridge', 'Fridge', 'براد', 'Cold', 'بارد'],
    ['oven', 'Oven', 'فرن', 'Bake', 'خبيز'],
    ['washing-machine', 'Washing machine', 'غسالة', 'Clothes', 'تياب'],
    ['tv', 'TV', 'تلفزيون', 'Remote', 'ريموت'],
    ['mirror', 'Mirror', 'مراية', 'Reflection', 'انعكاس'],
    ['pillow', 'Pillow', 'مخدّة', 'Soft', 'ناعم'],
    ['blanket', 'Blanket', 'حرام', 'Warm', 'دافي'],
    ['lamp', 'Lamp', 'أباجورة', 'Light', 'ضو'],
    ['door', 'Door', 'باب', 'Key', 'مفتاح'],
    ['window', 'Window', 'شبّاك', 'Glass', 'قزاز'],
    ['stairs', 'Stairs', 'درج', 'Up', 'فوق'],
    ['carpet', 'Carpet', 'سجّادة', 'Floor', 'أرض'],
    ['clock', 'Clock', 'ساعة', 'Time', 'وقت'],
    ['toothbrush', 'Toothbrush', 'فرشاية سنان', 'Bathroom', 'حمّام'],
    ['towel', 'Towel', 'منشفة', 'Shower', 'دوش'],
    ['broom', 'Broom', 'مكنسة', 'Dust', 'غبرة'],
    ['chair', 'Chair', 'كرسي', 'Table', 'طاولة'],
    ['fan', 'Fan', 'مروحة', 'Summer', 'صيف'],
    ['kettle', 'Kettle', 'غلّاية', 'Boil', 'غلي'],
    ['plate', 'Plate', 'صحن', 'Dinner', 'عشا'],
    ['spoon', 'Spoon', 'معلقة', 'Soup', 'شوربة'],
    ['charger', 'Charger', 'شاحن', 'Battery', 'بطارية'],
    ['balcony', 'Balcony', 'برندة', 'View', 'منظر'],
  ],
}
```

`src/data/seed/packs/jobs.ts`:
```ts
import type { SeedPack } from '../types'

export const jobs: SeedPack = {
  id: 'jobs',
  name: { en: 'Jobs', ar: 'مهن' },
  rows: [
    ['doctor', 'Doctor', 'دكتور', 'Hospital', 'مستشفى'],
    ['teacher', 'Teacher', 'أستاذ', 'School', 'مدرسة'],
    ['chef', 'Chef', 'شيف', 'Kitchen', 'مطبخ'],
    ['police', 'Police officer', 'شرطي', 'Law', 'قانون'],
    ['firefighter', 'Firefighter', 'إطفائي', 'Ladder', 'سلّم'],
    ['pilot', 'Pilot', 'طيّار', 'Sky', 'سما'],
    ['farmer', 'Farmer', 'فلّاح', 'Tractor', 'تراكتور'],
    ['barber', 'Barber', 'حلّاق', 'Scissors', 'مقص'],
    ['dentist', 'Dentist', 'دكتور سنان', 'Smile', 'ابتسامة'],
    ['mechanic', 'Mechanic', 'ميكانيكي', 'Car', 'سيارة'],
    ['baker', 'Baker', 'فرّان', 'Dough', 'عجين'],
    ['taxi-driver', 'Taxi driver', 'شوفير تاكسي', 'Meter', 'عدّاد'],
    ['photographer', 'Photographer', 'مصوّر', 'Camera', 'كاميرا'],
    ['singer', 'Singer', 'مغنّي', 'Microphone', 'مايك'],
    ['actor', 'Actor', 'ممثّل', 'Stage', 'مسرح'],
    ['nurse', 'Nurse', 'ممرّض', 'Injection', 'إبرة'],
    ['lawyer', 'Lawyer', 'محامي', 'Court', 'محكمة'],
    ['engineer', 'Engineer', 'مهندس', 'Plans', 'خرايط'],
    ['plumber', 'Plumber', 'سمكري', 'Pipes', 'قساطل'],
    ['electrician', 'Electrician', 'كهربجي', 'Wires', 'شرطان'],
    ['carpenter', 'Carpenter', 'نجّار', 'Wood', 'خشب'],
    ['tailor', 'Tailor', 'خيّاط', 'Thread', 'خيطان'],
    ['astronaut', 'Astronaut', 'رائد فضاء', 'Moon', 'قمر'],
    ['waiter', 'Waiter', 'جرسون', 'Tray', 'صينية'],
    ['postman', 'Postman', 'ساعي بريد', 'Letter', 'رسالة'],
  ],
}
```

`src/data/seed/packs/places.ts`:
```ts
import type { SeedPack } from '../types'

export const places: SeedPack = {
  id: 'places',
  name: { en: 'Places', ar: 'أماكن' },
  rows: [
    ['beach', 'Beach', 'البحر', 'Sand', 'رمل'],
    ['hospital', 'Hospital', 'مستشفى', 'Ambulance', 'إسعاف'],
    ['school', 'School', 'مدرسة', 'Homework', 'وظيفة'],
    ['airport', 'Airport', 'مطار', 'Passport', 'باسبور'],
    ['supermarket', 'Supermarket', 'سوبرماركت', 'Cart', 'عرباية'],
    ['cinema', 'Cinema', 'سينما', 'Popcorn', 'بوشار'],
    ['restaurant', 'Restaurant', 'مطعم', 'Menu', 'منيو'],
    ['mosque', 'Mosque', 'جامع', 'Prayer', 'صلاة'],
    ['church', 'Church', 'كنيسة', 'Bells', 'جرس'],
    ['park', 'Park', 'جنينة', 'Swings', 'مراجيح'],
    ['library', 'Library', 'مكتبة', 'Books', 'كتب'],
    ['gym', 'Gym', 'جيم', 'Muscles', 'عضلات'],
    ['zoo', 'Zoo', 'حديقة حيوانات', 'Cages', 'أقفاص'],
    ['bank', 'Bank', 'بنك', 'Money', 'مصاري'],
    ['pharmacy', 'Pharmacy', 'صيدلية', 'Medicine', 'دوا'],
    ['mountain', 'Mountain', 'جبل', 'Snow', 'تلج'],
    ['museum', 'Museum', 'متحف', 'History', 'تاريخ'],
    ['stadium', 'Stadium', 'ملعب', 'Fans', 'جمهور'],
    ['hotel', 'Hotel', 'أوتيل', 'Room', 'غرفة'],
    ['swimming-pool', 'Swimming pool', 'مسبح', 'Diving', 'غطس'],
    ['prison', 'Prison', 'حبس', 'Guard', 'حارس'],
    ['wedding-hall', 'Wedding hall', 'صالة أعراس', 'Dance', 'رقص'],
    ['gas-station', 'Gas station', 'محطة بنزين', 'Car', 'سيارة'],
    ['bakery', 'Bakery', 'فرن', 'Bread', 'خبز'],
    ['amusement-park', 'Amusement park', 'مدينة ملاهي', 'Rides', 'ألعاب'],
  ],
}
```

`src/data/seed/packs/sports.ts`:
```ts
import type { SeedPack } from '../types'

export const sports: SeedPack = {
  id: 'sports',
  name: { en: 'Sports & games', ar: 'رياضة وألعاب' },
  rows: [
    ['football', 'Football', 'فوتبول', 'Goal', 'غول'],
    ['basketball', 'Basketball', 'باسكيت', 'Hoop', 'سلّة'],
    ['tennis', 'Tennis', 'تنس', 'Racket', 'مضرب'],
    ['swimming', 'Swimming', 'سباحة', 'Pool', 'مسبح'],
    ['boxing', 'Boxing', 'ملاكمة', 'Gloves', 'كفوف'],
    ['chess', 'Chess', 'شطرنج', 'King', 'ملك'],
    ['cards', 'Playing cards', 'شدّة', 'Ace', 'آس'],
    ['backgammon', 'Backgammon', 'طاولة زهر', 'Dice', 'زهر'],
    ['running', 'Running', 'ركض', 'Marathon', 'ماراتون'],
    ['bicycle', 'Bicycle', 'بسكليت', 'Pedals', 'دواسات'],
    ['volleyball', 'Volleyball', 'فولي', 'Net', 'شبكة'],
    ['skiing', 'Skiing', 'تزلّج', 'Snow', 'تلج'],
    ['karate', 'Karate', 'كاراتيه', 'Belt', 'زنّار'],
    ['hide-and-seek', 'Hide and seek', 'غمّيضة', 'Count', 'عدّ'],
    ['ping-pong', 'Ping pong', 'بينغ بونغ', 'Small ball', 'طابة صغيرة'],
    ['golf', 'Golf', 'غولف', 'Hole', 'جورة'],
    ['video-games', 'Video games', 'بلايستيشن', 'Screen', 'شاشة'],
    ['horse-riding', 'Horse riding', 'ركوب خيل', 'Saddle', 'سرج'],
    ['fishing', 'Fishing', 'صيد سمك', 'Rod', 'صنّارة'],
    ['dominoes', 'Dominoes', 'دومينو', 'Dots', 'نقط'],
    ['bowling', 'Bowling', 'بولينغ', 'Strike', 'سترايك'],
    ['wrestling', 'Wrestling', 'مصارعة', 'Ring', 'حلبة'],
    ['jump-rope', 'Jump rope', 'نطّ الحبلة', 'Playground', 'ملعب'],
    ['darts', 'Darts', 'سهام', 'Target', 'هدف'],
    ['marbles', 'Marbles', 'كلل', 'Glass', 'قزاز'],
  ],
}
```

`src/data/seed/packs/nature.ts`:
```ts
import type { SeedPack } from '../types'

export const nature: SeedPack = {
  id: 'nature',
  name: { en: 'Nature & weather', ar: 'طبيعة وطقس' },
  rows: [
    ['rain', 'Rain', 'شتي', 'Umbrella', 'شمسية'],
    ['snow', 'Snow', 'تلج', 'White', 'أبيض'],
    ['sun', 'Sun', 'شمس', 'Hot', 'شوب'],
    ['moon', 'Moon', 'قمر', 'Night', 'ليل'],
    ['stars', 'Stars', 'نجوم', 'Sky', 'سما'],
    ['rainbow', 'Rainbow', 'قوس قزح', 'Colors', 'ألوان'],
    ['thunder', 'Thunder', 'رعد', 'Loud', 'صوت عالي'],
    ['wind', 'Wind', 'هوا', 'Kite', 'طيّارة ورق'],
    ['cloud', 'Cloud', 'غيمة', 'Grey', 'رمادي'],
    ['volcano', 'Volcano', 'بركان', 'Lava', 'حمم'],
    ['desert', 'Desert', 'صحرا', 'Camel', 'جمل'],
    ['forest', 'Forest', 'غابة', 'Trees', 'شجر'],
    ['river', 'River', 'نهر', 'Bridge', 'جسر'],
    ['ocean', 'Ocean', 'محيط', 'Waves', 'موج'],
    ['flower', 'Flower', 'وردة', 'Smell', 'ريحة'],
    ['tree', 'Tree', 'شجرة', 'Leaves', 'ورق'],
    ['cave', 'Cave', 'مغارة', 'Dark', 'عتمة'],
    ['island', 'Island', 'جزيرة', 'Palm tree', 'نخلة'],
    ['waterfall', 'Waterfall', 'شلّال', 'Height', 'علو'],
    ['earthquake', 'Earthquake', 'هزّة أرضية', 'Cracks', 'شقوق'],
    ['fog', 'Fog', 'ضباب', 'Driving', 'سواقة'],
    ['lightning', 'Lightning', 'برق', 'Storm', 'عاصفة'],
    ['rock', 'Rock', 'صخرة', 'Heavy', 'تقيل'],
    ['sunset', 'Sunset', 'غروب', 'Orange', 'برتقاني'],
    ['mud', 'Mud', 'وحل', 'Boots', 'جزمة'],
  ],
}
```

`src/data/seed/packs/transport.ts`:
```ts
import type { SeedPack } from '../types'

export const transport: SeedPack = {
  id: 'transport',
  name: { en: 'Getting around', ar: 'مواصلات' },
  rows: [
    ['car', 'Car', 'سيارة', 'Wheel', 'دولاب'],
    ['bus', 'Bus', 'باص', 'Stop', 'موقف'],
    ['plane', 'Plane', 'طيارة', 'Wings', 'جوانح'],
    ['train', 'Train', 'قطار', 'Rails', 'سكّة'],
    ['boat', 'Boat', 'قارب', 'Sea', 'بحر'],
    ['motorcycle', 'Motorcycle', 'موتور', 'Helmet', 'خوذة'],
    ['taxi', 'Taxi', 'تاكسي', 'Yellow', 'أصفر'],
    ['helicopter', 'Helicopter', 'هليكوبتر', 'Propeller', 'مروحة'],
    ['ship', 'Ship', 'باخرة', 'Port', 'مرفأ'],
    ['metro', 'Metro', 'مترو', 'Underground', 'تحت الأرض'],
    ['truck', 'Truck', 'كميون', 'Heavy', 'تقيل'],
    ['ambulance', 'Ambulance', 'إسعاف', 'Siren', 'سيرينا'],
    ['scooter', 'Scooter', 'سكوتر', 'Kids', 'ولاد'],
    ['rocket', 'Rocket', 'صاروخ', 'Space', 'فضا'],
    ['hot-air-balloon', 'Hot air balloon', 'منطاد', 'Basket', 'سلّة'],
    ['skateboard', 'Skateboard', 'سكيتبورد', 'Tricks', 'حركات'],
    ['cable-car', 'Cable car', 'تلفريك', 'Mountain', 'جبل'],
    ['submarine', 'Submarine', 'غوّاصة', 'Deep', 'غميق'],
    ['tractor', 'Tractor', 'تراكتور', 'Farm', 'مزرعة'],
    ['carriage', 'Carriage', 'عربة', 'Horse', 'حصان'],
    ['shared-taxi', 'Shared taxi', 'سرفيس', 'Shared', 'مشترك'],
    ['jet-ski', 'Jet ski', 'جت سكي', 'Waves', 'موج'],
    ['fire-truck', 'Fire truck', 'سيارة إطفاء', 'Hose', 'خرطوم'],
    ['parachute', 'Parachute', 'باراشوت', 'Jump', 'نطّة'],
    ['roller-skates', 'Roller skates', 'باتيناج', 'Wheels', 'دواليب'],
  ],
}
```

`src/data/seed/packs/clothes.ts`:
```ts
import type { SeedPack } from '../types'

export const clothes: SeedPack = {
  id: 'clothes',
  name: { en: 'Clothes & accessories', ar: 'تياب وإكسسوارات' },
  rows: [
    ['shirt', 'Shirt', 'قميص', 'Buttons', 'زرار'],
    ['trousers', 'Trousers', 'بنطلون', 'Pockets', 'جيوب'],
    ['dress', 'Dress', 'فستان', 'Party', 'حفلة'],
    ['shoes', 'Shoes', 'صبّاط', 'Walk', 'مشي'],
    ['hat', 'Hat', 'برنيطة', 'Head', 'راس'],
    ['socks', 'Socks', 'كلسات', 'Feet', 'إجرين'],
    ['jacket', 'Jacket', 'جاكيت', 'Zipper', 'سحّاب'],
    ['scarf', 'Scarf', 'لفحة', 'Neck', 'رقبة'],
    ['gloves', 'Gloves', 'كفوف', 'Hands', 'إيدين'],
    ['sunglasses', 'Sunglasses', 'نضّارات شمس', 'Beach', 'بحر'],
    ['watch', 'Watch', 'ساعة إيد', 'Wrist', 'معصم'],
    ['ring', 'Ring', 'خاتم', 'Wedding', 'عرس'],
    ['necklace', 'Necklace', 'عقد', 'Gold', 'دهب'],
    ['pajamas', 'Pajamas', 'بيجاما', 'Bedtime', 'وقت النوم'],
    ['swimsuit', 'Swimsuit', 'مايوه', 'Pool', 'مسبح'],
    ['belt', 'Belt', 'زنّار', 'Buckle', 'بكلة'],
    ['tie', 'Tie', 'كرافات', 'Suit', 'بدلة'],
    ['boots', 'Boots', 'جزمة', 'Mud', 'وحل'],
    ['sandals', 'Sandals', 'صندل', 'Summer', 'صيف'],
    ['slippers', 'Slippers', 'شحّاطة', 'Home', 'بيت'],
    ['earrings', 'Earrings', 'حلق', 'Ears', 'دينين'],
    ['backpack', 'Backpack', 'شنطة ضهر', 'School', 'مدرسة'],
    ['cap', 'Cap', 'كاب', 'Baseball', 'بيسبول'],
    ['hoodie', 'Hoodie', 'هودي', 'Cozy', 'دافي'],
    ['wallet', 'Wallet', 'جزدان', 'Money', 'مصاري'],
  ],
}
```

`src/data/seed/packs/levant.ts`:
```ts
import type { SeedPack } from '../types'

/** Arabic-only culture words — deliberately no English, to exercise flexible pairs (spec §5.1). */
export const levant: SeedPack = {
  id: 'levant',
  name: { ar: 'من عنّا' },
  rows: [
    ['manaeesh', null, 'مناقيش', null, 'زعتر'],
    ['kibbeh', null, 'كبّة', null, 'برغل'],
    ['tabbouleh', null, 'تبّولة', null, 'بقدونس'],
    ['fattoush', null, 'فتّوش', null, 'خبز مقمّر'],
    ['mjaddara', null, 'مجدّرة', null, 'عدس'],
    ['maamoul', null, 'معمول', null, 'عيد'],
    ['knafeh', null, 'كنافة', null, 'جبنة'],
    ['dabke', null, 'دبكة', null, 'عرس'],
    ['argileh', null, 'أركيلة', null, 'فحم'],
    ['tarboush', null, 'طربوش', null, 'راس'],
    ['oud', null, 'عود', null, 'أوتار'],
    ['darbuka', null, 'دربكة', null, 'إيقاع'],
    ['labneh', null, 'لبنة', null, 'زيت زيتون'],
    ['arabic-coffee', null, 'قهوة عربية', null, 'دلّة'],
    ['sahlab', null, 'سحلب', null, 'قرفة'],
    ['kaak', null, 'كعك', null, 'سمسم'],
    ['mouneh', null, 'مونة', null, 'مرطبانات'],
    ['hakawati', null, 'حكواتي', null, 'قصص'],
    ['souk', null, 'سوق', null, 'بسطة'],
    ['foul', null, 'فول مدمّس', null, 'كمّون'],
    ['mahshi', null, 'محشي', null, 'كوسا'],
    ['zajal', null, 'زجل', null, 'شعر'],
    ['zalghouta', null, 'زلغوطة', null, 'فرح'],
    ['pomegranate-molasses', null, 'دبس رمان', null, 'حامض'],
    ['fairuz', null, 'فيروز', null, 'الصبح'],
  ],
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `podman compose exec web bun test src/data/seed`
Expected: `7 pass`, `0 fail`. If "never hold two words a GM could not tell apart" fails, the message names the pack and language. Replace one of the colliding words; do not weaken the test.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(data): add bilingual seed packs and an Arabic-only Levantine pack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Persistent storage

**Files:**
- Create: `src/data/storage.ts`
- Test: `src/data/storage.test.ts`

**Interfaces:**
- Consumes: `Category`, `Word`, `Player`, `Settings`, `Lang`, `LANGS`, `RoundState` (Task 2); `SEED_CATEGORIES` (Task 9); `TIMER` (Task 3).
- Produces:
  - Constants: `STORAGE_KEY = 'fennas-imposter'`, `CURRENT_VERSION = 1`
  - Interfaces:
    - `StorageLike { getItem(k): string | null; setItem(k, v): void }`
    - `SessionScore { name; points }`
    - `Session { scores: Record<string, SessionScore>; rounds: number }`
    - `Stored` (spec §8)
    - `LoadResult { stored; status; canSave }`
  - Types:
    - `LoadStatus = 'ok' | 'fresh' | 'corrupt' | 'newer' | 'unavailable'`
    - `Migration = (doc: Record<string, unknown>) => Record<string, unknown>`
  - Functions:
    - `defaultSettings(): Settings`, `defaultStored(): Stored`
    - `upgrade(doc, migrations, target)`
    - `isStored(x): x is Stored`
    - `loadStored(storage: StorageLike | null, now: number): LoadResult`
    - `saveStored(storage, stored): boolean`
    - `browserStorage(): StorageLike | null`
    - `memoryStorage(initial?)`, which returns `StorageLike & { dump(): Record<string, string> }`

- [ ] **Step 1: Write the failing test `src/data/storage.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { SEED_CATEGORIES } from './seed'
import {
  STORAGE_KEY, defaultStored, loadStored, memoryStorage, saveStored, upgrade, type StorageLike,
} from './storage'

describe('loadStored', () => {
  it('starts fresh with every built-in category selected on first run', () => {
    const r = loadStored(memoryStorage(), 1)
    expect(r.status).toBe('fresh')
    expect(r.canSave).toBe(true)
    expect(r.stored.selectedCategoryIds).toEqual(SEED_CATEGORIES.map((c) => c.id))
    expect(r.stored.settings.scoring).toBe(false)
    expect(r.stored.settings.hints).toBe(true)
  })

  it('reads back exactly what was saved', () => {
    const storage = memoryStorage()
    const doc = defaultStored()
    doc.players = [{ id: 'p1', name: 'Rami' }]
    doc.language = 'ar'
    expect(saveStored(storage, doc)).toBe(true)
    const r = loadStored(storage, 1)
    expect(r.status).toBe('ok')
    expect(r.stored).toEqual(doc)
  })

  it('backs up damaged data instead of silently throwing it away', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' })
    const r = loadStored(storage, 1234)
    expect(r.status).toBe('corrupt')
    expect(r.canSave).toBe(true)
    expect(r.stored).toEqual(defaultStored())
    expect(storage.dump()[`${STORAGE_KEY}:corrupt:1234`]).toBe('{not json')
  })

  it('treats valid JSON with the wrong shape as damaged too', () => {
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, players: 'nope' }) }), 1)
    expect(r.status).toBe('corrupt')
  })

  it('never overwrites data written by a newer app version', () => {
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99 }) }), 1)
    expect(r.status).toBe('newer')
    expect(r.canSave).toBe(false)
  })

  it('reports storage that throws (e.g. blocked in private mode) as unavailable', () => {
    const throwing: StorageLike = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
    }
    expect(loadStored(throwing, 1)).toMatchObject({ status: 'unavailable', canSave: false })
    expect(loadStored(null, 1)).toMatchObject({ status: 'unavailable', canSave: false })
  })
})

describe('saveStored', () => {
  it('returns false when the write fails (quota full), so the app can warn', () => {
    const full: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(saveStored(full, defaultStored())).toBe(false)
  })
})

describe('upgrade', () => {
  it('applies migrations in order so old documents are usable', () => {
    const migrations = {
      0: (d: Record<string, unknown>) => ({ ...d, version: 1, a: 1 }),
      1: (d: Record<string, unknown>) => ({ ...d, version: 2, b: 2 }),
    }
    expect(upgrade({ version: 0 }, migrations, 2)).toEqual({ version: 2, a: 1, b: 2 })
  })

  it('throws when a migration step is missing rather than guessing', () => {
    expect(() => upgrade({ version: 0 }, {}, 1)).toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/data/storage.test.ts`
Expected: FAIL, `error: Cannot find module './storage'`.

- [ ] **Step 3: Implement `src/data/storage.ts`**

```ts
import { LANGS, type Category, type Lang, type Player, type RoundState, type Settings, type Word } from '../engine/types'
import { SEED_CATEGORIES } from './seed'
import { TIMER } from './limits'

export const STORAGE_KEY = 'fennas-imposter'
export const CURRENT_VERSION = 1

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SessionScore {
  name: string
  points: number
}

export interface Session {
  scores: Record<string, SessionScore>
  rounds: number
}

export interface Stored {
  version: 1
  language: Lang
  players: Player[]
  activePlayerIds: string[]
  settings: Settings
  selectedCategoryIds: string[]
  customCategories: Category[]
  customWords: Word[]
  usedWordIds: Record<Lang, string[]>
  lastImportUrl: string | null
  session: Session | null
  round: RoundState | null
}

export type LoadStatus = 'ok' | 'fresh' | 'corrupt' | 'newer' | 'unavailable'

export interface LoadResult {
  stored: Stored
  status: LoadStatus
  canSave: boolean
}

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] upgrades a version-n document to version n+1. Empty until version 2 exists. */
export const MIGRATIONS: Record<number, Migration> = {}

export function defaultSettings(): Settings {
  return {
    imposterCount: 1,
    randomImposterCount: false,
    hints: true,
    timer: { enabled: false, seconds: TIMER.default },
    scoring: false,
  }
}

export function defaultStored(): Stored {
  return {
    version: 1,
    language: 'en',
    players: [],
    activePlayerIds: [],
    settings: defaultSettings(),
    selectedCategoryIds: SEED_CATEGORIES.map((c) => c.id),
    customCategories: [],
    customWords: [],
    usedWordIds: { en: [], ar: [] },
    lastImportUrl: null,
    session: null,
    round: null,
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function upgrade(
  doc: Record<string, unknown>,
  migrations: Record<number, Migration>,
  target: number,
): Record<string, unknown> {
  let current = doc
  while (typeof current.version === 'number' && current.version < target) {
    const step = migrations[current.version]
    if (!step) throw new Error(`No migration from version ${current.version}`)
    current = step(current)
  }
  return current
}

function isSettings(x: unknown): x is Settings {
  return (
    isRecord(x) &&
    typeof x.imposterCount === 'number' &&
    typeof x.randomImposterCount === 'boolean' &&
    typeof x.hints === 'boolean' &&
    typeof x.scoring === 'boolean' &&
    isRecord(x.timer) &&
    typeof x.timer.enabled === 'boolean' &&
    typeof x.timer.seconds === 'number'
  )
}

/** Structural check of our own document. Deep round contents are trusted (we wrote them). */
export function isStored(x: unknown): x is Stored {
  return (
    isRecord(x) &&
    x.version === CURRENT_VERSION &&
    LANGS.includes(x.language as Lang) &&
    Array.isArray(x.players) &&
    Array.isArray(x.activePlayerIds) &&
    isSettings(x.settings) &&
    Array.isArray(x.selectedCategoryIds) &&
    Array.isArray(x.customCategories) &&
    Array.isArray(x.customWords) &&
    isRecord(x.usedWordIds) &&
    LANGS.every((l) => Array.isArray((x.usedWordIds as Record<string, unknown>)[l])) &&
    (x.lastImportUrl === null || typeof x.lastImportUrl === 'string') &&
    (x.session === null || isRecord(x.session)) &&
    (x.round === null || isRecord(x.round))
  )
}

function corrupt(storage: StorageLike, raw: string, now: number): LoadResult {
  try {
    storage.setItem(`${STORAGE_KEY}:corrupt:${now}`, raw)
  } catch {
    // Backup is best-effort; the notice still tells the user something was reset.
  }
  return { stored: defaultStored(), status: 'corrupt', canSave: true }
}

export function loadStored(storage: StorageLike | null, now: number): LoadResult {
  const unavailable: LoadResult = { stored: defaultStored(), status: 'unavailable', canSave: false }
  if (!storage) return unavailable
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return unavailable
  }
  if (raw === null) return { stored: defaultStored(), status: 'fresh', canSave: true }

  let doc: unknown
  try {
    doc = JSON.parse(raw)
  } catch {
    return corrupt(storage, raw, now)
  }
  if (!isRecord(doc) || typeof doc.version !== 'number') return corrupt(storage, raw, now)
  if (doc.version > CURRENT_VERSION) return { stored: defaultStored(), status: 'newer', canSave: false }
  try {
    doc = upgrade(doc, MIGRATIONS, CURRENT_VERSION)
  } catch {
    return corrupt(storage, raw, now)
  }
  if (!isStored(doc)) return corrupt(storage, raw, now)
  return { stored: doc, status: 'ok', canSave: true }
}

export function saveStored(storage: StorageLike | null, stored: Stored): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage
    const probe = `${STORAGE_KEY}:probe`
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function memoryStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    dump: () => Object.fromEntries(data),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/data/storage.test.ts`
Expected: `9 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(data): add versioned localStorage persistence with corrupt/newer/unavailable handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Roster operations

**Files:**
- Create: `src/data/roster.ts`
- Test: `src/data/roster.test.ts`

**Interfaces:**
- Consumes: `Player` (Task 2); `cleanText`, `normalizeText` (Task 3); `LIMITS`, `textLength` (Task 3).
- Produces:
  - `interface Roster { players: Player[]; activePlayerIds: string[] }`
  - `type NameError = 'empty' | 'tooLong' | 'taken'`
  - `type RosterResult = { ok: true; roster: Roster } | { ok: false; error: NameError }`
  - `validateName(name, players, exceptId?): NameError | null`
  - `addPlayer(roster, name, newId: () => string): RosterResult`, which marks the new player active
  - `renamePlayer(roster, id, name): RosterResult`
  - `removePlayer(roster, id): Roster`
  - `setActive(roster, id, active): Roster`

- [ ] **Step 1: Write the failing test `src/data/roster.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { addPlayer, removePlayer, renamePlayer, setActive, validateName, type Roster } from './roster'

const empty: Roster = { players: [], activePlayerIds: [] }
let n = 0
const newId = () => `id${++n}`

function rosterOf(...names: string[]): Roster {
  let r = empty
  for (const name of names) {
    const res = addPlayer(r, name, newId)
    if (!res.ok) throw new Error(res.error)
    r = res.roster
  }
  return r
}

describe('roster', () => {
  it('adds players as active (tonight’s players are usually the ones just typed)', () => {
    const r = rosterOf('Rami', 'Lina')
    expect(r.players.map((p) => p.name)).toEqual(['Rami', 'Lina'])
    expect(r.activePlayerIds).toEqual(r.players.map((p) => p.id))
  })

  it('stores names cleaned but with their original spelling', () => {
    expect(rosterOf('  أحمد   علي ').players[0].name).toBe('أحمد علي')
  })

  it('rejects names that differ only by case, spacing or Arabic spelling, so players stay distinguishable', () => {
    const r = rosterOf('Rami', 'أحمد')
    expect(validateName(' rami ', r.players)).toBe('taken')
    expect(validateName('احمد', r.players)).toBe('taken')
    expect(validateName('Rania', r.players)).toBeNull()
  })

  it('rejects empty and over-long names', () => {
    expect(validateName('   ', [])).toBe('empty')
    expect(validateName('a'.repeat(21), [])).toBe('tooLong')
    expect(validateName('a'.repeat(20), [])).toBeNull()
  })

  it('lets a player fix the case of their own name', () => {
    const r = rosterOf('rami')
    const res = renamePlayer(r, r.players[0].id, 'Rami')
    expect(res.ok && res.roster.players[0].name).toBe('Rami')
  })

  it('removing a player also removes them from tonight’s players', () => {
    const r = rosterOf('Rami', 'Lina')
    const out = removePlayer(r, r.players[0].id)
    expect(out.players.map((p) => p.name)).toEqual(['Lina'])
    expect(out.activePlayerIds).toEqual([r.players[1].id])
  })

  it('setActive keeps roster order (the pass order) and ignores unknown ids', () => {
    const r = rosterOf('A', 'B', 'C')
    const [a, b, c] = r.players.map((p) => p.id)
    let out = setActive(r, b, false)
    out = setActive(out, 'ghost', true)
    out = setActive(out, b, true)
    expect(out.activePlayerIds).toEqual([a, b, c])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/data/roster.test.ts`
Expected: FAIL, `error: Cannot find module './roster'`.

- [ ] **Step 3: Implement `src/data/roster.ts`**

```ts
import type { Player } from '../engine/types'
import { cleanText, normalizeText } from './normalize'
import { LIMITS, textLength } from './limits'

export interface Roster {
  players: Player[]
  activePlayerIds: string[]
}

export type NameError = 'empty' | 'tooLong' | 'taken'
export type RosterResult = { ok: true; roster: Roster } | { ok: false; error: NameError }

export function validateName(name: string, players: readonly Player[], exceptId?: string): NameError | null {
  const clean = cleanText(name)
  if (!clean) return 'empty'
  if (textLength(clean) > LIMITS.player) return 'tooLong'
  const key = normalizeText(clean)
  if (players.some((p) => p.id !== exceptId && normalizeText(p.name) === key)) return 'taken'
  return null
}

export function addPlayer(roster: Roster, name: string, newId: () => string): RosterResult {
  const error = validateName(name, roster.players)
  if (error) return { ok: false, error }
  const player: Player = { id: newId(), name: cleanText(name) }
  return {
    ok: true,
    roster: { players: [...roster.players, player], activePlayerIds: [...roster.activePlayerIds, player.id] },
  }
}

export function renamePlayer(roster: Roster, id: string, name: string): RosterResult {
  if (!roster.players.some((p) => p.id === id)) throw new Error(`No player ${id}`)
  const error = validateName(name, roster.players, id)
  if (error) return { ok: false, error }
  return {
    ok: true,
    roster: {
      ...roster,
      players: roster.players.map((p) => (p.id === id ? { ...p, name: cleanText(name) } : p)),
    },
  }
}

export function removePlayer(roster: Roster, id: string): Roster {
  return {
    players: roster.players.filter((p) => p.id !== id),
    activePlayerIds: roster.activePlayerIds.filter((pid) => pid !== id),
  }
}

export function setActive(roster: Roster, id: string, active: boolean): Roster {
  const set = new Set(roster.activePlayerIds)
  if (active) set.add(id)
  else set.delete(id)
  return { players: roster.players, activePlayerIds: roster.players.map((p) => p.id).filter((pid) => set.has(pid)) }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/data/roster.test.ts`
Expected: `7 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(data): add roster operations with normalized duplicate-name detection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Custom content operations (GM words, edit, delete)

**Files:**
- Create: `src/data/content.ts`
- Test: `src/data/content.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `Category`, `Content`, `Lang`, `LANGS`, `Localized`, `Word`
  - From Task 9: `SEED_CATEGORIES`, `SEED_WORDS`
  - From Task 3: `cleanText`, `cleanLocalized`, `normalizeText`, `LIMITS`, `textLength`
- Produces:
  - `interface CustomContent { customCategories: Category[]; customWords: Word[] }`
  - `allContent(custom): Content`, which returns seed + custom
  - `categoriesNamedIn(content, lang): Category[]`
  - GM-word types:
    - `type GmField = 'word' | 'hint' | 'category'`
    - `interface GmWordError { field: GmField; code: 'empty' | 'tooLong' | 'unknown' }`
    - `type GmCategoryChoice = { existingId: string } | { newName: string }`
    - `interface GmWordInput { lang: Lang; word: string; hint: string; category: GmCategoryChoice }`
  - `validateGmWord(input, content): GmWordError[]`
  - `addGmWord(custom, input, newId): { custom: CustomContent; word: Word; category: Category }`
  - `interface LocalizedError { field: 'text' | 'hint' | 'name'; lang: Lang | null; code: 'tooLong' | 'needOneLanguage' }`
  - Edit validation:
    - `validateWordEdit(text: Localized, hint: Localized): LocalizedError[]`
    - `validateCategoryEdit(name: Localized): LocalizedError[]`
  - Edits and deletes, each returning `CustomContent`:
    - `updateCustomWord(custom, id, text, hint)`
    - `updateCustomCategory(custom, id, name)`
    - `deleteCustomWord(custom, id)`
    - `deleteCustomCategory(custom, id)`

- [ ] **Step 1: Write the failing test `src/data/content.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import {
  addGmWord, allContent, deleteCustomCategory, updateCustomWord, validateGmWord, type CustomContent, type GmWordInput,
} from './content'
import { SEED_CATEGORIES, SEED_WORDS } from './seed'

const none: CustomContent = { customCategories: [], customWords: [] }
let n = 0
const newId = () => `c${++n}`
const input = (over: Partial<GmWordInput>): GmWordInput => ({
  lang: 'ar', word: 'منسف', hint: '', category: { existingId: 'food' }, ...over,
})

describe('allContent', () => {
  it('combines the built-in packs with custom content', () => {
    const c = allContent({ customCategories: [{ id: 'x', name: { en: 'X' }, builtIn: false }], customWords: [] })
    expect(c.categories).toHaveLength(SEED_CATEGORIES.length + 1)
    expect(c.words).toHaveLength(SEED_WORDS.length)
  })
})

describe('addGmWord', () => {
  it('saves a GM word in the round language only', () => {
    const { word, custom } = addGmWord(none, input({ hint: 'لحمة' }), newId)
    expect(word).toMatchObject({ categoryId: 'food', builtIn: false, text: { ar: 'منسف' }, hint: { ar: 'لحمة' } })
    expect(custom.customWords).toEqual([word])
  })

  it('lets the GM file a word under a built-in category', () => {
    const { category } = addGmWord(none, input({}), newId)
    expect(category.id).toBe('food')
    expect(category.builtIn).toBe(true)
  })

  it('reuses an existing category when the typed name matches, even with a different hamza', () => {
    const { category, custom } = addGmWord(none, input({ category: { newName: 'اكل  وشرب' } }), newId)
    expect(category.id).toBe('food')
    expect(custom.customCategories).toEqual([])
  })

  it('creates a new category with a name in the round language only', () => {
    const { category, custom } = addGmWord(none, input({ category: { newName: 'أكل أردني' } }), newId)
    expect(category).toMatchObject({ builtIn: false, name: { ar: 'أكل أردني' } })
    expect(custom.customCategories).toEqual([category])
  })

  it('reuses an existing word instead of saving a duplicate', () => {
    const { word, custom } = addGmWord(none, input({ word: 'فلافل' }), newId)
    expect(word.id).toBe('food.falafel')
    expect(custom.customWords).toEqual([])
  })

  it('fills in a missing hint on an existing custom word', () => {
    const first = addGmWord(none, input({}), newId)
    const second = addGmWord(first.custom, input({ hint: 'رز' }), newId)
    expect(second.word.id).toBe(first.word.id)
    expect(second.custom.customWords).toHaveLength(1)
    expect(second.word.hint).toEqual({ ar: 'رز' })
  })
})

describe('validateGmWord', () => {
  const content = allContent(none)

  it('reports every problem per field so the GM form can show them all at once', () => {
    expect(validateGmWord(input({ word: '  ', hint: 'x'.repeat(41), category: { newName: ' ' } }), content)).toEqual([
      { field: 'word', code: 'empty' },
      { field: 'hint', code: 'tooLong' },
      { field: 'category', code: 'empty' },
    ])
  })

  it('rejects a category that has no name in the round language', () => {
    expect(validateGmWord(input({ lang: 'en', word: 'Mansaf', category: { existingId: 'levant' } }), content))
      .toEqual([{ field: 'category', code: 'unknown' }])
  })

  it('refuses to save invalid input even if the UI forgot to validate', () => {
    expect(() => addGmWord(none, input({ word: '' }), newId)).toThrow()
  })
})

describe('editing and deleting custom content', () => {
  const base = addGmWord(none, input({ category: { newName: 'أكل أردني' } }), newId)

  it('saves cleaned text in both languages', () => {
    const out = updateCustomWord(base.custom, base.word.id, { en: ' Mansaf ', ar: 'منسف' }, { en: '', ar: 'لبن' })
    expect(out.customWords[0]).toMatchObject({ text: { en: 'Mansaf', ar: 'منسف' }, hint: { ar: 'لبن' } })
  })

  it('refuses to leave a word with no text at all', () => {
    expect(() => updateCustomWord(base.custom, base.word.id, { en: '', ar: ' ' }, {})).toThrow()
  })

  it('never edits built-in words', () => {
    expect(() => updateCustomWord(base.custom, 'food.falafel', { en: 'X' }, {})).toThrow()
  })

  it('deleting a category deletes its words too', () => {
    const out = deleteCustomCategory(base.custom, base.category.id)
    expect(out).toEqual({ customCategories: [], customWords: [] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/data/content.test.ts`
Expected: FAIL, `error: Cannot find module './content'`.

- [ ] **Step 3: Implement `src/data/content.ts`**

```ts
import { LANGS, type Category, type Content, type Lang, type Localized, type Word } from '../engine/types'
import { SEED_CATEGORIES, SEED_WORDS } from './seed'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { LIMITS, textLength } from './limits'

export interface CustomContent {
  customCategories: Category[]
  customWords: Word[]
}

export function allContent(custom: CustomContent): Content {
  return {
    categories: [...SEED_CATEGORIES, ...custom.customCategories],
    words: [...SEED_WORDS, ...custom.customWords],
  }
}

export function categoriesNamedIn(content: Content, lang: Lang): Category[] {
  return content.categories.filter((c) => cleanText(c.name[lang] ?? '') !== '')
}

export type GmField = 'word' | 'hint' | 'category'
export interface GmWordError {
  field: GmField
  code: 'empty' | 'tooLong' | 'unknown'
}
export type GmCategoryChoice = { existingId: string } | { newName: string }
export interface GmWordInput {
  lang: Lang
  word: string
  hint: string
  category: GmCategoryChoice
}

export function validateGmWord(input: GmWordInput, content: Content): GmWordError[] {
  const errors: GmWordError[] = []
  const word = cleanText(input.word)
  if (!word) errors.push({ field: 'word', code: 'empty' })
  else if (textLength(word) > LIMITS.word) errors.push({ field: 'word', code: 'tooLong' })

  if (textLength(cleanText(input.hint)) > LIMITS.hint) errors.push({ field: 'hint', code: 'tooLong' })

  const choice = input.category
  if ('existingId' in choice) {
    if (!categoriesNamedIn(content, input.lang).some((c) => c.id === choice.existingId)) {
      errors.push({ field: 'category', code: 'unknown' })
    }
  } else {
    const name = cleanText(choice.newName)
    if (!name) errors.push({ field: 'category', code: 'empty' })
    else if (textLength(name) > LIMITS.category) errors.push({ field: 'category', code: 'tooLong' })
  }
  return errors
}

/** Saves (or reuses) the GM's word. Dedupe uses normalized text (spec §5.3). */
export function addGmWord(
  custom: CustomContent,
  input: GmWordInput,
  newId: () => string,
): { custom: CustomContent; word: Word; category: Category } {
  const content = allContent(custom)
  if (validateGmWord(input, content).length > 0) throw new Error('addGmWord: invalid input')
  const { lang } = input
  let customCategories = custom.customCategories
  let customWords = custom.customWords

  const choice = input.category
  let found: Category | undefined
  if ('existingId' in choice) {
    found = content.categories.find((c) => c.id === choice.existingId)
  } else {
    const name = cleanText(choice.newName)
    const key = normalizeText(name)
    found = categoriesNamedIn(content, lang).find((c) => normalizeText(c.name[lang] ?? '') === key)
    if (!found) {
      found = { id: newId(), name: { [lang]: name }, builtIn: false }
      customCategories = [...customCategories, found]
    }
  }
  if (!found) throw new Error('addGmWord: unknown category')
  const category = found

  const text = cleanText(input.word)
  const hint = cleanText(input.hint)
  const key = normalizeText(text)
  const existing = content.words.find(
    (w) => w.categoryId === category.id && normalizeText(w.text[lang] ?? '') === key,
  )

  let word: Word
  if (existing) {
    word = existing
    if (!existing.builtIn && hint && !existing.hint[lang]) {
      const updated: Word = { ...existing, hint: { ...existing.hint, [lang]: hint } }
      customWords = customWords.map((w) => (w.id === updated.id ? updated : w))
      word = updated
    }
  } else {
    word = { id: newId(), categoryId: category.id, builtIn: false, text: { [lang]: text }, hint: hint ? { [lang]: hint } : {} }
    customWords = [...customWords, word]
  }
  return { custom: { customCategories, customWords }, word, category }
}

export interface LocalizedError {
  field: 'text' | 'hint' | 'name'
  lang: Lang | null
  code: 'tooLong' | 'needOneLanguage'
}

function checkLocalized(value: Localized, field: LocalizedError['field'], max: number, required: boolean): LocalizedError[] {
  const errors: LocalizedError[] = []
  for (const lang of LANGS) {
    if (textLength(cleanText(value[lang] ?? '')) > max) errors.push({ field, lang, code: 'tooLong' })
  }
  if (required && Object.keys(cleanLocalized(value)).length === 0) {
    errors.push({ field, lang: null, code: 'needOneLanguage' })
  }
  return errors
}

export function validateWordEdit(text: Localized, hint: Localized): LocalizedError[] {
  return [...checkLocalized(text, 'text', LIMITS.word, true), ...checkLocalized(hint, 'hint', LIMITS.hint, false)]
}

export function validateCategoryEdit(name: Localized): LocalizedError[] {
  return checkLocalized(name, 'name', LIMITS.category, true)
}

export function updateCustomWord(custom: CustomContent, id: string, text: Localized, hint: Localized): CustomContent {
  if (!custom.customWords.some((w) => w.id === id)) throw new Error(`No custom word ${id}`)
  if (validateWordEdit(text, hint).length > 0) throw new Error('updateCustomWord: invalid edit')
  return {
    ...custom,
    customWords: custom.customWords.map((w) =>
      w.id === id ? { ...w, text: cleanLocalized(text), hint: cleanLocalized(hint) } : w,
    ),
  }
}

export function updateCustomCategory(custom: CustomContent, id: string, name: Localized): CustomContent {
  if (!custom.customCategories.some((c) => c.id === id)) throw new Error(`No custom category ${id}`)
  if (validateCategoryEdit(name).length > 0) throw new Error('updateCustomCategory: invalid edit')
  return {
    ...custom,
    customCategories: custom.customCategories.map((c) => (c.id === id ? { ...c, name: cleanLocalized(name) } : c)),
  }
}

export function deleteCustomWord(custom: CustomContent, id: string): CustomContent {
  return { ...custom, customWords: custom.customWords.filter((w) => w.id !== id) }
}

export function deleteCustomCategory(custom: CustomContent, id: string): CustomContent {
  return {
    customCategories: custom.customCategories.filter((c) => c.id !== id),
    customWords: custom.customWords.filter((w) => w.categoryId !== id),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/data/content.test.ts`
Expected: `14 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(data): add GM word saving with dedupe, and custom content edits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Import / export (file and URL)

**Files:**
- Create: `src/data/transfer.ts`
- Test: `src/data/transfer.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `Category`, `Word`, `Player`, `Settings`, `Localized`, `LANGS`
  - From Task 9: `SEED_CATEGORY_IDS`, `SEED_WORD_IDS`
  - From Task 3: `cleanText`, `cleanLocalized`, `normalizeText`, `LIMITS`, `TIMER`, `MAX_IMPOSTER_SETTING`, `textLength`
  - From Task 10: `Stored`
- Produces:
  - Constants: `PACK_FORMAT`, `PACK_VERSION`, `MAX_PACK_BYTES = 1_000_000`
  - Pack errors:
    - `type PackErrorCode = 'badFormat' | 'wrongType' | 'missing' | 'invalidId' | 'empty' | 'tooLong' | 'unknownCategory' | 'duplicateId'`
    - `interface PackError { path: string; code: PackErrorCode }`
  - Parsed pack types:
    - `interface ValidPack { categories: {id,name}[]; words: {id,categoryId,text,hint}[]; playerNames: string[] | null; settings: Settings | null }`
    - `type ParseResult = { ok: true; pack: ValidPack } | { ok: false; errors: PackError[] }`
  - `parsePack(json: unknown, knownCategoryIds: ReadonlySet<string>): ParseResult`
  - Import plan types:
    - `type ImportMode = 'file' | 'url'`
    - `interface ImportTarget { customCategories; customWords; players; settings }`
    - `interface ImportSummary { addCategories; updateCategories; addWords; updateWords; skippedBuiltIn; addPlayers: number; replacesSettings: boolean }`
    - `interface ImportPlan { summary: ImportSummary; result: ImportTarget }`
  - `planImport(pack, current: ImportTarget, mode, newId): ImportPlan`
  - Export: `exportPack(data: Pick<Stored, 'players' | 'settings' | 'customCategories' | 'customWords'>): string`, `exportFileName(date: Date): string`
  - Fetch results:
    - `type FetchErrorCode = 'invalidUrl' | 'httpsOnly' | 'offline' | 'network' | 'timeout' | 'httpStatus' | 'tooLarge' | 'invalidJson'`
    - `type FetchResult = { ok: true; json: unknown } | { ok: false; error: FetchErrorCode; status?: number }`
    - `type FetchFn = (url: string, init?: RequestInit) => Promise<Response>`
    - `interface FetchDeps { fetch: FetchFn; isOnline: () => boolean; timeoutMs: number }`
  - Loaders: `parseJsonText(text): FetchResult`, `fetchPackJson(url, deps?): Promise<FetchResult>`, `readPackFile(file: Blob): Promise<FetchResult>`

- [ ] **Step 1: Write the failing test `src/data/transfer.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { SEED_CATEGORY_IDS } from './seed'
import { defaultSettings } from './storage'
import {
  MAX_PACK_BYTES, exportFileName, exportPack, fetchPackJson, parseJsonText, parsePack, planImport, readPackFile,
  type FetchDeps, type FetchFn, type ImportTarget,
} from './transfer'

const pack = (over: Record<string, unknown> = {}) => ({
  format: 'fennas-imposter',
  version: 1,
  categories: [{ id: 'jo-food', name: { en: 'Jordanian food', ar: 'أكل أردني' } }],
  words: [
    { id: 'jo-food.mansaf', categoryId: 'jo-food', text: { en: 'Mansaf', ar: 'منسف' }, hint: { ar: 'لبن' } },
    { id: 'food.knafeh', categoryId: 'food', text: { ar: 'كنافة' } },
  ],
  ...over,
})
const emptyTarget = (): ImportTarget => ({ customCategories: [], customWords: [], players: [], settings: defaultSettings() })
let n = 0
const newId = () => `n${++n}`

function valid(json: unknown) {
  const r = parsePack(json, SEED_CATEGORY_IDS)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.pack
}

describe('parsePack', () => {
  it('accepts a well-formed pack, including words filed under built-in categories', () => {
    const p = valid(pack())
    expect(p.categories).toHaveLength(1)
    expect(p.words.map((w) => w.categoryId)).toEqual(['jo-food', 'food'])
    expect(p.words[1].hint).toEqual({})
  })

  it('rejects files that are not ours at all', () => {
    expect(parsePack({ hello: 1 }, SEED_CATEGORY_IDS)).toEqual({ ok: false, errors: [{ path: '', code: 'badFormat' }] })
  })

  it('points at each broken entry by path so the user can fix the file', () => {
    const r = parsePack(pack({
      categories: [{ id: 'bad id!', name: { en: 'X' } }, { id: 'ok', name: {} }],
      words: [
        { id: 'w1', categoryId: 'nowhere', text: { en: 'A' } },
        { id: 'w1', categoryId: 'ok', text: { en: 'x'.repeat(41) } },
      ],
      settings: { imposterCount: 'two' },
    }), SEED_CATEGORY_IDS)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toEqual([
        { path: 'categories[0].id', code: 'invalidId' },
        { path: 'categories[1].name', code: 'empty' },
        { path: 'words[0].categoryId', code: 'unknownCategory' },
        { path: 'words[1].id', code: 'duplicateId' },
        { path: 'words[1].text.en', code: 'tooLong' },
        { path: 'settings', code: 'wrongType' },
      ])
    }
  })

  it('caps the error list at 10 so a garbage file does not flood the screen', () => {
    const words = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, categoryId: 'nowhere', text: { en: 'A' } }))
    const r = parsePack(pack({ words }), SEED_CATEGORY_IDS)
    expect(!r.ok && r.errors.length).toBe(10)
  })
})

describe('planImport', () => {
  it('counts additions and updates, merging by id so re-importing refreshes', () => {
    const first = planImport(valid(pack()), emptyTarget(), 'url', newId)
    expect(first.summary).toMatchObject({ addCategories: 1, addWords: 2, updateWords: 0 })
    const again = planImport(valid(pack()), first.result, 'url', newId)
    expect(again.summary).toMatchObject({ addCategories: 0, updateCategories: 1, addWords: 0, updateWords: 2 })
    expect(again.result.customWords).toHaveLength(2)
  })

  it('can never overwrite built-in entries', () => {
    const p = valid(pack({
      categories: [{ id: 'food', name: { en: 'Hacked' } }],
      words: [{ id: 'food.falafel', categoryId: 'food', text: { en: 'Hacked' } }],
    }))
    const plan = planImport(p, emptyTarget(), 'file', newId)
    expect(plan.summary.skippedBuiltIn).toBe(2)
    expect(plan.result.customCategories).toEqual([])
    expect(plan.result.customWords).toEqual([])
  })

  it('URL imports only bring words: players and settings in the file are ignored', () => {
    const p = valid(pack({ players: [{ name: 'Rami' }], settings: { ...defaultSettings(), scoring: true } }))
    const plan = planImport(p, emptyTarget(), 'url', newId)
    expect(plan.result.players).toEqual([])
    expect(plan.result.settings.scoring).toBe(false)
    expect(plan.summary).toMatchObject({ addPlayers: 0, replacesSettings: false })
  })

  it('file imports merge players by name and replace settings', () => {
    const target = { ...emptyTarget(), players: [{ id: 'p1', name: 'Rami' }] }
    const p = valid(pack({ players: [{ name: ' rami ' }, { name: 'Lina' }], settings: { ...defaultSettings(), scoring: true } }))
    const plan = planImport(p, target, 'file', newId)
    expect(plan.result.players.map((x) => x.name)).toEqual(['Rami', 'Lina'])
    expect(plan.result.settings.scoring).toBe(true)
    expect(plan.summary).toMatchObject({ addPlayers: 1, replacesSettings: true })
  })
})

describe('export', () => {
  it('round-trips custom content, players and settings through a file', () => {
    const original = planImport(valid(pack({ players: [{ name: 'Rami' }] })), emptyTarget(), 'file', newId).result
    const restored = planImport(valid(JSON.parse(exportPack(original))), emptyTarget(), 'file', newId).result
    expect(restored.customCategories).toEqual(original.customCategories)
    expect(restored.customWords).toEqual(original.customWords)
    expect(restored.players.map((p) => p.name)).toEqual(['Rami'])
    expect(restored.settings).toEqual(original.settings)
  })

  it('names backups by local date', () => {
    expect(exportFileName(new Date(2026, 8, 7))).toBe('fennas-imposter-2026-09-07.json')
  })
})

describe('parseJsonText / readPackFile', () => {
  it('rejects oversized input before parsing it', () => {
    expect(parseJsonText('x'.repeat(MAX_PACK_BYTES + 1))).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('rejects non-JSON', () => {
    expect(parseJsonText('{oops')).toEqual({ ok: false, error: 'invalidJson' })
  })

  it('checks a file’s size before reading it', async () => {
    expect(await readPackFile(new Blob(['x'.repeat(MAX_PACK_BYTES + 1)]))).toEqual({ ok: false, error: 'tooLarge' })
    expect(await readPackFile(new Blob(['{"a":1}']))).toEqual({ ok: true, json: { a: 1 } })
  })
})

describe('fetchPackJson', () => {
  const deps = (fetchImpl: FetchFn, online = true): FetchDeps => ({ fetch: fetchImpl, isOnline: () => online, timeoutMs: 20 })
  const ok = (body: string, init: ResponseInit = {}) => async () => new Response(body, { status: 200, ...init })
  const never: FetchFn = async () => { throw new Error('must not be called') }

  it('refuses non-links and plain http without making a request', async () => {
    expect(await fetchPackJson('not a url', deps(never))).toEqual({ ok: false, error: 'invalidUrl' })
    expect(await fetchPackJson('http://example.com/p.json', deps(never))).toEqual({ ok: false, error: 'httpsOnly' })
  })

  it('says "offline" instead of trying when there is no connection', async () => {
    expect(await fetchPackJson('https://example.com/p.json', deps(never, false))).toEqual({ ok: false, error: 'offline' })
  })

  it('returns the parsed JSON on success', async () => {
    expect(await fetchPackJson('https://example.com/p.json', deps(ok('{"a":1}')))).toEqual({ ok: true, json: { a: 1 } })
  })

  it('reports HTTP errors with their status', async () => {
    const notFound = async () => new Response('nope', { status: 404 })
    expect(await fetchPackJson('https://example.com/p.json', deps(notFound))).toEqual({ ok: false, error: 'httpStatus', status: 404 })
  })

  it('trusts a too-large Content-Length and stops early', async () => {
    const big = ok('{}', { headers: { 'content-length': String(MAX_PACK_BYTES + 1) } })
    expect(await fetchPackJson('https://example.com/p.json', deps(big))).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('gives up after the timeout', async () => {
    const hanging: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    expect(await fetchPackJson('https://example.com/p.json', deps(hanging))).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports blocked requests (CORS, DNS) as network errors', async () => {
    const blocked: FetchFn = async () => { throw new TypeError('Failed to fetch') }
    expect(await fetchPackJson('https://example.com/p.json', deps(blocked))).toEqual({ ok: false, error: 'network' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/data/transfer.test.ts`
Expected: FAIL, `error: Cannot find module './transfer'`.

- [ ] **Step 3: Implement `src/data/transfer.ts`**

```ts
import { LANGS, type Category, type Localized, type Player, type Settings, type Word } from '../engine/types'
import { SEED_CATEGORY_IDS, SEED_WORD_IDS } from './seed'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { LIMITS, MAX_IMPOSTER_SETTING, TIMER, textLength } from './limits'
import type { Stored } from './storage'

export const PACK_FORMAT = 'fennas-imposter'
export const PACK_VERSION = 1
export const MAX_PACK_BYTES = 1_000_000
const MAX_ERRORS = 10
const ID_RE = /^[A-Za-z0-9._:-]{1,64}$/

export type PackErrorCode =
  | 'badFormat' | 'wrongType' | 'missing' | 'invalidId' | 'empty' | 'tooLong' | 'unknownCategory' | 'duplicateId'
export interface PackError {
  path: string
  code: PackErrorCode
}
export interface PackCategory {
  id: string
  name: Localized
}
export interface PackWord {
  id: string
  categoryId: string
  text: Localized
  hint: Localized
}
export interface ValidPack {
  categories: PackCategory[]
  words: PackWord[]
  playerNames: string[] | null
  settings: Settings | null
}
export type ParseResult = { ok: true; pack: ValidPack } | { ok: false; errors: PackError[] }

type Fail = (path: string, code: PackErrorCode) => void

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function readId(value: unknown, path: string, seen: Set<string>, fail: Fail): string | null {
  let code: PackErrorCode | null = null
  if (value === undefined) code = 'missing'
  else if (typeof value !== 'string' || !ID_RE.test(value)) code = 'invalidId'
  else if (seen.has(value)) code = 'duplicateId'
  if (code) {
    fail(path, code)
    return null
  }
  seen.add(value as string)
  return value as string
}

function readLocalized(value: unknown, path: string, max: number, required: boolean, fail: Fail): Localized | null {
  if (value === undefined) {
    if (required) fail(path, 'missing')
    return required ? null : {}
  }
  if (!isRecord(value)) {
    fail(path, 'wrongType')
    return null
  }
  let ok = true
  for (const lang of LANGS) {
    const v = value[lang]
    if (v === undefined) continue
    if (typeof v !== 'string') {
      fail(`${path}.${lang}`, 'wrongType')
      ok = false
    } else if (textLength(cleanText(v)) > max) {
      fail(`${path}.${lang}`, 'tooLong')
      ok = false
    }
  }
  if (!ok) return null
  const clean = cleanLocalized(value as Localized)
  if (required && Object.keys(clean).length === 0) {
    fail(path, 'empty')
    return null
  }
  return clean
}

function readSettings(v: unknown, fail: Fail): Settings | null {
  const t = isRecord(v) ? v.timer : undefined
  const valid =
    isRecord(v) &&
    Number.isInteger(v.imposterCount) &&
    (v.imposterCount as number) >= 1 &&
    (v.imposterCount as number) <= MAX_IMPOSTER_SETTING &&
    typeof v.randomImposterCount === 'boolean' &&
    typeof v.hints === 'boolean' &&
    typeof v.scoring === 'boolean' &&
    isRecord(t) &&
    typeof t.enabled === 'boolean' &&
    Number.isInteger(t.seconds) &&
    (t.seconds as number) >= TIMER.min &&
    (t.seconds as number) <= TIMER.max &&
    (t.seconds as number) % TIMER.step === 0
  if (!valid) {
    fail('settings', 'wrongType')
    return null
  }
  return {
    imposterCount: v.imposterCount as number,
    randomImposterCount: v.randomImposterCount as boolean,
    hints: v.hints as boolean,
    scoring: v.scoring as boolean,
    timer: { enabled: t.enabled as boolean, seconds: t.seconds as number },
  }
}

export function parsePack(json: unknown, knownCategoryIds: ReadonlySet<string>): ParseResult {
  if (!isRecord(json) || json.format !== PACK_FORMAT || json.version !== PACK_VERSION) {
    return { ok: false, errors: [{ path: '', code: 'badFormat' }] }
  }
  const errors: PackError[] = []
  const fail: Fail = (path, code) => {
    if (errors.length < MAX_ERRORS) errors.push({ path, code })
  }

  const categories: PackCategory[] = []
  const categoryIds = new Set<string>()
  const rawCategories = json.categories ?? []
  if (!Array.isArray(rawCategories)) fail('categories', 'wrongType')
  else {
    rawCategories.forEach((c: unknown, i) => {
      const path = `categories[${i}]`
      if (!isRecord(c)) return fail(path, 'wrongType')
      const id = readId(c.id, `${path}.id`, categoryIds, fail)
      const name = readLocalized(c.name, `${path}.name`, LIMITS.category, true, fail)
      if (id && name) categories.push({ id, name })
    })
  }

  const resolvable = new Set([...knownCategoryIds, ...categoryIds])
  const words: PackWord[] = []
  const wordIds = new Set<string>()
  const rawWords = json.words ?? []
  if (!Array.isArray(rawWords)) fail('words', 'wrongType')
  else {
    rawWords.forEach((w: unknown, i) => {
      const path = `words[${i}]`
      if (!isRecord(w)) return fail(path, 'wrongType')
      const id = readId(w.id, `${path}.id`, wordIds, fail)
      let categoryId: string | null = null
      if (typeof w.categoryId !== 'string') fail(`${path}.categoryId`, w.categoryId === undefined ? 'missing' : 'wrongType')
      else if (!resolvable.has(w.categoryId)) fail(`${path}.categoryId`, 'unknownCategory')
      else categoryId = w.categoryId
      const text = readLocalized(w.text, `${path}.text`, LIMITS.word, true, fail)
      const hint = readLocalized(w.hint, `${path}.hint`, LIMITS.hint, false, fail)
      if (id && categoryId && text && hint) words.push({ id, categoryId, text, hint })
    })
  }

  let playerNames: string[] | null = null
  if (json.players !== undefined) {
    if (!Array.isArray(json.players)) fail('players', 'wrongType')
    else {
      const names: string[] = []
      json.players.forEach((p: unknown, i) => {
        const path = `players[${i}].name`
        if (!isRecord(p) || typeof p.name !== 'string') return fail(path, 'wrongType')
        const name = cleanText(p.name)
        if (!name) return fail(path, 'empty')
        if (textLength(name) > LIMITS.player) return fail(path, 'tooLong')
        names.push(name)
      })
      playerNames = names
    }
  }

  const settings = json.settings === undefined ? null : readSettings(json.settings, fail)

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, pack: { categories, words, playerNames, settings } }
}

export type ImportMode = 'file' | 'url'

export interface ImportTarget {
  customCategories: Category[]
  customWords: Word[]
  players: Player[]
  settings: Settings
}

export interface ImportSummary {
  addCategories: number
  updateCategories: number
  addWords: number
  updateWords: number
  skippedBuiltIn: number
  addPlayers: number
  replacesSettings: boolean
}

export interface ImportPlan {
  summary: ImportSummary
  result: ImportTarget
}

export function planImport(pack: ValidPack, current: ImportTarget, mode: ImportMode, newId: () => string): ImportPlan {
  const summary: ImportSummary = {
    addCategories: 0, updateCategories: 0, addWords: 0, updateWords: 0, skippedBuiltIn: 0, addPlayers: 0, replacesSettings: false,
  }

  const categories = new Map(current.customCategories.map((c) => [c.id, c]))
  for (const c of pack.categories) {
    if (SEED_CATEGORY_IDS.has(c.id)) { summary.skippedBuiltIn++; continue }
    if (categories.has(c.id)) summary.updateCategories++
    else summary.addCategories++
    categories.set(c.id, { id: c.id, name: c.name, builtIn: false })
  }

  const words = new Map(current.customWords.map((w) => [w.id, w]))
  for (const w of pack.words) {
    if (SEED_WORD_IDS.has(w.id)) { summary.skippedBuiltIn++; continue }
    if (words.has(w.id)) summary.updateWords++
    else summary.addWords++
    words.set(w.id, { id: w.id, categoryId: w.categoryId, builtIn: false, text: w.text, hint: w.hint })
  }

  let players = current.players
  let settings = current.settings
  if (mode === 'file') {
    if (pack.playerNames) {
      const known = new Set(players.map((p) => normalizeText(p.name)))
      for (const name of pack.playerNames) {
        const key = normalizeText(name)
        if (known.has(key)) continue
        known.add(key)
        players = [...players, { id: newId(), name }]
        summary.addPlayers++
      }
    }
    if (pack.settings) {
      settings = pack.settings
      summary.replacesSettings = true
    }
  }

  return {
    summary,
    result: { customCategories: [...categories.values()], customWords: [...words.values()], players, settings },
  }
}

export function exportPack(data: Pick<Stored, 'players' | 'settings' | 'customCategories' | 'customWords'>): string {
  return JSON.stringify(
    {
      format: PACK_FORMAT,
      version: PACK_VERSION,
      categories: data.customCategories.map(({ id, name }) => ({ id, name })),
      words: data.customWords.map(({ id, categoryId, text, hint }) => ({ id, categoryId, text, hint })),
      players: data.players.map(({ id, name }) => ({ id, name })),
      settings: data.settings,
    },
    null,
    2,
  )
}

export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `fennas-imposter-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

export type FetchErrorCode =
  | 'invalidUrl' | 'httpsOnly' | 'offline' | 'network' | 'timeout' | 'httpStatus' | 'tooLarge' | 'invalidJson'
export type FetchResult = { ok: true; json: unknown } | { ok: false; error: FetchErrorCode; status?: number }

/** Just the part of fetch we use; runtime-specific extras (e.g. Bun's fetch.preconnect) stay out of our types. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface FetchDeps {
  fetch: FetchFn
  isOnline: () => boolean
  timeoutMs: number
}

function defaultFetchDeps(): FetchDeps {
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    isOnline: () => navigator.onLine,
    timeoutMs: 15_000,
  }
}

export function parseJsonText(text: string): FetchResult {
  if (new TextEncoder().encode(text).length > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'invalidJson' }
  }
}

export async function readPackFile(file: Blob): Promise<FetchResult> {
  if (file.size > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
  return parseJsonText(await file.text())
}

export async function fetchPackJson(url: string, deps: FetchDeps = defaultFetchDeps()): Promise<FetchResult> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return { ok: false, error: 'invalidUrl' }
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'httpsOnly' }
  if (!deps.isOnline()) return { ok: false, error: 'offline' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs)
  try {
    const res = await deps.fetch(parsed.href, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return { ok: false, error: 'httpStatus', status: res.status }
    if (Number(res.headers.get('content-length') ?? 0) > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
    return parseJsonText(await res.text())
  } catch {
    if (controller.signal.aborted) return { ok: false, error: 'timeout' }
    return { ok: false, error: deps.isOnline() ? 'network' : 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/data/transfer.test.ts`
Expected: `20 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(data): add validated pack import (file + https URL) and backup export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: App store (`useApp`)

**Files:**
- Create: `src/composables/useApp.ts`
- Test: `src/composables/useApp.test.ts`

**Interfaces:**
- Consumes:
  - Engine: `rng.ts`, `words.ts`, `assign.ts`, `round.ts`, `scoring.ts`
  - Data: `storage.ts`, `roster.ts`, `content.ts`, `transfer.ts`
  - i18n: `translate`, `MessageKey`, `Params`
- Produces:
  - `interface AppDeps { storage; rng; now: () => number; newId: () => string }`
  - Types:
    - `type RoundBlocker = 'needPlayers' | 'noWords' | 'noGm'`
    - `type RosterError = NameError | 'inRound'`
    - `type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; errors: PackError[] }`
  - `createAppStore(deps)` returns an `AppStore` with these members:
    - **State and helpers:**
      - `state: Stored` (reactive)
      - `meta: { status: LoadStatus; canSave: boolean; noticeDismissed: boolean }` (reactive)
      - `content: ComputedRef<Content>`
      - `t(key, params?)`, `playerName(id)`
    - **Language:** `setLanguage(lang)`, which throws during a round
    - **Roster:**
      - `addPlayer(name)`, `renamePlayer(id, name)`, `removePlayer(id)`; each returns `RosterError | null`
      - `setActive(id, active)`
    - **Setup:** `toggleCategory(id)`, `updateSettings(patch)`
    - **Session and rounds:**
      - `ensureSession()`, `endSession()`
      - `roundBlocker(source)`, `clampedImposterCount(source): number | null`
      - `beginRound(source)`
      - `submitGmWord(input): GmWordError[]`
      - `dispatch(action)`, `finishRound()`, `abandonRound()`
    - **Custom content:**
      - `updateCustomWord(id, text, hint)`, `updateCustomCategory(id, name)`; each returns `LocalizedError[]`
      - `deleteCustomWord(id)`, `deleteCustomCategory(id)`
    - **Import:** `previewImport(json, mode): PreviewResult`, `applyImport(plan)`, `setLastImportUrl(url)`
    - **Notices:** `dismissNotice()`
  - `type AppStore = ReturnType<typeof createAppStore>`
  - `useApp(): AppStore` is the browser singleton: `browserStorage()`, `cryptoRng`, `Date.now`, `newId`.

**Behavior decisions** (the spec leaves these open; the store encodes them):
- A category newly created by a GM, or newly added by an import, is added to `selectedCategoryIds` so it is playable right away. Players can untick it.
- Deleting a custom category also removes it from `selectedCategoryIds`.
- Score deltas and `session.rounds + 1` are applied in the same `persist()` call that moves the round into `result` (spec §3.6).

- [ ] **Step 1: Write the failing test `src/composables/useApp.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { seededRng } from '../engine/rng'
import { STORAGE_KEY, memoryStorage, type StorageLike } from '../data/storage'
import { createAppStore, type AppStore } from './useApp'

function setup(storage: StorageLike | null = memoryStorage(), seed = 1): AppStore {
  let n = 0
  return createAppStore({ storage, rng: seededRng(seed), now: () => 1_000, newId: () => `id${++n}` })
}
function withPlayers(app: AppStore, names = ['Rami', 'Lina', 'Omar', 'Sara']): string[] {
  for (const name of names) expect(app.addPlayer(name)).toBeNull()
  return app.state.players.map((p) => p.id)
}
function revealAll(app: AppStore): void {
  const r = app.state.round!
  for (let i = r.revealIndex; i < r.participantIds.length; i++) app.dispatch({ type: 'cardSeen', now: 0 })
}
function playOut(app: AppStore): void {
  revealAll(app)
  app.dispatch({ type: 'endDiscussion' })
  if (app.state.round!.phase === 'vote') app.dispatch({ type: 'voteOut', playerId: null })
  app.finishRound()
}

describe('persistence', () => {
  it('saves after every action so a killed tab loses nothing', () => {
    const storage = memoryStorage()
    setup(storage).addPlayer('Rami')
    expect(JSON.parse(storage.dump()[STORAGE_KEY]).players[0].name).toBe('Rami')
  })

  it('keeps working in memory when storage is unavailable, and says so', () => {
    const app = setup(null)
    expect(app.meta.status).toBe('unavailable')
    expect(app.addPlayer('Rami')).toBeNull()
    expect(app.state.players).toHaveLength(1)
  })

  it('switches to "unavailable" when a save fails mid-session (quota full)', () => {
    let fail = false
    const flaky: StorageLike = { getItem: () => null, setItem: () => { if (fail) throw new Error('quota') } }
    const app = setup(flaky)
    fail = true
    app.addPlayer('Rami')
    expect(app.meta).toMatchObject({ status: 'unavailable', canSave: false })
  })
})

describe('rounds', () => {
  it('locks the language while a round is in progress', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(() => app.setLanguage('ar')).toThrow()
    expect(app.state.language).toBe('en')
  })

  it('applies scores exactly once, even if the app reloads on the result screen', () => {
    const storage = memoryStorage()
    const app = setup(storage)
    withPlayers(app)
    app.updateSettings({ scoring: true })
    app.beginRound({ kind: 'random' })
    revealAll(app)
    app.dispatch({ type: 'endDiscussion' })
    const r = app.state.round!
    app.dispatch({ type: 'voteOut', playerId: r.imposterIds[0] })
    app.dispatch({ type: 'imposterGuess', correct: false })
    const scores = JSON.parse(JSON.stringify(app.state.session!.scores))

    const reloaded = setup(storage)
    expect(reloaded.state.round?.phase).toBe('result')
    expect(reloaded.state.session!.scores).toEqual(scores)
    expect(reloaded.state.session!.rounds).toBe(1)
    expect(() => reloaded.dispatch({ type: 'imposterGuess', correct: true })).toThrow()

    for (const id of r.participantIds) {
      expect(scores[id].points).toBe(r.imposterIds.includes(id) ? 0 : 1)
    }
  })

  it('does not repeat a random word until every word in the selected categories was used', () => {
    const app = setup()
    withPlayers(app)
    for (const id of [...app.state.selectedCategoryIds]) if (id !== 'food') app.toggleCategory(id)
    const seen = new Set<string>()
    for (let i = 0; i < 25; i++) {
      app.beginRound({ kind: 'random' })
      seen.add(app.state.round!.secret!.wordId)
      playOut(app)
    }
    expect(seen.size).toBe(25)
  })

  it('saves the Game Master word, selects its new category, and deals it without the GM', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.beginRound({ kind: 'playerGm', gmPlayerId: ids[0] })
    expect(app.state.round!.participantIds).not.toContain(ids[0])
    expect(app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { newName: 'Jordanian food' } })).toEqual([])
    expect(app.state.round!.phase).toBe('reveal')
    expect(app.state.round!.secret!.word).toBe('Mansaf')
    expect(app.state.customWords.map((w) => w.text.en)).toEqual(['Mansaf'])
    expect(app.state.selectedCategoryIds).toContain(app.state.customCategories[0].id)
  })

  it('returns Game Master form errors without starting the deal', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    expect(app.submitGmWord({ lang: 'en', word: ' ', hint: '', category: { existingId: 'food' } }))
      .toEqual([{ field: 'word', code: 'empty' }])
    expect(app.state.round!.phase).toBe('gmEntry')
    expect(app.state.customWords).toEqual([])
  })

  it('refuses to remove a player who is in the running round, and the round still completes', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(app.removePlayer(ids[1])).toBe('inRound')
    expect(app.state.players).toHaveLength(4)
    playOut(app)
    expect(app.removePlayer(ids[1])).toBeNull()
  })

  it('keeps a running round intact when its custom word is deleted, and never deals that word again', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { newName: 'Jordanian food' } })
    const categoryId = app.state.customCategories[0].id
    const wordId = app.state.round!.secret!.wordId
    app.deleteCustomCategory(categoryId)
    expect(app.state.round!.secret!.word).toBe('Mansaf')
    expect(app.state.selectedCategoryIds).not.toContain(categoryId)
    playOut(app)
    for (let i = 0; i < 30; i++) {
      app.beginRound({ kind: 'random' })
      expect(app.state.round!.secret!.wordId).not.toBe(wordId)
      playOut(app)
    }
  })

  it('explains why a round cannot start', () => {
    const app = setup()
    const ids = withPlayers(app, ['A', 'B', 'C'])
    expect(app.roundBlocker({ kind: 'random' })).toBeNull()
    expect(app.roundBlocker({ kind: 'playerGm', gmPlayerId: ids[0] })).toBe('needPlayers')
    expect(app.roundBlocker({ kind: 'playerGm', gmPlayerId: 'ghost' })).toBe('noGm')
    for (const id of [...app.state.selectedCategoryIds]) app.toggleCategory(id)
    expect(app.roundBlocker({ kind: 'random' })).toBe('noWords')
    expect(app.roundBlocker({ kind: 'outsideGm' })).toBeNull()
  })

  it('tells the between-rounds screen when the imposter count will be lowered', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ imposterCount: 3 })
    expect(app.clampedImposterCount({ kind: 'random' })).toBe(1)
    app.updateSettings({ imposterCount: 1 })
    expect(app.clampedImposterCount({ kind: 'random' })).toBeNull()
  })
})

describe('import', () => {
  it('applies a previewed import and makes its new categories playable', () => {
    const app = setup()
    const preview = app.previewImport({
      format: 'fennas-imposter', version: 1,
      categories: [{ id: 'jo', name: { en: 'Jordan' } }],
      words: [{ id: 'jo.mansaf', categoryId: 'jo', text: { en: 'Mansaf' } }],
    }, 'url')
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    app.applyImport(preview.plan)
    expect(app.state.customWords.map((w) => w.id)).toEqual(['jo.mansaf'])
    expect(app.state.selectedCategoryIds).toContain('jo')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/composables/useApp.test.ts`
Expected: FAIL, `error: Cannot find module './useApp'`.

- [ ] **Step 3: Implement `src/composables/useApp.ts`**

```ts
import { computed, reactive } from 'vue'
import type { Lang, Localized, Secret, Settings, Source } from '../engine/types'
import { cryptoRng, newId, type Rng } from '../engine/rng'
import { eligibleWords, makeSecret, pickWord } from '../engine/words'
import { MIN_PARTICIPANTS, maxImposters } from '../engine/assign'
import { participantsFor, reduce, startRound, type RoundAction } from '../engine/round'
import { scoreDeltas } from '../engine/scoring'
import { browserStorage, loadStored, saveStored, type LoadStatus, type StorageLike } from '../data/storage'
import * as roster from '../data/roster'
import * as custom from '../data/content'
import { parsePack, planImport, type ImportMode, type ImportPlan, type PackError } from '../data/transfer'
import { translate, type MessageKey, type Params } from '../i18n'

export interface AppDeps {
  storage: StorageLike | null
  rng: Rng
  now: () => number
  newId: () => string
}

export type RoundBlocker = 'needPlayers' | 'noWords' | 'noGm'
export type RosterError = roster.NameError | 'inRound'
export type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; errors: PackError[] }

export function createAppStore(deps: AppDeps) {
  const loaded = loadStored(deps.storage, deps.now())
  const state = reactive(loaded.stored)
  const meta = reactive<{ status: LoadStatus; canSave: boolean; noticeDismissed: boolean }>({
    status: loaded.status,
    canSave: loaded.canSave,
    noticeDismissed: false,
  })

  function persist(): void {
    if (!meta.canSave) return
    if (!saveStored(deps.storage, state)) {
      meta.canSave = false
      meta.status = 'unavailable'
      meta.noticeDismissed = false
    }
  }

  const content = computed(() => custom.allContent(state))

  function t(key: MessageKey, params?: Params): string {
    return translate(state.language, key, params)
  }

  function playerName(id: string): string {
    return state.players.find((p) => p.id === id)?.name ?? state.session?.scores[id]?.name ?? '?'
  }

  function activeIds(): string[] {
    const active = new Set(state.activePlayerIds)
    return state.players.filter((p) => active.has(p.id)).map((p) => p.id)
  }

  function applyRoster(r: roster.Roster): void {
    state.players = r.players
    state.activePlayerIds = r.activePlayerIds
  }

  function applyCustom(c: custom.CustomContent): void {
    const before = new Set(state.customCategories.map((x) => x.id))
    state.customCategories = c.customCategories
    state.customWords = c.customWords
    const added = c.customCategories.map((x) => x.id).filter((id) => !before.has(id))
    const selected = new Set(state.selectedCategoryIds)
    state.selectedCategoryIds = [...state.selectedCategoryIds, ...added.filter((id) => !selected.has(id))]
  }

  function setLanguage(lang: Lang): void {
    if (state.round) throw new Error('The language is locked during a round')
    state.language = lang
    persist()
  }

  function addPlayer(name: string): RosterError | null {
    const r = roster.addPlayer(state, name, deps.newId)
    if (!r.ok) return r.error
    applyRoster(r.roster)
    persist()
    return null
  }

  function renamePlayer(id: string, name: string): RosterError | null {
    const r = roster.renamePlayer(state, id, name)
    if (!r.ok) return r.error
    applyRoster(r.roster)
    persist()
    return null
  }

  function isInRound(id: string): boolean {
    const r = state.round
    if (!r) return false
    return r.participantIds.includes(id) || (r.source.kind === 'playerGm' && r.source.gmPlayerId === id)
  }

  function removePlayer(id: string): RosterError | null {
    if (isInRound(id)) return 'inRound'
    applyRoster(roster.removePlayer(state, id))
    persist()
    return null
  }

  function setActive(id: string, active: boolean): void {
    applyRoster(roster.setActive(state, id, active))
    persist()
  }

  function toggleCategory(id: string): void {
    state.selectedCategoryIds = state.selectedCategoryIds.includes(id)
      ? state.selectedCategoryIds.filter((c) => c !== id)
      : [...state.selectedCategoryIds, id]
    persist()
  }

  function updateSettings(patch: Partial<Settings>): void {
    state.settings = { ...state.settings, ...patch }
    persist()
  }

  function ensureSession(): void {
    if (state.session) return
    state.session = { scores: {}, rounds: 0 }
    persist()
  }

  function endSession(): void {
    state.session = null
    state.round = null
    persist()
  }

  function roundBlocker(source: Source): RoundBlocker | null {
    const active = activeIds()
    if (source.kind === 'playerGm' && !active.includes(source.gmPlayerId)) return 'noGm'
    if (participantsFor(active, source).length < MIN_PARTICIPANTS) return 'needPlayers'
    if (source.kind === 'random' && eligibleWords(content.value, state.language, state.selectedCategoryIds).length === 0) {
      return 'noWords'
    }
    return null
  }

  function clampedImposterCount(source: Source): number | null {
    if (state.settings.randomImposterCount) return null
    const max = maxImposters(participantsFor(activeIds(), source).length)
    return max >= 1 && state.settings.imposterCount > max ? max : null
  }

  function beginRound(source: Source): void {
    const blocker = roundBlocker(source)
    if (blocker) throw new Error(`Cannot start a round: ${blocker}`)
    if (state.round) throw new Error('A round is already in progress')
    if (!state.session) state.session = { scores: {}, rounds: 0 }
    const lang = state.language
    let secret: Secret | null = null
    if (source.kind === 'random') {
      const eligible = eligibleWords(content.value, lang, state.selectedCategoryIds)
      const picked = pickWord(eligible, state.usedWordIds[lang], deps.rng)
      const category = content.value.categories.find((c) => c.id === picked.word.categoryId)
      if (!category) throw new Error(`Category ${picked.word.categoryId} is missing`)
      secret = makeSecret(picked.word, category, lang)
      state.usedWordIds = { ...state.usedWordIds, [lang]: picked.used }
    }
    state.round = startRound(
      { number: state.session.rounds + 1, lang, source, activePlayerIds: activeIds(), settings: state.settings, secret },
      deps.rng,
    ).round
    persist()
  }

  function submitGmWord(input: custom.GmWordInput): custom.GmWordError[] {
    const round = state.round
    if (!round || round.phase !== 'gmEntry') throw new Error('No round is waiting for a Game Master word')
    if (input.lang !== round.lang) throw new Error('The Game Master word must be in the round language')
    const errors = custom.validateGmWord(input, content.value)
    if (errors.length > 0) return errors
    const saved = custom.addGmWord(state, input, deps.newId)
    applyCustom(saved.custom)
    state.round = reduce(round, { type: 'setSecret', secret: makeSecret(saved.word, saved.category, round.lang) })
    persist()
    return []
  }

  function dispatch(action: RoundAction): void {
    const prev = state.round
    if (!prev) throw new Error('No round in progress')
    const next = reduce(prev, action)
    if (next.phase === 'result' && prev.phase !== 'result' && state.session) {
      const deltas = scoreDeltas(next)
      const scores = { ...state.session.scores }
      for (const id of next.participantIds) {
        scores[id] = { name: playerName(id), points: (scores[id]?.points ?? 0) + (deltas[id] ?? 0) }
      }
      state.session = { scores, rounds: state.session.rounds + 1 }
    }
    state.round = next
    persist()
  }

  function finishRound(): void {
    if (state.round?.phase !== 'result') throw new Error('The round is not finished')
    state.round = null
    persist()
  }

  function abandonRound(): void {
    state.round = null
    persist()
  }

  function updateCustomWord(id: string, text: Localized, hint: Localized): custom.LocalizedError[] {
    const errors = custom.validateWordEdit(text, hint)
    if (errors.length > 0) return errors
    applyCustom(custom.updateCustomWord(state, id, text, hint))
    persist()
    return []
  }

  function updateCustomCategory(id: string, name: Localized): custom.LocalizedError[] {
    const errors = custom.validateCategoryEdit(name)
    if (errors.length > 0) return errors
    applyCustom(custom.updateCustomCategory(state, id, name))
    persist()
    return []
  }

  function deleteCustomWord(id: string): void {
    applyCustom(custom.deleteCustomWord(state, id))
    persist()
  }

  function deleteCustomCategory(id: string): void {
    applyCustom(custom.deleteCustomCategory(state, id))
    state.selectedCategoryIds = state.selectedCategoryIds.filter((c) => c !== id)
    persist()
  }

  function previewImport(json: unknown, mode: ImportMode): PreviewResult {
    const parsed = parsePack(json, new Set(content.value.categories.map((c) => c.id)))
    if (!parsed.ok) return parsed
    return { ok: true, plan: planImport(parsed.pack, state, mode, deps.newId) }
  }

  function applyImport(plan: ImportPlan): void {
    applyCustom(plan.result)
    state.players = plan.result.players
    state.settings = plan.result.settings
    persist()
  }

  function setLastImportUrl(url: string): void {
    state.lastImportUrl = url.trim() || null
    persist()
  }

  function dismissNotice(): void {
    meta.noticeDismissed = true
  }

  return {
    state, meta, content, t, playerName,
    setLanguage, addPlayer, renamePlayer, removePlayer, setActive, toggleCategory, updateSettings,
    ensureSession, endSession, roundBlocker, clampedImposterCount, beginRound, submitGmWord, dispatch,
    finishRound, abandonRound,
    updateCustomWord, updateCustomCategory, deleteCustomWord, deleteCustomCategory,
    previewImport, applyImport, setLastImportUrl, dismissNotice,
  }
}

export type AppStore = ReturnType<typeof createAppStore>

let instance: AppStore | null = null

export function useApp(): AppStore {
  instance ??= createAppStore({ storage: browserStorage(), rng: cryptoRng, now: () => Date.now(), newId })
  return instance
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `podman compose exec web bun test ./src/composables/useApp.test.ts`
Expected: `13 pass`, `0 fail`.

- [ ] **Step 5: Run the full unit suite and type-check, then commit**

Run: `podman compose exec web bun test`
Expected: PASS (all unit tests, 0 failed, 0 skipped).

Run: `podman compose exec web bun run typecheck`
Expected: exits 0.

```bash
jj commit -m "feat(app): add reactive app store that persists every action

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Candy Pop design system, app shell and Home

**Files:**
- Create:
  - Styles: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/animations.css`
  - UI components: `src/components/ui/Screen.vue`, `BgShapes.vue`, `PopButton.vue`, `StickerCard.vue`, `Chip.vue`, `Toggle.vue`, `Stepper.vue`, `Confetti.vue`, `LanguageSwitch.vue`, `StatusBanner.vue`
  - `src/router.ts`, `src/views/HomeView.vue`
- Modify: `src/main.ts`, `src/App.vue` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `useApp` (Task 14); `dirFor`, `MessageKey` (Task 8); `LANGS` (Task 2).
- Produces:
  - Components used by every later view:
    - `<Screen tone="sun|bubblegum|mint" align="center|start">` with slots `#top`, default, `#actions`
    - `<PopButton variant="primary|secondary|danger" type attention disabled>`
    - `<StickerCard tone="paper|ink" motion="none|wobble|shake">`
    - `<Chip>`
    - `<Toggle v-model label testid>`; the `data-testid` goes on the clickable `<label>`
    - `<Stepper v-model min max step label decrease-label increase-label display disabled testid>`, which renders `${testid}-dec`, `${testid}-value` and `${testid}-inc`
    - `<Confetti>`
    - `<LanguageSwitch>`, with test ids `lang-en`/`lang-ar`; hidden during a round
    - `<StatusBanner>`
  - Global CSS classes:
    - Layout and panels: `.stack`, `.row`, `.grow`, `.panel`, `.center`, `.visually-hidden`
    - Forms: `.input`, `.field`, `.error-text`, `.icon-btn`
    - Text: `.guide`, `.title-xl`, `.secret-word`
    - Animation: `.anim-loop`, `.anim-wobble`, `.anim-shake`, `.anim-drift`, `.anim-squish`, and the `pop` transition
  - `router` (hash history), with route `/` → `HomeView` and a catch-all → `/`
  - Home test ids: `play`, `nav-setup`, `nav-words`, `nav-data`

This is visual work, so it has no unit test. Verification is type-check, lint, build and a manual look in both languages. The reference mockup is `.superpowers/brainstorm/*/content/visual-style.html`, option A.

- [ ] **Step 1: Create the global styles**

`src/styles/tokens.css`:
```css
:root {
  --sun: #ffe14d;
  --bubblegum: #ff5da2;
  --grape: #6c4dff;
  --mint: #00c2a8;
  --tangerine: #ff7a00;
  --ink: #1b1036;
  --paper: #ffffff;
  --danger-text: #9b0036;

  --outline: 3px solid var(--ink);
  --shadow-x: 6px;
  --shadow-x-sm: 3px;
  --shadow-hard: var(--shadow-x) 6px 0 var(--ink);
  --shadow-hard-sm: var(--shadow-x-sm) 3px 0 var(--ink);

  --radius-lg: 22px;
  --radius-md: 18px;
  --radius-sm: 14px;
  --radius-pill: 999px;

  --font: 'Baloo Bhaijaan 2', system-ui, sans-serif;
  --tap: 48px;
  --max-width: 480px;
}

/* Hard shadows fall toward the end of the reading direction. Must come after :root. */
[dir='rtl'] {
  --shadow-x: -6px;
  --shadow-x-sm: -3px;
}
```

`src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  min-height: 100dvh;
  font-family: var(--font);
  font-weight: 500;
  color: var(--ink);
  background: var(--sun);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 3px solid var(--grape); outline-offset: 3px; }
h1, h2, h3, p { margin: 0; }
h1, h2, h3 { font-weight: 800; line-height: 1.15; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.stack { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; min-width: 0; }
.center { text-align: center; }
.title-xl { font-size: clamp(2rem, 10vw, 2.9rem); font-weight: 800; line-height: 1.1; overflow-wrap: anywhere; }
.secret-word { font-size: clamp(2rem, 11vw, 3rem); font-weight: 800; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
.guide { padding: 10px 12px; border-radius: var(--radius-sm); background: rgb(255 255 255 / 0.8); font-weight: 500; text-align: center; overflow-wrap: anywhere; }
.panel { padding: 14px; border: var(--outline); border-radius: var(--radius-md); background: var(--paper); box-shadow: var(--shadow-hard-sm); }
.field { display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
.input { width: 100%; min-height: var(--tap); padding: 8px 12px; border: var(--outline); border-radius: var(--radius-sm); background: var(--paper); }
.error-text { color: var(--danger-text); font-size: 0.95rem; font-weight: 700; }
.icon-btn { min-width: var(--tap); min-height: var(--tap); padding-inline: 12px; border: var(--outline); border-radius: var(--radius-sm); background: var(--paper); font-weight: 800; }
```

`src/styles/animations.css`:
```css
@keyframes wobble { 0%, 100% { transform: rotate(-3deg) scale(1); } 50% { transform: rotate(2.5deg) scale(1.04); } }
@keyframes shake {
  0%, 70%, 100% { transform: rotate(-3deg) translate(0, 0); }
  74% { transform: rotate(-3deg) translate(-4px, 1px); }
  78% { transform: rotate(-3deg) translate(4px, -1px); }
  82% { transform: rotate(-3deg) translate(-3px, 0); }
  86% { transform: rotate(-3deg) translate(3px, 1px); }
}
@keyframes drift { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(14px, -22px) rotate(35deg); } }
@keyframes squish { 0%, 80%, 100% { transform: translate(0, 0); } 88% { transform: translate(var(--shadow-x-sm), 3px); } }
/* Whole screens use this: vertical motion only. Any horizontal growth — scale, rotation, or the
   easing's overshoot applied to a scale — pokes the screen past the viewport sideways. */
@keyframes pop-in {
  0% { opacity: 0; transform: translateY(32px); }
  70% { opacity: 1; transform: translateY(-6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes confetti-fall { from { transform: translateY(-10vh) rotate(0deg); } to { transform: translateY(110vh) rotate(720deg); } }

/* <Transition name="pop">: enter animation only. Leaving screens vanish at once so a card never lingers. */
.pop-enter-active { animation: pop-in 320ms cubic-bezier(0.2, 0.9, 0.3, 1.3) both; }

.anim-wobble { animation: wobble 2.6s ease-in-out infinite; }
.anim-shake { animation: shake 1.8s ease-in-out infinite; }
.anim-drift { animation: drift 7s ease-in-out infinite alternate; }
.anim-squish { animation: squish 2.2s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .anim-loop { animation: none !important; }
  .pop-enter-active { animation: fade-in 150ms ease both; }
}
```

- [ ] **Step 2: Create the layout primitives**

`src/components/ui/Screen.vue`:
```vue
<script setup lang="ts">
import BgShapes from './BgShapes.vue'

withDefaults(defineProps<{ tone?: 'sun' | 'bubblegum' | 'mint'; align?: 'center' | 'start' }>(), {
  tone: 'sun',
  align: 'center',
})
</script>

<template>
  <main class="screen" :class="`tone-${tone}`">
    <BgShapes />
    <div class="inner">
      <header v-if="$slots.top" class="top"><slot name="top" /></header>
      <section class="body" :class="`align-${align}`"><slot /></section>
      <footer v-if="$slots.actions" class="actions"><slot name="actions" /></footer>
    </div>
  </main>
</template>

<style scoped>
.screen { position: relative; min-height: 100dvh; overflow: hidden; }
.tone-sun { background: var(--sun); }
.tone-bubblegum { background: var(--bubblegum); }
.tone-mint { background: var(--mint); }
.inner {
  position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px;
  max-width: var(--max-width); min-height: 100dvh; margin-inline: auto;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
}
.top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.body { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.align-center { justify-content: center; }
.align-start { justify-content: flex-start; }
.actions { display: flex; flex-direction: column; gap: 10px; }
</style>
```

`src/components/ui/BgShapes.vue`:
```vue
<template>
  <div class="shapes" aria-hidden="true">
    <span class="shape s1 anim-loop anim-drift" />
    <span class="shape s2 anim-loop anim-drift" />
    <span class="shape s3 anim-loop anim-drift" />
    <span class="shape s4 anim-loop anim-drift" />
  </div>
</template>

<style scoped>
.shapes { position: absolute; inset: 0; pointer-events: none; }
.shape { position: absolute; border: var(--outline); }
.s1 { top: 40px; inset-inline-start: -18px; width: 60px; height: 60px; border-radius: 50%; background: var(--grape); }
.s2 { bottom: 140px; inset-inline-end: -10px; width: 44px; height: 44px; background: var(--mint); animation-duration: 5s; }
.s3 { bottom: 40px; inset-inline-start: 20px; width: 90px; height: 26px; border-radius: var(--radius-pill); background: var(--tangerine); animation-duration: 6s; animation-delay: -2s; }
.s4 { top: 90px; inset-inline-end: 24px; width: 30px; height: 30px; border-radius: 50%; background: var(--paper); animation-duration: 4s; }
</style>
```

`src/components/ui/PopButton.vue`:
```vue
<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit'; attention?: boolean; disabled?: boolean }>(),
  { variant: 'primary', type: 'button', attention: false, disabled: false },
)
</script>

<template>
  <button :type="type" class="pop-btn" :class="[variant, { 'anim-loop anim-squish': attention && !disabled }]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.pop-btn {
  width: 100%; min-height: var(--tap); padding: 10px 16px;
  border: var(--outline); border-radius: var(--radius-md); box-shadow: var(--shadow-hard-sm);
  font-size: 1.15rem; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere;
  transition: transform 80ms ease;
}
.primary { background: var(--grape); color: var(--paper); }
.secondary { background: var(--paper); color: var(--ink); }
.danger { background: var(--bubblegum); color: var(--ink); }
/* Pressed: slide onto the shadow. The shadow switch is instant (not animated). */
.pop-btn:active:not(:disabled) { transform: translate(var(--shadow-x-sm), 3px); box-shadow: none; }
.pop-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

`src/components/ui/StickerCard.vue`:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'paper' | 'ink'; motion?: 'none' | 'wobble' | 'shake' }>(), {
  tone: 'paper',
  motion: 'none',
})
</script>

<template>
  <div class="sticker" :class="[`tone-${tone}`, motion !== 'none' && ['anim-loop', `anim-${motion}`]]">
    <slot />
  </div>
</template>

<style scoped>
.sticker {
  max-width: 100%; margin-inline: auto; padding: 18px 22px;
  border: var(--outline); border-radius: var(--radius-lg); box-shadow: var(--shadow-hard);
  text-align: center; overflow-wrap: anywhere;
}
.tone-paper { background: var(--paper); color: var(--ink); }
.tone-ink { background: var(--ink); color: var(--sun); }
</style>
```

`src/components/ui/Chip.vue`:
```vue
<template>
  <span class="chip"><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-flex; align-items: center; min-height: 32px; padding: 2px 14px;
  border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm);
  font-size: 0.9rem; font-weight: 700; overflow-wrap: anywhere;
}
</style>
```

- [ ] **Step 3: Create the form and effect primitives**

`src/components/ui/Toggle.vue`:
```vue
<script setup lang="ts">
defineProps<{ label: string; testid?: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="toggle" :data-testid="testid">
    <input v-model="model" type="checkbox" class="visually-hidden">
    <span class="track" aria-hidden="true"><span class="thumb" /></span>
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle { display: flex; align-items: center; gap: 12px; min-height: var(--tap); font-weight: 700; cursor: pointer; }
.track { position: relative; flex: none; width: 56px; height: 32px; border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); }
.thumb { position: absolute; top: 3px; inset-inline-start: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ink); }
input:checked + .track { background: var(--mint); }
input:checked + .track .thumb { inset-inline-start: 27px; }
input:focus-visible + .track { outline: 3px solid var(--grape); outline-offset: 3px; }
</style>
```

`src/components/ui/Stepper.vue`:
```vue
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    min: number
    max: number
    step?: number
    label: string
    decreaseLabel: string
    increaseLabel: string
    display?: string
    disabled?: boolean
    testid?: string
  }>(),
  { step: 1, display: undefined, disabled: false, testid: undefined },
)
const model = defineModel<number>({ required: true })

function change(delta: number): void {
  model.value = Math.min(props.max, Math.max(props.min, model.value + delta))
}
</script>

<template>
  <div class="stepper" :class="{ off: disabled }">
    <span class="label">{{ label }}</span>
    <div class="controls">
      <button type="button" class="icon-btn" :aria-label="decreaseLabel" :disabled="disabled || model <= min" :data-testid="testid && `${testid}-dec`" @click="change(-step)">−</button>
      <output class="value" :data-testid="testid && `${testid}-value`">{{ display ?? model }}</output>
      <button type="button" class="icon-btn" :aria-label="increaseLabel" :disabled="disabled || model >= max" :data-testid="testid && `${testid}-inc`" @click="change(step)">+</button>
    </div>
  </div>
</template>

<style scoped>
.stepper { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: var(--tap); font-weight: 700; }
.stepper.off { opacity: 0.5; }
.controls { display: flex; align-items: center; gap: 8px; }
.value { min-width: 4ch; font-size: 1.3rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; direction: ltr; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

`src/components/ui/Confetti.vue`:
```vue
<script setup lang="ts">
const COLORS = ['var(--sun)', 'var(--bubblegum)', 'var(--grape)', 'var(--mint)', 'var(--tangerine)']
const pieces = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  start: Math.random() * 100,
  delay: Math.random() * 0.8,
  duration: 1.6 + Math.random() * 1.2,
  color: COLORS[i % COLORS.length],
  size: 8 + Math.round(Math.random() * 8),
}))
</script>

<template>
  <div class="confetti" aria-hidden="true">
    <span
      v-for="p in pieces"
      :key="p.id"
      class="piece"
      :style="{
        insetInlineStart: `${p.start}%`,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.duration}s`,
        background: p.color,
        width: `${p.size}px`,
        height: `${p.size * 1.4}px`,
      }"
    />
  </div>
</template>

<style scoped>
.confetti { position: fixed; inset: 0; z-index: 5; overflow: hidden; pointer-events: none; }
.piece { position: absolute; top: 0; border: 2px solid var(--ink); border-radius: 3px; animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: both; }
@media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
</style>
```

`src/components/ui/LanguageSwitch.vue`:
```vue
<script setup lang="ts">
import { LANGS } from '../../engine/types'
import { useApp } from '../../composables/useApp'

const app = useApp()
</script>

<template>
  <div v-if="!app.state.round" class="lang-switch" role="group" :aria-label="app.t('home.language')">
    <button
      v-for="lang in LANGS"
      :key="lang"
      type="button"
      class="lang"
      :class="{ active: app.state.language === lang }"
      :aria-pressed="app.state.language === lang"
      :lang="lang"
      :data-testid="`lang-${lang}`"
      @click="app.setLanguage(lang)"
    >
      {{ app.t(`lang.${lang}`) }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch { display: inline-flex; overflow: hidden; border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm); }
.lang { min-height: 40px; padding: 4px 14px; border: 0; background: transparent; font-weight: 800; }
.lang.active { background: var(--ink); color: var(--sun); }
</style>
```

`src/components/ui/StatusBanner.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import type { MessageKey } from '../../i18n'

const app = useApp()
const message = computed<MessageKey | null>(() => {
  const { status, noticeDismissed } = app.meta
  if (status === 'unavailable') return 'storage.unavailable' // persistent: never dismissible
  if (noticeDismissed) return null
  if (status === 'corrupt') return 'storage.corrupt'
  if (status === 'newer') return 'storage.newer'
  return null
})
</script>

<template>
  <div v-if="message" class="banner" role="alert" data-testid="status-banner">
    <span>{{ app.t(message) }}</span>
    <button v-if="app.meta.status !== 'unavailable'" type="button" class="dismiss" @click="app.dismissNotice()">
      {{ app.t('common.dismiss') }}
    </button>
  </div>
</template>

<style scoped>
.banner { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--ink); color: var(--sun); font-weight: 700; }
.dismiss { flex: none; min-height: 40px; padding: 4px 14px; border: 2px solid var(--sun); border-radius: var(--radius-pill); background: transparent; color: var(--sun); font-weight: 800; }
</style>
```

- [ ] **Step 4: Create the router, app shell and Home**

`src/router.ts`:
```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
```

`src/App.vue` (replace the placeholder):
```vue
<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useApp } from './composables/useApp'
import { dirFor } from './i18n'
import StatusBanner from './components/ui/StatusBanner.vue'

const app = useApp()

watchEffect(() => {
  document.documentElement.lang = app.state.language
  document.documentElement.dir = dirFor(app.state.language)
  document.title = app.t('app.title')
})
</script>

<template>
  <StatusBanner />
  <RouterView v-slot="{ Component }">
    <Transition name="pop" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>
```

`src/views/HomeView.vue`:
```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import Screen from '../components/ui/Screen.vue'
import StickerCard from '../components/ui/StickerCard.vue'
import PopButton from '../components/ui/PopButton.vue'
import LanguageSwitch from '../components/ui/LanguageSwitch.vue'

const app = useApp()
const router = useRouter()

function play(): void {
  app.ensureSession()
  void router.push('/play')
}
</script>

<template>
  <Screen tone="sun">
    <template #top>
      <LanguageSwitch />
    </template>
    <StickerCard motion="wobble">
      <h1 class="title-xl">{{ app.t('app.title') }}</h1>
    </StickerCard>
    <p class="guide">{{ app.t('app.tagline') }}</p>
    <template #actions>
      <PopButton attention data-testid="play" @click="play">
        {{ app.state.session ? app.t('home.continue') : app.t('home.play') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="nav-setup" @click="router.push('/setup')">{{ app.t('home.setup') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-words" @click="router.push('/words')">{{ app.t('home.words') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-data" @click="router.push('/data')">{{ app.t('home.data') }}</PopButton>
    </template>
  </Screen>
</template>
```

The `/setup`, `/play`, `/words` and `/data` routes arrive in Tasks 16, 18, 19 and 20. Until then the catch-all sends those buttons back to Home.

`src/main.ts` (replace):
```ts
import { createApp } from 'vue'
import '@fontsource/baloo-bhaijaan-2/latin-500.css'
import '@fontsource/baloo-bhaijaan-2/latin-700.css'
import '@fontsource/baloo-bhaijaan-2/latin-800.css'
import '@fontsource/baloo-bhaijaan-2/arabic-500.css'
import '@fontsource/baloo-bhaijaan-2/arabic-700.css'
import '@fontsource/baloo-bhaijaan-2/arabic-800.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/animations.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 5: Verify**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint && podman compose exec web bun run build`
Expected: all three exit 0.

Open `http://localhost:5173`. Expected:
- A yellow screen with drifting outlined shapes and a wobbling white sticker titled "Fenna's Imposter".
- The primary button squishes periodically.
- Tapping **العربية** flips the layout to RTL: the switch moves, and shadows fall to the left.
- The title becomes «مين المندسّ؟» in Baloo Bhaijaan 2.
- The Network tab shows fonts served from `localhost` only.
- In DevTools, enabling "Emulate CSS prefers-reduced-motion: reduce" stops all looping motion.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(ui): add Candy Pop design system, app shell and home screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Setup screen and end-to-end test harness

**Files:**
- Create: `src/views/SetupView.vue`, `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/setup.spec.ts`
- Modify: `src/router.ts` (add `/setup`)

**Interfaces:**
- Consumes:
  - `useApp` (Task 14): `addPlayer`, `renamePlayer`, `removePlayer`, `setActive`, `toggleCategory`, `updateSettings`, `playerName`, `content`
  - `eligibleCategories`, `eligibleWords` (Task 4); `maxImposters` (Task 5); `LIMITS`, `TIMER` (Task 3); `formatClock` (Task 8)
  - The Task 15 primitives
- Produces:
  - Setup test ids: `player-row`, `new-player`, `add-player`, `add-error`, `category-<id>`, `imposters-*`, `toggle-random-imposters`, `toggle-hints`, `toggle-timer`, `timer-seconds-*`, `toggle-scoring`, `setup-done`
  - `tests/e2e/helpers.ts`: `addPlayers(page, names, opts?: { scoring?: boolean }): Promise<void>`. It starts on Home and ends on Home (or `/play` if a session exists).

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing e2e test**

`tests/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test'

/** From Home: open Setup, add players (fresh browser context assumed), optionally enable scoring, press Done. */
export async function addPlayers(page: Page, names: readonly string[], opts: { scoring?: boolean } = {}): Promise<void> {
  await page.getByTestId('nav-setup').click()
  for (const name of names) {
    await page.getByTestId('new-player').fill(name)
    await page.getByTestId('add-player').click()
  }
  await expect(page.getByTestId('player-row')).toHaveCount(names.length)
  if (opts.scoring) await page.getByTestId('toggle-scoring').click()
  await page.getByTestId('setup-done').click()
}
```

`tests/e2e/setup.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { addPlayers } from './helpers'

test('players are remembered after the app is closed and reopened', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await page.reload()
  await page.getByTestId('nav-setup').click()
  await expect(page.getByTestId('player-row')).toHaveCount(3)
})

test('names that only differ by case, spacing or Arabic spelling are rejected', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-setup').click()
  for (const [first, duplicate] of [['Rami', ' rami '], ['أحمد', 'احمد']]) {
    await page.getByTestId('new-player').fill(first)
    await page.getByTestId('add-player').click()
    await expect(page.getByTestId('add-error')).toHaveCount(0)
    await page.getByTestId('new-player').fill(duplicate)
    await page.getByTestId('add-player').click()
    await expect(page.getByTestId('add-error')).toBeVisible()
  }
  await expect(page.getByTestId('player-row')).toHaveCount(2)
})

test('Arabic flips the whole app right-to-left and is remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('the imposter count cannot be raised past what the players allow', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['A', 'B', 'C', 'D', 'E'])
  await page.getByTestId('nav-setup').click()
  await page.getByTestId('imposters-inc').click()
  await expect(page.getByTestId('imposters-value')).toHaveText('2')
  await expect(page.getByTestId('imposters-inc')).toBeDisabled()
})
```

- [ ] **Step 3: Run the e2e tests to verify they fail**

Run: `podman compose run --rm e2e`
Expected: FAIL. `nav-setup` leads back to Home (there is no `/setup` route yet), so `new-player` is never found. The third test (language) passes already.

- [ ] **Step 4: Implement `src/views/SetupView.vue` and add the route**

`src/views/SetupView.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp, type RosterError } from '../composables/useApp'
import { eligibleCategories, eligibleWords } from '../engine/words'
import { maxImposters } from '../engine/assign'
import { LIMITS, TIMER } from '../data/limits'
import { formatClock } from '../i18n'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'
import Toggle from '../components/ui/Toggle.vue'
import Stepper from '../components/ui/Stepper.vue'
import LanguageSwitch from '../components/ui/LanguageSwitch.vue'

const app = useApp()
const router = useRouter()

const newName = ref('')
const addError = ref<string | null>(null)
const rowError = ref<{ id: string; message: string } | null>(null)

function errorText(error: RosterError): string {
  switch (error) {
    case 'empty':
      return app.t('error.nameEmpty')
    case 'tooLong':
      return app.t('error.nameTooLong', { max: LIMITS.player })
    case 'taken':
      return app.t('error.nameTaken')
    case 'inRound':
      return app.t('error.inRound')
  }
}

function add(): void {
  const error = app.addPlayer(newName.value)
  addError.value = error ? errorText(error) : null
  if (!error) newName.value = ''
}

function rename(id: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const error = app.renamePlayer(id, input.value)
  rowError.value = error ? { id, message: errorText(error) } : null
  if (error) input.value = app.playerName(id)
}

function remove(id: string): void {
  const error = app.removePlayer(id)
  rowError.value = error ? { id, message: errorText(error) } : null
}

function toggleActive(id: string, event: Event): void {
  app.setActive(id, (event.target as HTMLInputElement).checked)
}

const categories = computed(() => {
  const lang = app.state.language
  return eligibleCategories(app.content.value, lang).map((c) => ({
    id: c.id,
    name: c.name[lang] ?? '',
    count: eligibleWords(app.content.value, lang, [c.id]).length,
  }))
})
const noneSelected = computed(() => !categories.value.some((c) => app.state.selectedCategoryIds.includes(c.id)))

const imposterMax = computed(() => Math.max(1, maxImposters(app.state.activePlayerIds.length)))
const imposters = computed({
  get: () => Math.min(app.state.settings.imposterCount, imposterMax.value),
  set: (imposterCount: number) => app.updateSettings({ imposterCount }),
})
const randomImposters = computed({
  get: () => app.state.settings.randomImposterCount,
  set: (randomImposterCount: boolean) => app.updateSettings({ randomImposterCount }),
})
const hints = computed({
  get: () => app.state.settings.hints,
  set: (value: boolean) => app.updateSettings({ hints: value }),
})
const scoring = computed({
  get: () => app.state.settings.scoring,
  set: (value: boolean) => app.updateSettings({ scoring: value }),
})
const timerEnabled = computed({
  get: () => app.state.settings.timer.enabled,
  set: (enabled: boolean) => app.updateSettings({ timer: { ...app.state.settings.timer, enabled } }),
})
const timerSeconds = computed({
  get: () => app.state.settings.timer.seconds,
  set: (seconds: number) => app.updateSettings({ timer: { ...app.state.settings.timer, seconds } }),
})

function done(): void {
  void router.push(app.state.session ? '/play' : '/')
}
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('setup.title') }}</h1>
      <LanguageSwitch />
    </template>

    <section class="panel stack">
      <h2>{{ app.t('setup.players') }}</h2>
      <p>{{ app.t('setup.activeCount', { count: app.state.activePlayerIds.length }) }}</p>
      <ul class="players">
        <li v-for="player in app.state.players" :key="player.id" data-testid="player-row">
          <div class="row">
            <label class="check">
              <input
                type="checkbox"
                :checked="app.state.activePlayerIds.includes(player.id)"
                :aria-label="app.t('setup.playing')"
                @change="toggleActive(player.id, $event)"
              >
            </label>
            <input class="input grow" :value="player.name" autocomplete="off" @change="rename(player.id, $event)">
            <button
              type="button"
              class="icon-btn"
              :aria-label="app.t('setup.removePlayer', { name: player.name })"
              @click="remove(player.id)"
            >
              ✕
            </button>
          </div>
          <p v-if="rowError?.id === player.id" class="error-text">{{ rowError.message }}</p>
        </li>
      </ul>
      <form class="row" @submit.prevent="add">
        <input
          v-model="newName"
          class="input grow"
          data-testid="new-player"
          :placeholder="app.t('setup.newPlayerPlaceholder')"
          autocomplete="off"
        >
        <button type="submit" class="icon-btn" data-testid="add-player">{{ app.t('setup.addPlayer') }}</button>
      </form>
      <p v-if="addError" class="error-text" data-testid="add-error">{{ addError }}</p>
    </section>

    <section class="panel stack">
      <h2>{{ app.t('setup.categories') }}</h2>
      <label v-for="c in categories" :key="c.id" class="category">
        <input
          type="checkbox"
          :checked="app.state.selectedCategoryIds.includes(c.id)"
          :data-testid="`category-${c.id}`"
          @change="app.toggleCategory(c.id)"
        >
        <span class="grow">{{ c.name }}</span>
        <span class="count">{{ app.t('setup.wordCount', { count: c.count }) }}</span>
      </label>
      <p v-if="noneSelected" class="error-text">{{ app.t('error.noCategories') }}</p>
    </section>

    <section class="panel stack">
      <h2>{{ app.t('setup.settings') }}</h2>
      <Stepper
        v-model="imposters"
        :min="1"
        :max="imposterMax"
        :label="app.t('setup.imposters')"
        :decrease-label="app.t('setup.decrease')"
        :increase-label="app.t('setup.increase')"
        :disabled="randomImposters"
        testid="imposters"
      />
      <Toggle v-model="randomImposters" :label="app.t('setup.randomImposters')" testid="toggle-random-imposters" />
      <Toggle v-model="hints" :label="app.t('setup.hints')" testid="toggle-hints" />
      <Toggle v-model="timerEnabled" :label="app.t('setup.timer')" testid="toggle-timer" />
      <Stepper
        v-if="timerEnabled"
        v-model="timerSeconds"
        :min="TIMER.min"
        :max="TIMER.max"
        :step="TIMER.step"
        :display="formatClock(timerSeconds)"
        :label="app.t('setup.timerLength')"
        :decrease-label="app.t('setup.decrease')"
        :increase-label="app.t('setup.increase')"
        testid="timer-seconds"
      />
      <Toggle v-model="scoring" :label="app.t('setup.scoring')" testid="toggle-scoring" />
    </section>

    <template #actions>
      <PopButton data-testid="setup-done" @click="done">{{ app.t('setup.done') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
.players { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.check { display: flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); }
.check input, .category input { width: 24px; height: 24px; accent-color: var(--grape); }
.category { display: flex; align-items: center; gap: 12px; min-height: var(--tap); font-weight: 700; }
.category .grow { overflow-wrap: anywhere; }
.count { font-weight: 500; opacity: 0.75; white-space: nowrap; }
</style>
```

In `src/router.ts`, import the view and add the route above the catch-all:
```ts
import SetupView from './views/SetupView.vue'
// …
    { path: '/setup', name: 'setup', component: SetupView },
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

Run: `podman compose run --rm e2e`
Expected: `4 pass`, `0 fail`.

- [ ] **Step 6: Lint, type-check and commit**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

```bash
jj commit -m "feat(ui): add setup screen and Playwright e2e harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Round composables (timer, wake lock, sound)

**Files:**
- Create: `src/composables/useTimer.ts`, `src/composables/useWakeLock.ts`, `src/composables/useSound.ts`
- Test: `src/composables/useTimer.test.ts`

**Interfaces:**
- Consumes: Vue `ref`, `computed`, `watch`, `onUnmounted`.
- Produces:
  - `interface TimerView { active: boolean; secondsLeft: number; ended: boolean }`
  - `timerView(endsAt: number | null, now: number): TimerView` (pure)
  - `useTimer(endsAt: () => number | null, onEnd: () => void): ComputedRef<TimerView>`. It fires `onEnd` once, only when time runs out while mounted, never for a timer that had already ended when the screen opened.
  - `useWakeLock(active: Ref<boolean>): void`
  - `useSound(): { prime(): void; beep(): void }`

- [ ] **Step 1: Write the failing test `src/composables/useTimer.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { timerView } from './useTimer'

describe('timerView', () => {
  it('is inactive when the round has no timer', () => {
    expect(timerView(null, 0)).toEqual({ active: false, secondsLeft: 0, ended: false })
  })

  it('counts from the stored end time, so a reload resumes instead of restarting', () => {
    expect(timerView(185_000, 5_000)).toEqual({ active: true, secondsLeft: 180, ended: false })
  })

  it('rounds up so it never shows 0:00 while time remains', () => {
    expect(timerView(10_000, 9_001).secondsLeft).toBe(1)
  })

  it('is ended at and after the end time (a reload after time-up shows "Time\'s up")', () => {
    expect(timerView(10_000, 10_000).ended).toBe(true)
    expect(timerView(10_000, 99_000)).toEqual({ active: true, secondsLeft: 0, ended: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `podman compose exec web bun test ./src/composables/useTimer.test.ts`
Expected: FAIL, `error: Cannot find module './useTimer'`.

- [ ] **Step 3: Implement the three composables**

`src/composables/useTimer.ts`:
```ts
import { computed, onUnmounted, ref, type ComputedRef } from 'vue'

export interface TimerView {
  active: boolean
  secondsLeft: number
  ended: boolean
}

export function timerView(endsAt: number | null, now: number): TimerView {
  if (endsAt === null) return { active: false, secondsLeft: 0, ended: false }
  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return { active: true, secondsLeft, ended: secondsLeft === 0 }
}

/**
 * Ticks four times a second. Calls onEnd once when the countdown reaches zero while mounted —
 * not when the screen opens on an already-finished timer (e.g. after a reload).
 */
export function useTimer(endsAt: () => number | null, onEnd: () => void): ComputedRef<TimerView> {
  const now = ref(Date.now())
  const view = computed(() => timerView(endsAt(), now.value))
  let fired = view.value.ended
  const id = setInterval(() => {
    now.value = Date.now()
    if (!fired && view.value.ended) {
      fired = true
      onEnd()
    }
  }, 250)
  onUnmounted(() => clearInterval(id))
  return view
}
```

`src/composables/useWakeLock.ts`:
```ts
import { onUnmounted, watch, type Ref } from 'vue'

/** Keeps the screen on while `active` is true. Silently does nothing where unsupported. */
export function useWakeLock(active: Ref<boolean>): void {
  let sentinel: WakeLockSentinel | null = null

  async function acquire(): Promise<void> {
    if (!('wakeLock' in navigator) || sentinel || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  async function release(): Promise<void> {
    const current = sentinel
    sentinel = null
    try {
      await current?.release()
    } catch {
      // already released by the browser
    }
  }

  // Browsers drop the lock when the tab is hidden; take it back when the phone is unlocked.
  function onVisibilityChange(): void {
    if (active.value && document.visibilityState === 'visible') void acquire()
  }

  watch(active, (on) => void (on ? acquire() : release()), { immediate: true })
  document.addEventListener('visibilitychange', onVisibilityChange)
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void release()
  })
}
```

`src/composables/useSound.ts`:
```ts
let context: AudioContext | null = null

/** Generated beeps, no audio files. iOS only allows audio after a tap, so call prime() from a tap handler. */
export function useSound(): { prime(): void; beep(): void } {
  function prime(): void {
    try {
      context ??= new AudioContext()
      void context.resume()
    } catch {
      context = null
    }
  }

  function beep(): void {
    const audio = context
    if (!audio) return
    const start = audio.currentTime
    ;[880, 660, 880].forEach((frequency, i) => {
      const t0 = start + i * 0.25
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(t0)
      oscillator.stop(t0 + 0.22)
    })
  }

  return { prime, beep }
}
```

- [ ] **Step 4: Run the test and type-check**

Run: `podman compose exec web bun test ./src/composables/useTimer.test.ts`
Expected: `4 pass`, `0 fail`.

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(ui): add resumable timer, wake lock and generated beep composables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Play screen — the whole round flow

**Files:**
- Create:
  - `src/views/PlayView.vue`
  - Phase components: `src/components/phases/BetweenRounds.vue`, `GmEntry.vue`, `RevealStep.vue`, `Discussion.vue`, `VoteStep.vue`, `GuessStep.vue`, `ResultStep.vue`, `Scoreboard.vue`
  - Test: `tests/e2e/round.spec.ts`
- Modify: `src/router.ts` (add `/play`), `tests/e2e/helpers.ts` (add `dealCards`)

**Interfaces:**
- Consumes:
  - `useApp` (Task 14): `beginRound`, `submitGmWord`, `dispatch`, `finishRound`, `abandonRound`, `endSession`, `roundBlocker`, `clampedImposterCount`, `playerName`, `content`
  - `categoriesNamedIn`, `GmField`, `GmWordError` (Task 12); `imposterHint` (Task 4)
  - `formatClock`, `formatList`, `MessageKey` (Task 8)
  - `useTimer`, `useWakeLock`, `useSound` (Task 17); the Task 15 primitives
- Produces:
  - **Round-flow test ids:**
    - Between rounds: `between-rounds`, `source-random`, `source-playerGm`, `source-outsideGm`, `gm-select`, `round-blocker`, `clamp-notice`, `start-round`, `edit-setup`, `end-game`
    - GM entry: `gm-pass`, `gm-ready`, `gm-form`, `gm-word`, `gm-category` (value `__new__` = new category), `gm-new-category`, `gm-hint`, `gm-submit`
    - Reveal: `pass-screen`, `pass-name`, `show-card`, `card-screen`, `secret-word`, `imposter-title`, `imposter-hint`, `hide-pass`
    - Discussion: `discussion`, `starter`, `imposter-count`, `timer`, `end-discussion`
    - Vote and guess: `vote`, `vote-player`, `vote-nobody`, `guess`, `guess-yes`, `guess-no`
    - Result: `result`, `winner`, `result-imposters`, `result-word`, `next-round`, `scoreboard`, `score-row`
    - Error screen: `crashed`
  - `helpers.ts`:
    - `interface Deal { imposters: string[]; crew: string[]; crewWords: string[]; hints: string[] }`
    - `dealCards(page, count, onScreen?): Promise<Deal>`

**Behavior notes:**
- Phases change inside one route, so they add no history entries (spec §7.2). Leaving `/play` mid-round asks for confirmation and keeps the round resumable.
- `RevealStep` is keyed by `revealIndex`, so each player gets a fresh instance with the card hidden.
- `RevealStep` sets `shown = false` **before** dispatching `cardSeen`. The instance on its way out can then only render a pass screen, never a card.
- Uncaught errors inside a phase show the `crashed` screen with "Abandon round". That discards the round but keeps the session.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:
```ts
export interface Deal {
  imposters: string[]
  crew: string[]
  crewWords: string[]
  hints: string[]
}

/** Passes the phone through `count` players, recording what each one saw. `onScreen` runs on every pass/card screen. */
export async function dealCards(page: Page, count: number, onScreen?: () => Promise<void>): Promise<Deal> {
  const deal: Deal = { imposters: [], crew: [], crewWords: [], hints: [] }
  for (let i = 0; i < count; i++) {
    await expect(page.getByTestId('pass-screen')).toBeVisible()
    const name = (await page.getByTestId('pass-name').innerText()).trim()
    if (onScreen) await onScreen()
    await page.getByTestId('show-card').click()
    await expect(page.getByTestId('card-screen')).toBeVisible()
    if (onScreen) await onScreen()
    if ((await page.getByTestId('imposter-title').count()) > 0) {
      deal.imposters.push(name)
      if ((await page.getByTestId('imposter-hint').count()) > 0) {
        deal.hints.push((await page.getByTestId('imposter-hint').innerText()).trim())
      }
    } else {
      deal.crew.push(name)
      deal.crewWords.push((await page.getByTestId('secret-word').innerText()).trim())
    }
    await page.getByTestId('hide-pass').click()
  }
  await expect(page.getByTestId('discussion')).toBeVisible()
  return deal
}
```

`tests/e2e/round.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { addPlayers, dealCards } from './helpers'

const PLAYERS = ['Rami', 'Lina', 'Omar', 'Sara']

test('every player sees exactly one card, the crew share one word, and the imposter gets a hint', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, PLAYERS.length)
  expect(new Set([...deal.imposters, ...deal.crew])).toEqual(new Set(PLAYERS))
  expect(deal.imposters).toHaveLength(1)
  expect(new Set(deal.crewWords).size).toBe(1)
  expect(deal.hints).toHaveLength(1)
  await expect(page.getByTestId('lang-en')).toHaveCount(0) // language is locked mid-round
})

test('reloading in the middle of dealing never re-shows a card', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS)
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const first = (await page.getByTestId('pass-name').innerText()).trim()
  await page.getByTestId('show-card').click()
  await expect(page.getByTestId('card-screen')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
  await expect(page.getByTestId('card-screen')).toHaveCount(0)
  await expect(page.getByTestId('pass-name')).toHaveText(first)
})

test('a scored round: catching the imposter who then misses the word gives each crew member a point', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, PLAYERS, { scoring: true })
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, PLAYERS.length)
  await page.getByTestId('end-discussion').click()
  await page.getByTestId('vote-player').filter({ hasText: deal.imposters[0] }).click()
  await page.getByTestId('guess-no').click()
  await expect(page.getByTestId('winner')).toHaveText('The crew wins!')
  await expect(page.getByTestId('result-word')).toHaveText(deal.crewWords[0])
  await expect(page.getByTestId('result-imposters')).toContainText(deal.imposters[0])
  const rows = page.getByTestId('score-row')
  for (const name of deal.crew) await expect(rows.filter({ hasText: name })).toContainText('1 pt')
  await expect(rows.filter({ hasText: deal.imposters[0] })).toContainText('0 pts')
  await page.getByTestId('next-round').click()
  await expect(page.getByTestId('between-rounds')).toContainText('Round 2')
})

test('an Arabic round is right-to-left and deals Arabic words', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('lang-ar').click()
  await addPlayers(page, ['رامي', 'لينا', 'عمر'])
  await page.getByTestId('play').click()
  await page.getByTestId('start-round').click()
  const deal = await dealCards(page, 3)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(deal.crewWords[0]).toMatch(/[؀-ۿ]/)
})

test('too few players blocks the round with an explanation', async ({ page }) => {
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina'])
  await page.getByTestId('play').click()
  await expect(page.getByTestId('round-blocker')).toBeVisible()
  await expect(page.getByTestId('start-round')).toBeDisabled()
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `podman compose run --rm e2e`
Expected: the 5 new tests FAIL (no `/play` route, so `start-round` is never found). The Task 16 tests still pass.

- [ ] **Step 3: Create `Scoreboard.vue` and `BetweenRounds.vue`**

`src/components/phases/Scoreboard.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'

const app = useApp()
const rows = computed(() =>
  Object.entries(app.state.session?.scores ?? {})
    .map(([id, row]) => ({
      id,
      name: app.state.players.find((p) => p.id === id)?.name ?? row.name,
      points: row.points,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
)
</script>

<template>
  <section class="panel" data-testid="scoreboard">
    <h3>{{ app.t('result.scores') }}</h3>
    <ol class="rows">
      <li v-for="row in rows" :key="row.id" class="score" data-testid="score-row">
        <span class="name">{{ row.name }}</span>
        <span class="points">{{ app.t('result.points', { count: row.points }) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.score { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; }
.name { min-width: 0; overflow-wrap: anywhere; }
.points { white-space: nowrap; }
</style>
```

`src/components/phases/BetweenRounds.vue`:
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Source } from '../../engine/types'
import { useApp } from '../../composables/useApp'
import type { MessageKey } from '../../i18n'
import Screen from '../ui/Screen.vue'
import Chip from '../ui/Chip.vue'
import PopButton from '../ui/PopButton.vue'
import LanguageSwitch from '../ui/LanguageSwitch.vue'
import Scoreboard from './Scoreboard.vue'

type SourceKind = Source['kind']
const SOURCES: { kind: SourceKind; label: MessageKey }[] = [
  { kind: 'random', label: 'play.sourceRandom' },
  { kind: 'playerGm', label: 'play.sourcePlayerGm' },
  { kind: 'outsideGm', label: 'play.sourceOutsideGm' },
]

const app = useApp()
const router = useRouter()

const kind = ref<SourceKind>('random')
const activePlayers = computed(() => app.state.players.filter((p) => app.state.activePlayerIds.includes(p.id)))
const gmId = ref(activePlayers.value[0]?.id ?? '')
watch(activePlayers, (list) => {
  if (!list.some((p) => p.id === gmId.value)) gmId.value = list[0]?.id ?? ''
})

const source = computed<Source>(() => {
  if (kind.value === 'playerGm') return { kind: 'playerGm', gmPlayerId: gmId.value }
  if (kind.value === 'outsideGm') return { kind: 'outsideGm' }
  return { kind: 'random' }
})
const blocker = computed(() => app.roundBlocker(source.value))
const blockerText = computed(() => {
  switch (blocker.value) {
    case 'needPlayers':
      return app.t('play.needPlayers')
    case 'noWords':
      return app.t('play.noWords')
    case 'noGm':
      return app.t('play.pickGm')
    default:
      return null
  }
})
const clamped = computed(() => app.clampedImposterCount(source.value))
const roundNumber = computed(() => (app.state.session?.rounds ?? 0) + 1)
const showScores = computed(() => app.state.settings.scoring && Object.keys(app.state.session?.scores ?? {}).length > 0)

function start(): void {
  app.beginRound(source.value)
}

function endGame(): void {
  if (!window.confirm(app.t('play.endGameConfirm'))) return
  app.endSession()
  void router.push('/')
}
</script>

<template>
  <Screen tone="sun" data-testid="between-rounds">
    <template #top>
      <Chip>{{ app.t('play.round', { n: roundNumber }) }}</Chip>
      <LanguageSwitch />
    </template>

    <section class="panel stack">
      <h2>{{ app.t('play.wordSource') }}</h2>
      <div class="sources" role="radiogroup" :aria-label="app.t('play.wordSource')">
        <label v-for="s in SOURCES" :key="s.kind" class="source" :class="{ chosen: kind === s.kind }">
          <input v-model="kind" type="radio" name="source" :value="s.kind" :data-testid="`source-${s.kind}`">
          <span>{{ app.t(s.label) }}</span>
        </label>
      </div>
      <label v-if="kind === 'playerGm'" class="field">
        {{ app.t('play.pickGm') }}
        <select v-model="gmId" class="input" data-testid="gm-select">
          <option v-for="p in activePlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
    </section>

    <p v-if="blockerText" class="guide" data-testid="round-blocker">{{ blockerText }}</p>
    <p v-else-if="clamped !== null" class="guide" data-testid="clamp-notice">{{ app.t('play.clamped', { count: clamped }) }}</p>

    <Scoreboard v-if="showScores" />

    <template #actions>
      <PopButton attention :disabled="blocker !== null" data-testid="start-round" @click="start">
        {{ app.t('play.startRound') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="edit-setup" @click="router.push('/setup')">{{ app.t('play.editSetup') }}</PopButton>
      <PopButton variant="danger" data-testid="end-game" @click="endGame">{{ app.t('play.endGame') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.sources { display: flex; flex-direction: column; gap: 8px; }
.source { display: flex; align-items: center; gap: 10px; min-height: var(--tap); padding: 6px 12px; border: var(--outline); border-radius: var(--radius-sm); font-weight: 700; }
.source.chosen { background: var(--sun); }
.source input { width: 22px; height: 22px; accent-color: var(--grape); }
</style>
```

- [ ] **Step 4: Create `GmEntry.vue` and `RevealStep.vue`**

`src/components/phases/GmEntry.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '../../composables/useApp'
import { categoriesNamedIn, type GmField, type GmWordError } from '../../data/content'
import { LIMITS } from '../../data/limits'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'

const NEW_CATEGORY = '__new__'

const app = useApp()
const round = computed(() => app.state.round)
const lang = computed(() => round.value?.lang ?? app.state.language)
const gmName = computed(() => {
  const source = round.value?.source
  return source?.kind === 'playerGm' ? app.playerName(source.gmPlayerId) : null
})
const categoryOptions = computed(() =>
  categoriesNamedIn(app.content.value, lang.value).map((c) => ({ id: c.id, name: c.name[lang.value] ?? '' })),
)

const ready = ref(false)
const word = ref('')
const hint = ref('')
const categoryId = ref(categoryOptions.value[0]?.id ?? NEW_CATEGORY)
const newCategory = ref('')
const errors = ref<GmWordError[]>([])

function errorFor(field: GmField): string | null {
  const error = errors.value.find((e) => e.field === field)
  if (!error) return null
  if (error.code === 'empty') return app.t('error.textEmpty')
  if (error.code === 'unknown') return app.t('error.unknownCategory')
  const max = field === 'category' ? LIMITS.category : field === 'hint' ? LIMITS.hint : LIMITS.word
  return app.t('error.tooLong', { max })
}

function submit(): void {
  errors.value = app.submitGmWord({
    lang: lang.value,
    word: word.value,
    hint: hint.value,
    category: categoryId.value === NEW_CATEGORY ? { newName: newCategory.value } : { existingId: categoryId.value },
  })
}
</script>

<template>
  <Screen v-if="!ready" tone="sun" data-testid="gm-pass">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round?.number ?? 1 }) }}</Chip>
    </template>
    <StickerCard motion="wobble">
      <p class="title">{{ gmName ? app.t('gm.passToPlayer', { name: gmName }) : app.t('gm.passTo') }}</p>
    </StickerCard>
    <p class="guide">{{ app.t('gm.guide') }}</p>
    <template #actions>
      <PopButton attention data-testid="gm-ready" @click="ready = true">{{ app.t('gm.imGm') }}</PopButton>
    </template>
  </Screen>

  <Screen v-else tone="sun" align="start" data-testid="gm-form">
    <p class="guide">{{ app.t('gm.guide') }}</p>
    <form class="panel stack" @submit.prevent="submit">
      <label class="field">
        {{ app.t('gm.word') }}
        <input v-model="word" class="input" data-testid="gm-word" :lang="lang" autocomplete="off" autocapitalize="off" spellcheck="false">
        <span v-if="errorFor('word')" class="error-text">{{ errorFor('word') }}</span>
      </label>
      <label class="field">
        {{ app.t('gm.category') }}
        <select v-model="categoryId" class="input" data-testid="gm-category">
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          <option :value="NEW_CATEGORY">{{ app.t('gm.newCategory') }}</option>
        </select>
      </label>
      <label v-if="categoryId === NEW_CATEGORY" class="field">
        {{ app.t('gm.newCategoryName') }}
        <input v-model="newCategory" class="input" data-testid="gm-new-category" :lang="lang" autocomplete="off">
      </label>
      <span v-if="errorFor('category')" class="error-text">{{ errorFor('category') }}</span>
      <label class="field">
        {{ app.t('gm.hint') }}
        <input v-model="hint" class="input" data-testid="gm-hint" :lang="lang" autocomplete="off">
        <span v-if="errorFor('hint')" class="error-text">{{ errorFor('hint') }}</span>
      </label>
      <PopButton type="submit" data-testid="gm-submit">{{ app.t('gm.done') }}</PopButton>
    </form>
  </Screen>
</template>

<style scoped>
.title { font-size: 1.6rem; font-weight: 800; }
</style>
```

`src/components/phases/RevealStep.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import { imposterHint } from '../../engine/words'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
// Clamped: while this instance is leaving, revealIndex may already point past the last player.
const playerId = computed(() => {
  const r = round.value
  if (!r) return ''
  return r.participantIds[Math.min(r.revealIndex, r.participantIds.length - 1)] ?? ''
})
const name = computed(() => app.playerName(playerId.value))
const isImposter = computed(() => round.value?.imposterIds.includes(playerId.value) ?? false)
const shown = ref(false)

function hideAndPass(): void {
  const r = round.value
  if (!r) return
  shown.value = false
  if (r.revealIndex === r.participantIds.length - 1) sound.prime() // last tap before the timer: unlock audio
  app.dispatch({ type: 'cardSeen', now: Date.now() })
}
</script>

<template>
  <Screen v-if="round && !shown" tone="sun" data-testid="pass-screen">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
    </template>
    <p class="center lead">{{ app.t('reveal.passTo') }}</p>
    <StickerCard motion="wobble">
      <span class="title-xl" data-testid="pass-name">{{ name }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('reveal.passGuide', { name }) }}</p>
    <template #actions>
      <PopButton attention data-testid="show-card" @click="shown = true">{{ app.t('reveal.show', { name }) }}</PopButton>
    </template>
  </Screen>

  <Screen v-else-if="round" :tone="isImposter ? 'bubblegum' : 'mint'" data-testid="card-screen">
    <template #top>
      <Chip>{{ name }}</Chip>
    </template>
    <StickerCard v-if="isImposter" tone="ink" motion="shake">
      <p class="secret-word" data-testid="imposter-title">{{ app.t('reveal.imposterTitle') }}</p>
      <p v-if="round.settings.hints && round.secret" class="hint" data-testid="imposter-hint">
        {{ app.t('reveal.hint', { hint: imposterHint(round.secret) }) }}
      </p>
    </StickerCard>
    <StickerCard v-else motion="wobble">
      <p class="secret-word" data-testid="secret-word">{{ round.secret?.word }}</p>
    </StickerCard>
    <p class="guide">{{ isImposter ? app.t('reveal.imposterGuide') : app.t('reveal.crewGuide') }}</p>
    <template #actions>
      <PopButton data-testid="hide-pass" @click="hideAndPass">{{ app.t('reveal.hidePass') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.lead { font-size: 1.3rem; font-weight: 700; }
.hint { display: inline-block; margin-top: 12px; padding: 2px 12px; border-radius: 12px; background: var(--mint); color: var(--ink); font-weight: 700; overflow-wrap: anywhere; }
</style>
```

- [ ] **Step 5: Create `Discussion.vue`, `VoteStep.vue`, `GuessStep.vue` and `ResultStep.vue`**

`src/components/phases/Discussion.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import { useTimer } from '../../composables/useTimer'
import { formatClock } from '../../i18n'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
const starter = computed(() => (round.value ? app.playerName(round.value.startingPlayerId) : ''))
const timer = useTimer(
  () => round.value?.timerEndsAt ?? null,
  () => {
    sound.beep()
    navigator.vibrate?.([300, 150, 300])
  },
)
// Screen readers: announce once per minute, then at 10 s, then at time-up.
const announcement = computed(() => {
  const view = timer.value
  if (!view.active) return ''
  if (view.ended) return app.t('discussion.timeUp')
  if (view.secondsLeft <= 10) return app.t('timer.secondsLeft', { count: 10 })
  return app.t('timer.minutesLeft', { count: Math.ceil(view.secondsLeft / 60) })
})

function end(): void {
  app.dispatch({ type: 'endDiscussion' })
}
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="discussion" @pointerdown="sound.prime()">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
      <Chip data-testid="imposter-count">
        {{ round.settings.imposterCountHidden
          ? app.t('discussion.impostersHidden')
          : app.t('discussion.imposters', { count: round.imposterIds.length }) }}
      </Chip>
    </template>
    <h2 class="center">{{ app.t('discussion.title') }}</h2>
    <StickerCard motion="wobble">
      <span class="title-xl" data-testid="starter">{{ starter }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('discussion.guide', { name: starter }) }}</p>
    <div v-if="timer.active" class="timer" :class="{ ended: timer.ended }" data-testid="timer">
      {{ timer.ended ? app.t('discussion.timeUp') : formatClock(timer.secondsLeft) }}
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    <template #actions>
      <PopButton attention data-testid="end-discussion" @click="end">
        {{ round.settings.scoring ? app.t('discussion.toVote') : app.t('discussion.toReveal') }}
      </PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.timer {
  align-self: center; min-width: 8ch; padding: 6px 20px;
  border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm);
  font-size: 2.2rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; direction: ltr;
}
.timer.ended { background: var(--bubblegum); }
</style>
```

`src/components/phases/VoteStep.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Screen from '../ui/Screen.vue'
import PopButton from '../ui/PopButton.vue'

const app = useApp()
const round = computed(() => app.state.round)
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="vote">
    <h2 class="center">{{ app.t('vote.title') }}</h2>
    <div class="grid">
      <PopButton
        v-for="id in round.participantIds"
        :key="id"
        variant="secondary"
        data-testid="vote-player"
        @click="app.dispatch({ type: 'voteOut', playerId: id })"
      >
        {{ app.playerName(id) }}
      </PopButton>
    </div>
    <template #actions>
      <PopButton variant="danger" data-testid="vote-nobody" @click="app.dispatch({ type: 'voteOut', playerId: null })">
        {{ app.t('vote.nobody') }}
      </PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
</style>
```

`src/components/phases/GuessStep.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'

const app = useApp()
const round = computed(() => app.state.round)
const name = computed(() => {
  const id = round.value?.votedOut?.playerId
  return id ? app.playerName(id) : ''
})
</script>

<template>
  <Screen v-if="round" tone="bubblegum" data-testid="guess">
    <StickerCard tone="ink" motion="shake">
      <p class="title">{{ app.t('guess.title', { name }) }}</p>
    </StickerCard>
    <template #actions>
      <PopButton data-testid="guess-yes" @click="app.dispatch({ type: 'imposterGuess', correct: true })">{{ app.t('guess.yes') }}</PopButton>
      <PopButton variant="secondary" data-testid="guess-no" @click="app.dispatch({ type: 'imposterGuess', correct: false })">{{ app.t('guess.no') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.title { font-size: 1.5rem; font-weight: 800; }
</style>
```

`src/components/phases/ResultStep.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { formatList } from '../../i18n'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Confetti from '../ui/Confetti.vue'
import Scoreboard from './Scoreboard.vue'

const app = useApp()
const round = computed(() => app.state.round)
const imposterNames = computed(() =>
  formatList((round.value?.imposterIds ?? []).map((id) => app.playerName(id)), app.state.language),
)
const winner = computed(() => {
  const r = round.value
  if (!r?.outcome) return null
  return r.outcome === 'crew' ? app.t('result.crewWins') : app.t('result.impostersWin', { count: r.imposterIds.length })
})
</script>

<template>
  <Screen v-if="round && round.secret" :tone="round.outcome === 'crew' ? 'mint' : 'bubblegum'" data-testid="result">
    <Confetti v-if="round.outcome" />
    <h2 v-if="winner" class="title-xl center" data-testid="winner">{{ winner }}</h2>
    <StickerCard tone="ink">
      <p>{{ app.t('result.imposters', { count: round.imposterIds.length }) }}</p>
      <p class="names" data-testid="result-imposters">{{ imposterNames }}</p>
    </StickerCard>
    <StickerCard motion="wobble">
      <p>{{ app.t('result.word') }}</p>
      <p class="secret-word" data-testid="result-word">{{ round.secret.word }}</p>
      <p>{{ app.t('result.category', { category: round.secret.categoryName }) }}</p>
    </StickerCard>
    <Scoreboard v-if="round.settings.scoring" />
    <template #actions>
      <PopButton attention data-testid="next-round" @click="app.finishRound()">{{ app.t('result.nextRound') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.names { font-size: 1.6rem; font-weight: 800; overflow-wrap: anywhere; }
</style>
```

- [ ] **Step 6: Create `PlayView.vue` and add the route**

`src/views/PlayView.vue`:
```vue
<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useApp } from '../composables/useApp'
import { useWakeLock } from '../composables/useWakeLock'
import Screen from '../components/ui/Screen.vue'
import StickerCard from '../components/ui/StickerCard.vue'
import PopButton from '../components/ui/PopButton.vue'
import BetweenRounds from '../components/phases/BetweenRounds.vue'
import GmEntry from '../components/phases/GmEntry.vue'
import RevealStep from '../components/phases/RevealStep.vue'
import Discussion from '../components/phases/Discussion.vue'
import VoteStep from '../components/phases/VoteStep.vue'
import GuessStep from '../components/phases/GuessStep.vue'
import ResultStep from '../components/phases/ResultStep.vue'

const app = useApp()
const crashed = ref(false)
const phase = computed(() => app.state.round?.phase ?? null)
const revealKey = computed(() => `reveal-${app.state.round?.revealIndex ?? 0}`)

useWakeLock(computed(() => phase.value === 'reveal' || phase.value === 'discussion'))

onErrorCaptured((error) => {
  console.error(error)
  crashed.value = true
  return false
})

onBeforeRouteLeave(() => {
  const round = app.state.round
  if (!round || round.phase === 'result' || crashed.value) return true
  return window.confirm(app.t('play.leaveConfirm'))
})

function abandon(): void {
  app.abandonRound()
  crashed.value = false
}
</script>

<template>
  <Screen v-if="crashed" tone="bubblegum" data-testid="crashed">
    <StickerCard tone="ink">
      <p>{{ app.t('play.crashed') }}</p>
    </StickerCard>
    <template #actions>
      <PopButton @click="abandon">{{ app.t('play.abandonRound') }}</PopButton>
    </template>
  </Screen>
  <Transition v-else name="pop" mode="out-in">
    <BetweenRounds v-if="phase === null" key="between" />
    <GmEntry v-else-if="phase === 'gmEntry'" key="gm" />
    <RevealStep v-else-if="phase === 'reveal'" :key="revealKey" />
    <Discussion v-else-if="phase === 'discussion'" key="discussion" />
    <VoteStep v-else-if="phase === 'vote'" key="vote" />
    <GuessStep v-else-if="phase === 'guess'" key="guess" />
    <ResultStep v-else key="result" />
  </Transition>
</template>
```

In `src/router.ts`, add:
```ts
import PlayView from './views/PlayView.vue'
// …
    { path: '/play', name: 'play', component: PlayView },
```

- [ ] **Step 7: Run the e2e tests to verify they pass**

Run: `podman compose run --rm e2e`
Expected: PASS (9 tests: 4 from Task 16 plus 5 new).

- [ ] **Step 8: Manual check on a phone-sized viewport**

Open `http://localhost:5173` at 375×812 in DevTools device mode. Enable the timer at 0:30 in Setup, then play a round.
- The discussion timer counts down.
- At 0:00 it turns pink, says "Time's up!", and beeps once.
- Reloading on the discussion screen resumes the countdown, and reloading after time-up shows "Time's up!" without beeping again.

- [ ] **Step 9: Lint, type-check and commit**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

```bash
jj commit -m "feat(ui): add the full pass-and-play round flow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: My Words screen and Game Master e2e

**Files:**
- Create: `src/views/WordsView.vue`, `tests/e2e/gm.spec.ts`
- Modify: `src/router.ts` (add `/words`), `tests/e2e/helpers.ts` (add `startGmRound`)

**Interfaces:**
- Consumes: `useApp` (Task 14): `updateCustomWord`, `updateCustomCategory`, `deleteCustomWord`, `deleteCustomCategory`, `content`; `LocalizedError` (Task 12); `LIMITS`.
- Produces:
  - Test ids: `words-empty`, `custom-category`, `custom-word`, `back`
  - `helpers.ts`: `startGmRound(page, opts: { gmPlayer?: string; word: string; newCategory: string }): Promise<void>`. It starts on Home and ends on the first pass screen.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:
```ts
/** From Home: start a GM round (player GM when `gmPlayer` is given, otherwise outside GM) and submit a word in a new category. */
export async function startGmRound(page: Page, opts: { gmPlayer?: string; word: string; newCategory: string }): Promise<void> {
  await page.getByTestId('play').click()
  if (opts.gmPlayer) {
    await page.getByTestId('source-playerGm').check()
    await page.getByTestId('gm-select').selectOption({ label: opts.gmPlayer })
  } else {
    await page.getByTestId('source-outsideGm').check()
  }
  await page.getByTestId('start-round').click()
  await page.getByTestId('gm-ready').click()
  await page.getByTestId('gm-word').fill(opts.word)
  await page.getByTestId('gm-category').selectOption('__new__')
  await page.getByTestId('gm-new-category').fill(opts.newCategory)
  await page.getByTestId('gm-submit').click()
  await expect(page.getByTestId('pass-screen')).toBeVisible()
}
```

`tests/e2e/gm.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, startGmRound } from './helpers'

test('a player Game Master sits out, and their word is saved to My words', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar', 'Sara'])
  await startGmRound(page, { gmPlayer: 'Rami', word: 'Mansaf', newCategory: 'Jordanian food' })
  const deal = await dealCards(page, 3)
  expect([...deal.crew, ...deal.imposters]).not.toContain('Rami')
  expect(deal.crewWords.every((w) => w === 'Mansaf')).toBe(true)

  await page.goto('/#/words')
  await expect(page.getByTestId('custom-category')).toContainText('Jordanian food')
  await expect(page.getByTestId('custom-word')).toContainText('Mansaf')
})

test('maximum-length words and names wrap instead of overflowing a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const longName = 'Abcdefghijklmnopqrst' // 20 characters, the limit
  await page.goto('/')
  await addPlayers(page, [longName, 'Lina', 'Omar', 'Sara'])
  await startGmRound(page, { word: 'W'.repeat(40), newCategory: 'Long' })
  const noHorizontalScroll = async () => {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(fits).toBe(true)
  }
  await dealCards(page, 4, noHorizontalScroll)
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `podman compose run --rm e2e`
Expected: "a player Game Master…" FAILS on `custom-category` (there is no `/words` route, so `/#/words` redirects Home). The overflow test passes already. It guards the CSS from Tasks 15 and 18, so it stays as a regression test.

- [ ] **Step 3: Implement `src/views/WordsView.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Category, Lang, Localized, Word } from '../engine/types'
import { useApp } from '../composables/useApp'
import type { LocalizedError } from '../data/content'
import { LIMITS } from '../data/limits'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'
import Chip from '../components/ui/Chip.vue'

type Draft = Record<Lang, string>
type Editing =
  | { kind: 'word'; id: string; text: Draft; hint: Draft }
  | { kind: 'category'; id: string; name: Draft }

const app = useApp()
const router = useRouter()
const editing = ref<Editing | null>(null)
const editErrors = ref<LocalizedError[]>([])

const otherLang = computed<Lang>(() => (app.state.language === 'en' ? 'ar' : 'en'))
/** Management screen, not a round: fall back to the other language so every entry is visible. */
function show(value: Localized): string {
  return value[app.state.language] ?? value[otherLang.value] ?? ''
}
const draft = (value: Localized): Draft => ({ en: value.en ?? '', ar: value.ar ?? '' })

const groups = computed(() => {
  const customIds = new Set(app.state.customCategories.map((c) => c.id))
  const withCustomWords = new Set(app.state.customWords.map((w) => w.categoryId))
  return app.content.value.categories
    .filter((c) => customIds.has(c.id) || withCustomWords.has(c.id))
    .map((category) => ({
      category,
      isCustom: customIds.has(category.id),
      words: app.state.customWords.filter((w) => w.categoryId === category.id),
    }))
})

function editWord(word: Word): void {
  editing.value = { kind: 'word', id: word.id, text: draft(word.text), hint: draft(word.hint) }
  editErrors.value = []
}

function editCategory(category: Category): void {
  editing.value = { kind: 'category', id: category.id, name: draft(category.name) }
  editErrors.value = []
}

function save(): void {
  const e = editing.value
  if (!e) return
  editErrors.value = e.kind === 'word' ? app.updateCustomWord(e.id, e.text, e.hint) : app.updateCustomCategory(e.id, e.name)
  if (editErrors.value.length === 0) editing.value = null
}

function errorText(error: LocalizedError): string {
  if (error.code === 'needOneLanguage') return app.t('error.needOneLanguage')
  const max = error.field === 'name' ? LIMITS.category : error.field === 'hint' ? LIMITS.hint : LIMITS.word
  return app.t('error.tooLong', { max })
}

function removeWord(id: string): void {
  if (window.confirm(app.t('words.deleteWordConfirm'))) app.deleteCustomWord(id)
}

function removeCategory(id: string, count: number): void {
  if (window.confirm(app.t('words.deleteCategoryConfirm', { count }))) app.deleteCustomCategory(id)
}
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('words.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <p v-if="groups.length === 0" class="guide" data-testid="words-empty">{{ app.t('words.empty') }}</p>

    <section v-for="group in groups" :key="group.category.id" class="panel stack" data-testid="custom-category">
      <div class="row">
        <h2 class="grow">{{ show(group.category.name) }}</h2>
        <Chip v-if="!group.isCustom">{{ app.t('words.builtIn') }}</Chip>
        <template v-else>
          <button type="button" class="icon-btn" @click="editCategory(group.category)">{{ app.t('common.edit') }}</button>
          <button type="button" class="icon-btn" @click="removeCategory(group.category.id, group.words.length)">{{ app.t('common.delete') }}</button>
        </template>
      </div>

      <form v-if="editing?.kind === 'category' && editing.id === group.category.id" class="stack" @submit.prevent="save">
        <label class="field">{{ app.t('words.name') }} · {{ app.t('words.english') }}
          <input v-model="editing.name.en" class="input" lang="en" dir="ltr">
        </label>
        <label class="field">{{ app.t('words.name') }} · {{ app.t('words.arabic') }}
          <input v-model="editing.name.ar" class="input" lang="ar" dir="rtl">
        </label>
        <p v-for="(e, i) in editErrors" :key="i" class="error-text">{{ errorText(e) }}</p>
        <div class="row">
          <PopButton type="submit">{{ app.t('common.save') }}</PopButton>
          <PopButton variant="secondary" @click="editing = null">{{ app.t('common.cancel') }}</PopButton>
        </div>
      </form>

      <ul class="words">
        <li v-for="word in group.words" :key="word.id" data-testid="custom-word">
          <form v-if="editing?.kind === 'word' && editing.id === word.id" class="stack" @submit.prevent="save">
            <label class="field">{{ app.t('words.word') }} · {{ app.t('words.english') }}
              <input v-model="editing.text.en" class="input" lang="en" dir="ltr">
            </label>
            <label class="field">{{ app.t('words.word') }} · {{ app.t('words.arabic') }}
              <input v-model="editing.text.ar" class="input" lang="ar" dir="rtl">
            </label>
            <label class="field">{{ app.t('words.hint') }} · {{ app.t('words.english') }}
              <input v-model="editing.hint.en" class="input" lang="en" dir="ltr">
            </label>
            <label class="field">{{ app.t('words.hint') }} · {{ app.t('words.arabic') }}
              <input v-model="editing.hint.ar" class="input" lang="ar" dir="rtl">
            </label>
            <p v-for="(e, i) in editErrors" :key="i" class="error-text">{{ errorText(e) }}</p>
            <div class="row">
              <PopButton type="submit">{{ app.t('common.save') }}</PopButton>
              <PopButton variant="secondary" @click="editing = null">{{ app.t('common.cancel') }}</PopButton>
            </div>
          </form>
          <div v-else class="row">
            <span class="grow word">{{ show(word.text) }}</span>
            <button type="button" class="icon-btn" @click="editWord(word)">{{ app.t('common.edit') }}</button>
            <button type="button" class="icon-btn" @click="removeWord(word.id)">{{ app.t('common.delete') }}</button>
          </div>
        </li>
      </ul>
    </section>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
h2 { overflow-wrap: anywhere; }
.words { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.word { font-weight: 700; overflow-wrap: anywhere; }
</style>
```

In `src/router.ts`, add:
```ts
import WordsView from './views/WordsView.vue'
// …
    { path: '/words', name: 'words', component: WordsView },
```

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `podman compose run --rm e2e`
Expected: `11 pass`, `0 fail`.

- [ ] **Step 5: Manual check of editing**

In the browser:
1. Open My words, then Edit the "Mansaf" word.
2. Clear both text fields and press Save. Expected: "Fill in at least one language".
3. Type "منسف" in the Arabic field and Save. Expected: the row shows Mansaf in English and منسف after switching to العربية.
4. Delete the category. Expected: after the confirmation prompt, the list shows the empty message.

- [ ] **Step 6: Lint, type-check and commit**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

```bash
jj commit -m "feat(ui): add My Words screen for editing Game Master words

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Backup & import screen

**Files:**
- Create: `src/views/DataView.vue`, `tests/e2e/data.spec.ts`
- Modify: `src/router.ts` (add `/data`)

**Interfaces:**
- Consumes:
  - `useApp` (Task 14): `previewImport`, `applyImport`, `setLastImportUrl`
  - From `transfer.ts` (Task 13): `exportPack`, `exportFileName`, `fetchPackJson`, `readPackFile`, and the types `FetchResult`, `ImportMode`, `ImportPlan`, `PackError`
  - `isolate` (Task 8)
- Produces: test ids `export`, `import-file`, `import-url`, `import-url-load`, `import-problem`, `import-errors`, `import-summary`, `import-confirm`, `import-done`.

- [ ] **Step 1: Write the failing e2e test `tests/e2e/data.spec.ts`**

```ts
import { expect, test } from '@playwright/test'
import { addPlayers, dealCards, startGmRound } from './helpers'

const PACK = {
  format: 'fennas-imposter',
  version: 1,
  categories: [{ id: 'levant-sweets', name: { en: 'Levantine sweets', ar: 'حلويات شامية' } }],
  words: [
    { id: 'levant-sweets.baklava', categoryId: 'levant-sweets', text: { en: 'Baklava', ar: 'بقلاوة' }, hint: { en: 'Syrup', ar: 'قطر' } },
    { id: 'levant-sweets.halawa', categoryId: 'levant-sweets', text: { ar: 'حلاوة' }, hint: { ar: 'طحينة' } },
  ],
}

test('a backup exported on one phone restores players and custom words on another', async ({ page, browser }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/')
  await addPlayers(page, ['Rami', 'Lina', 'Omar'])
  await startGmRound(page, { word: 'Mansaf', newCategory: 'Jordanian food' })
  await dealCards(page, 3)
  await page.goto('/#/data')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()])
  expect(download.suggestedFilename()).toMatch(/^fennas-imposter-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const phone2 = await other.newPage()
  await phone2.goto('/#/data')
  await phone2.getByTestId('import-file').setInputFiles(file)
  await expect(phone2.getByTestId('import-summary')).toContainText('Adds 1 category')
  await expect(phone2.getByTestId('import-summary')).toContainText('Adds 3 players')
  await phone2.getByTestId('import-confirm').click()
  await expect(phone2.getByTestId('import-done')).toBeVisible()
  await phone2.goto('/#/words')
  await expect(phone2.getByTestId('custom-word')).toContainText('Mansaf')
  await other.close()
})

test('a word pack can be imported from an https link', async ({ page }) => {
  await page.route('https://packs.example.test/sweets.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(PACK) }),
  )
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('https://packs.example.test/sweets.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-summary')).toContainText('Adds 1 category')
  await expect(page.getByTestId('import-summary')).toContainText('Adds 2 words')
  await page.getByTestId('import-confirm').click()
  await page.goto('/#/words')
  await expect(page.getByTestId('custom-word')).toHaveCount(2)
})

test('a plain http link is refused before any request is made', async ({ page }) => {
  let requested = false
  await page.route('http://packs.example.test/**', (route) => {
    requested = true
    return route.abort()
  })
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('http://packs.example.test/sweets.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-problem')).toHaveText('Only https:// links are allowed')
  expect(requested).toBe(false)
})

test('a broken pack lists its problems and changes nothing', async ({ page }) => {
  await page.route('https://packs.example.test/broken.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ...PACK, words: [{ id: 'x', categoryId: 'nowhere', text: { en: 'X' } }] }) }),
  )
  await page.goto('/#/data')
  await page.getByTestId('import-url').fill('https://packs.example.test/broken.json')
  await page.getByTestId('import-url-load').click()
  await expect(page.getByTestId('import-errors')).toContainText('unknown category')
  await expect(page.getByTestId('import-confirm')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `podman compose run --rm e2e`
Expected: the 4 new tests FAIL (no `/data` route, so `export`/`import-url` are never found).

- [ ] **Step 3: Implement `src/views/DataView.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import {
  exportFileName, exportPack, fetchPackJson, readPackFile,
  type FetchResult, type ImportMode, type ImportPlan, type PackError,
} from '../data/transfer'
import { isolate } from '../i18n'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'

const app = useApp()
const router = useRouter()

const url = ref(app.state.lastImportUrl ?? '')
const busy = ref(false)
const problem = ref<string | null>(null)
const packErrors = ref<PackError[]>([])
const plan = ref<ImportPlan | null>(null)
const imported = ref(false)

function reset(): void {
  problem.value = null
  packErrors.value = []
  plan.value = null
  imported.value = false
}

function exportBackup(): void {
  const blob = new Blob([exportPack(app.state)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = exportFileName(new Date())
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
}

function fetchErrorText(result: Extract<FetchResult, { ok: false }>): string {
  if (result.error === 'httpStatus') return app.t('fetch.httpStatus', { status: result.status ?? 0 })
  return app.t(`fetch.${result.error}`)
}

function preview(json: unknown, mode: ImportMode): void {
  const result = app.previewImport(json, mode)
  if (result.ok) plan.value = result.plan
  else packErrors.value = result.errors
}

async function onFile(event: Event): Promise<void> {
  reset()
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const result = await readPackFile(file)
  if (result.ok) preview(result.json, 'file')
  else problem.value = fetchErrorText(result)
}

async function onUrl(): Promise<void> {
  reset()
  busy.value = true
  try {
    app.setLastImportUrl(url.value)
    const result = await fetchPackJson(url.value)
    if (result.ok) preview(result.json, 'url')
    else problem.value = fetchErrorText(result)
  } finally {
    busy.value = false
  }
}

function confirmImport(): void {
  if (!plan.value) return
  app.applyImport(plan.value)
  plan.value = null
  imported.value = true
}

const summary = computed(() => {
  const s = plan.value?.summary
  if (!s) return []
  const lines: string[] = []
  if (s.addCategories) lines.push(app.t('data.addsCategories', { count: s.addCategories }))
  if (s.updateCategories) lines.push(app.t('data.updatesCategories', { count: s.updateCategories }))
  if (s.addWords) lines.push(app.t('data.addsWords', { count: s.addWords }))
  if (s.updateWords) lines.push(app.t('data.updatesWords', { count: s.updateWords }))
  if (s.addPlayers) lines.push(app.t('data.addsPlayers', { count: s.addPlayers }))
  if (s.replacesSettings) lines.push(app.t('data.replacesSettings'))
  if (s.skippedBuiltIn) lines.push(app.t('data.skipsBuiltIn', { count: s.skippedBuiltIn }))
  return lines
})
const hasChanges = computed(() => {
  const s = plan.value?.summary
  if (!s) return false
  return s.addCategories + s.updateCategories + s.addWords + s.updateWords + s.addPlayers > 0 || s.replacesSettings
})
const overwrites = computed(() => {
  const s = plan.value?.summary
  return !!s && s.updateCategories + s.updateWords > 0
})
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('data.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <p class="guide">{{ app.t('data.backupTip') }}</p>

    <section class="panel stack">
      <PopButton data-testid="export" @click="exportBackup">{{ app.t('data.export') }}</PopButton>
      <label class="field">
        {{ app.t('data.importFile') }}
        <input type="file" accept="application/json,.json" class="input" data-testid="import-file" @change="onFile">
      </label>
      <form class="stack" @submit.prevent="onUrl">
        <label class="field">
          {{ app.t('data.importUrl') }}
          <input
            v-model="url"
            type="text"
            inputmode="url"
            dir="ltr"
            class="input"
            autocomplete="off"
            :placeholder="app.t('data.urlPlaceholder')"
            data-testid="import-url"
          >
        </label>
        <PopButton type="submit" variant="secondary" :disabled="busy || !url.trim()" data-testid="import-url-load">
          {{ app.t('data.load') }}
        </PopButton>
      </form>
    </section>

    <p v-if="problem" class="panel error-text" role="alert" data-testid="import-problem">{{ problem }}</p>

    <section v-if="packErrors.length" class="panel" role="alert" data-testid="import-errors">
      <p class="error-text">{{ app.t('data.problems') }}</p>
      <ul>
        <li v-for="(e, i) in packErrors" :key="i">{{ e.path ? `${isolate(e.path)}: ` : '' }}{{ app.t(`pack.${e.code}`) }}</li>
      </ul>
    </section>

    <section v-if="plan" class="panel stack" data-testid="import-summary">
      <ul>
        <li v-for="line in summary" :key="line">{{ line }}</li>
      </ul>
      <p v-if="!hasChanges">{{ app.t('data.nothing') }}</p>
      <p v-if="overwrites" class="error-text">{{ app.t('data.overwriteNote') }}</p>
      <div class="row">
        <PopButton v-if="hasChanges" data-testid="import-confirm" @click="confirmImport">{{ app.t('data.confirm') }}</PopButton>
        <PopButton variant="secondary" @click="reset">{{ app.t('common.cancel') }}</PopButton>
      </div>
    </section>

    <p v-if="imported" class="guide" role="status" data-testid="import-done">{{ app.t('data.imported') }}</p>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
ul { margin: 0; padding-inline-start: 20px; }
</style>
```

In `src/router.ts`, add:
```ts
import DataView from './views/DataView.vue'
// …
    { path: '/data', name: 'data', component: DataView },
```

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `podman compose run --rm e2e`
Expected: `15 pass`, `0 fail`.

- [ ] **Step 5: Lint, type-check and commit**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

```bash
jj commit -m "feat(ui): add backup export and file/URL pack import screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Offline PWA, icons, update prompt and CSP

**Files:**
- Create:
  - Icons: `public/icon.svg`, `pwa-assets.config.mjs`; generated into `public/`: `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`
  - Code: `src/composables/usePwaUpdate.ts`, `src/components/ui/UpdatePrompt.vue`
  - Test: `tests/e2e/offline.spec.ts`
- Modify: `package.json` (dev deps + `icons` script), `vite.config.ts`, `index.html`, `src/env.d.ts`, `src/main.ts`, `src/App.vue`, `src/views/HomeView.vue`, `src/views/SetupView.vue`

**Interfaces:**
- Consumes: `useApp` (Task 14).
- Produces:
  - `usePwaUpdate()` is a singleton registration returning `{ needRefresh, offlineReady, updateServiceWorker }`
  - `<UpdatePrompt>`, test id `update-prompt`
  - The production build has `sw.js`, `manifest.webmanifest` and a CSP `<meta>`

- [ ] **Step 1: Write the failing e2e test `tests/e2e/offline.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `podman compose run --rm e2e`
Expected: the 3 new tests FAIL. `navigator.serviceWorker.ready` never resolves (the evaluate times out), and there is no CSP meta and no manifest link.

- [ ] **Step 3: Add the icon source and generate the icons**

`public/icon.svg`: a Candy Pop "suspicious face" sticker (no text, so no font needed):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#FFE14D"/>
  <circle cx="272" cy="272" r="150" fill="#1B1036"/>
  <circle cx="256" cy="256" r="150" fill="#FF5DA2" stroke="#1B1036" stroke-width="16"/>
  <path d="M170 196 l64 22 M342 196 l-64 22" stroke="#1B1036" stroke-width="16" stroke-linecap="round"/>
  <ellipse cx="206" cy="256" rx="38" ry="30" fill="#FFFFFF" stroke="#1B1036" stroke-width="12"/>
  <ellipse cx="306" cy="256" rx="38" ry="30" fill="#FFFFFF" stroke="#1B1036" stroke-width="12"/>
  <circle cx="222" cy="260" r="13" fill="#1B1036"/>
  <circle cx="322" cy="260" r="13" fill="#1B1036"/>
  <path d="M206 336 q50 -22 100 0" fill="none" stroke="#1B1036" stroke-width="14" stroke-linecap="round"/>
</svg>
```

`pwa-assets.config.mjs`:
```js
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#FFE14D' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#FFE14D' } },
  },
  images: ['public/icon.svg'],
})
```

Install the PWA packages. Add the `icons` script to `package.json`, then generate:

Run: `podman compose exec web bun add -d vite-plugin-pwa@1.3.0 workbox-window@7.4.1 @vite-pwa/assets-generator@1.0.4`

`workbox-window` must be a direct dependency. `virtual:pwa-register/vue` imports it from the app's own module graph. Relying on a hoisted transitive copy breaks under strict/isolated installs, with the error `Rolldown failed to resolve import "workbox-window"`; the dry run hit exactly this.

In `package.json` `scripts`, add: `"icons": "bunx --bun pwa-assets-generator"`.

Run: `podman compose exec web bun run icons`
Expected: it prints the generated files. `public/` now holds `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` and `apple-touch-icon-180x180.png`. Open `public/pwa-512x512.png` to check it: a pink face on yellow.
If the generator rejects the `padding`/`resizeOptions` keys, STOP. Report the error text; do not change the preset shape blindly.

- [ ] **Step 4: Configure the plugin, CSP and head links**

`vite.config.ts` (replace):
```ts
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const CSP = [
  "default-src 'self'",
  "connect-src 'self' https:",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
].join('; ')

/** Production-only CSP <meta>: the dev server needs inline scripts and a websocket for HMR. */
function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    cspMeta(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: "Fenna's Imposter — مين المندسّ؟",
        short_name: 'Imposter',
        description: 'A pass-and-play word party game in English and Levantine Arabic.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#FFE14D',
        background_color: '#FFE14D',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Only needed inside the container: file events don't cross the Windows bind mount.
    watch: { usePolling: true, interval: 1000 },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
})
```

`index.html`: add these inside `<head>`, after the viewport meta:
```html
    <meta name="theme-color" content="#FFE14D" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" sizes="any" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

`src/env.d.ts` (replace):
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
```

- [ ] **Step 5: Add registration, the update prompt, and storage persistence**

`src/composables/usePwaUpdate.ts`:
```ts
import { useRegisterSW } from 'virtual:pwa-register/vue'

type Registration = ReturnType<typeof useRegisterSW>
let registration: Registration | null = null

/** Registers the service worker once per page load. App.vue calls it at startup so offline caching never depends on the route. */
export function usePwaUpdate(): Registration {
  registration ??= useRegisterSW({ immediate: true })
  return registration
}
```

`src/components/ui/UpdatePrompt.vue`:
```vue
<script setup lang="ts">
import { useApp } from '../../composables/useApp'
import { usePwaUpdate } from '../../composables/usePwaUpdate'

const app = useApp()
const { needRefresh, updateServiceWorker } = usePwaUpdate()
</script>

<template>
  <button v-if="needRefresh" type="button" class="update" data-testid="update-prompt" @click="updateServiceWorker(true)">
    {{ app.t('update.available') }}
  </button>
</template>

<style scoped>
.update { width: 100%; min-height: var(--tap); padding: 8px 14px; border: var(--outline); border-radius: var(--radius-md); background: var(--mint); box-shadow: var(--shadow-hard-sm); font-weight: 800; }
</style>
```

`src/App.vue`: add the import `import { usePwaUpdate } from './composables/usePwaUpdate'` and call `usePwaUpdate()` right after `const app = useApp()`.

`src/views/HomeView.vue` and `src/views/SetupView.vue` must never show the prompt mid-round (spec §11). In both files:
1. Import `UpdatePrompt from '../components/ui/UpdatePrompt.vue'`.
2. Add `<UpdatePrompt />` as the first child of the default slot, just above the sticker on Home and above the Players panel on Setup.

`src/main.ts`: add, after `createApp(App).use(router).mount('#app')`:
```ts
// Ask the browser not to evict our localStorage under pressure (spec §8). Unsupported → no-op.
void navigator.storage?.persist?.().catch(() => false)
```

- [ ] **Step 6: Build and inspect the output**

Run: `podman compose exec web bun run build`
Expected: exits 0.
- The output lists `dist/sw.js`, `dist/manifest.webmanifest` and a `precache` summary that includes the `.woff2` files.
- `dist/index.html` contains `http-equiv="Content-Security-Policy"`.

- [ ] **Step 7: Run all e2e tests**

Run: `podman compose run --rm e2e`
Expected: `18 pass`, `0 fail`.
If an earlier test now fails with a CSP violation in the console, fix the offending code; do not loosen the policy. Only `connect-src https:` is allowed beyond `'self'`.

- [ ] **Step 8: Lint, type-check and commit**

Run: `podman compose exec web bun run typecheck && podman compose exec web bun run lint`
Expected: exit 0.

```bash
jj commit -m "feat(pwa): make the game installable and fully offline, with update prompt and CSP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Deployment pipeline and README

**Files:**
- Create: `.github/workflows/deploy.yml`, `public/CNAME`, `README.md`

**Interfaces:**
- Consumes: the `test` and `build` scripts.
- Produces: a GitHub Pages deploy on push to `main`. The user creates the remote, sets DNS and pushes (spec §12).

- [ ] **Step 1: Create `public/CNAME`**

```
fennas-game.abisalloum.com
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

Before writing, confirm the action majors are still current (they were on 2026-09-27):

Run: `for a in actions/checkout oven-sh/setup-bun actions/setup-node actions/upload-pages-artifact actions/deploy-pages; do curl -s https://api.github.com/repos/$a/releases/latest | grep -m1 tag_name; done`
Expected: `v7.x`, `v2.x`, `v7.x`, `v5.x`, `v5.x`. If a major changed, use the new major and read its release notes for breaking input changes.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      # Node only for vue-tsc (it cannot resolve .vue files on the Bun runtime).
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: bun install --frozen-lockfile
      - run: bun test
      - run: bun run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 3: Create `README.md`**

````markdown
# Fenna's Imposter — مين المندسّ؟

A pass-and-play "imposter" word party game in English and Levantine Arabic. It installs as a PWA and works fully offline after the first visit.

- Design spec: `docs/superpowers/specs/2026-09-27-fennas-imposter-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-27-fennas-imposter.md`

## Toolchain

Bun 1.4 is the package manager, script runner and unit-test runner. Node appears only inside the containers, for the two tools that cannot run on Bun: `vue-tsc` and Playwright's test runner.

## Develop (podman)

```bash
podman compose build                         # once: dev + e2e images (node/playwright base + Bun)
podman compose up -d web                     # bun install + Vite dev server on http://localhost:5173
podman compose exec web bun test             # unit tests
podman compose exec web bun run lint
podman compose exec web bun run build        # type-check + production build into dist/
podman compose run --rm e2e                  # Playwright end-to-end tests against the production preview
```

Regenerate the app icons after editing `public/icon.svg`:

```bash
podman compose exec web bun run icons
```

## Word packs

Packs are JSON files in the format described in spec §6.1. You can import them on the *Backup & import* screen, from a file or from an `https://` link. The host serving the link must allow cross-origin requests; raw GitHub and Gist URLs do.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. One-time setup:

1. Create the GitHub repository and add it as the `origin` remote of this jj repo.
2. In the repo settings, go to **Pages** and set **Source** to **GitHub Actions**.
3. Add a DNS record: `CNAME fennas-game → <github-user>.github.io`.
4. After the first deploy, tick **Enforce HTTPS**. The service worker needs HTTPS.

The same `dist/` folder can be served by any static web server over HTTPS instead.
````

- [ ] **Step 4: Verify and commit**

Run: `podman compose exec web bun run build`
Expected: exits 0 and `dist/CNAME` exists.

```bash
jj commit -m "chore: add GitHub Pages deploy workflow, custom domain and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23: Final verification

**Files:** none (verification only; fix-ups go in their own commits).

- [ ] **Step 1: Run the complete automated suite**

Run each command. Every one must exit 0.
- `podman compose exec web bun test`. Expected: `149 pass`, `0 fail`, across 14 files, and no skipped tests.
- `podman compose exec web bun run typecheck`
- `podman compose exec web bun run lint`
- `podman compose exec web bun run build`
- `podman compose run --rm e2e`. Expected: 18 passed, 0 skipped, 0 flaky.

If anything fails, use superpowers:systematic-debugging. Do not weaken assertions.

- [ ] **Step 2: Check the spec coverage against the running app**

Open `http://localhost:4173` via `podman compose exec web bun run preview`, or `http://localhost:5173` for dev. Confirm by hand:

1. **Discussion timer**
   - Discussion shows the imposter count. With "Surprise number of imposters" on, it shows "How many imposters? Nobody knows…".
   - With the timer on, the countdown beeps at zero.
2. **Imposter hints**
   - With hints off, the imposter card has no hint.
   - With hints on, a word without a hint shows its category name.
3. **Imposter count**
   - With 4 players and the imposter setting at 2, the between-rounds screen says "…using 1".
4. **Leaving mid-round**
   - Leaving `/play` mid-round asks "Leave the round?".
   - Declining keeps the round, and accepting keeps it resumable from Home via "Continue game".
5. **Ending the game**
   - "End game" asks for confirmation and clears the scores.
6. **Arabic interface**
   - Every screen in Arabic is RTL, with Western digits and no English strings left.
7. **Reduced motion**
   - With `prefers-reduced-motion: reduce` emulated, nothing loops and there is no confetti.

- [ ] **Step 3: Report**

Summarize the following for the user, and state that the commits are ready to push. **Do not push.**
- The commits made.
- The test counts.
- Anything you could not verify, such as behaviour on a real iPhone and Android device.
- The open review items from spec §16: the Arabic wording and the app name.
