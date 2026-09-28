# Fennass, Imposter — Design Spec

- **Date:** 2026-09-27
- **Status:** Approved in brainstorming; pending written-spec review
- **Name:** "Fennass, Imposter" / «فنّاص» — from فنّاص, Levantine for a liar or bluffer (spelled with ص, not س). Inside the game the imposter stays "imposter" / «المندسّ».

## 1. Overview

A pass-and-play party game in the style of "Imposter Who?". One phone goes around the group. Everyone sees the same secret word except the imposter(s). Players take turns giving one-word clues, discuss, and vote out who they think the imposter is.

The game is bilingual: **English** and **Levantine Arabic in Arabic script**. It is an installable, fully offline web app (PWA) with all data stored on the device.

### Goals

- Fully playable offline once the app has been loaded one time.
- Every round is played in one language, which drives UI text, text direction and word content.
- Players, custom categories and words, and settings persist on the device.
- Colorful, playful, animated "Candy Pop" look that stays smooth on inexpensive phones.
- New players can follow along from the short guidance shown on every pass-and-play screen.

### Non-goals (v1)

- Multi-device play, networking, accounts, or cloud sync.
- Showing two languages at once.
- A standalone word editor for adding words outside a round. Words are added by the GM during a round, or by import.
- Bulk paste of word lists.
- Saved import "subscriptions". Only the last-used URL is remembered.
- Analytics, ads, or third-party requests of any kind.

## 2. Glossary

| Term | Meaning |
|---|---|
| **Player** | A named person in the saved roster. |
| **Participant** | A player dealt a card in the current round (active, and not the GM). |
| **Crew** | Participants who are not imposters; they see the word. |
| **Imposter** | Participant who does not see the word (optionally sees a hint). |
| **GM (Game Master)** | Non-playing person who types the secret word for a round. Either a roster player sitting out ("player GM") or someone outside the roster ("outside GM"). |
| **Round** | One deal → clues → discussion → reveal cycle. |
| **Session** | Consecutive rounds from "Start game" to "End game"; holds the scoreboard. |
| **Seed pack** | Built-in categories/words shipped in the app bundle (read-only). |
| **Custom content** | Categories/words created by a GM or imported; stored on device. |

## 3. Game rules & flow

### 3.1 Game setup (persisted)

- **Language:** English or العربية. It can be changed on Home and on the between-rounds screen, never during a round.
- **Roster:** add, rename and remove players. Tick who is playing today (the *active* players).
  - Names are trimmed, 1–20 characters, and unique ignoring case.
- **Categories:** a checklist of categories that have at least one eligible word in the current language (§5.2). At least one must be selected.
- **Settings:**

| Setting | Values | Default |
|---|---|---|
| Imposter count | 1 … max, where **max = ⌊(participants − 1) / 2⌋** | 1 |
| Random imposter count | on/off; picks uniformly from 1…max, count hidden from players | off |
| Imposter hint | on/off | on |
| Show the category on the cards | on/off; both reveal cards get a "Category: …" line | off |
| Discussion timer | off, or 1–10 min in 30 s steps | off (3 min when first enabled) |
| Scoring | on/off | off |

The max rule guarantees the crew always outnumbers the imposters.
- **In Setup**, the slider is bounded by the number of active players.
- **At round start**, the count is clamped again using the actual participant count, since a player GM reduces it by one. The between-rounds screen shows a notice when clamping happens ("Using 1 imposter for 4 players").

### 3.2 Round setup

The between-rounds screen offers:
- a choice of **word source**
- a **Start round** button
- a language switch
- **Edit setup**, which keeps the session scores
- **End game**, which asks for confirmation and then clears the session

| Word source | Who types the word | Participants |
|---|---|---|
| **Random** | App picks from selected categories | All active players |
| **Player GM** | Chosen active player | Active players minus the GM |
| **Outside GM** | Someone outside the roster | All active players |

- A round needs **at least 3 participants**. The Start button is disabled with a reason until this is met.
- **Random source.** If no eligible words exist in the selected categories for the current language, Start is disabled with the reason "No words in the selected categories for العربية".
- **GM sources:**
  1. A "Pass to the Game Master" screen appears, with guidance.
  2. The GM types the word (required) in the round's language.
  3. The GM chooses an existing category (any seed or custom category with a name in the round's language) or creates a new one by typing its name in that language.
  4. The GM may type a hint.
  5. The GM taps Done and hands the phone on.
  6. The word is saved as custom content (§5.3). The GM never sees who the imposters are.
- **All randomness happens at round start:**
  - the imposter set
  - the imposter count, in random mode
  - the starting player
  - the word, for the random source

### 3.3 Reveal (pass-and-play)

For each participant in roster order:

1. **Pass screen:** "Pass the phone to **Name**", with guidance. Button: "I'm Name — show me".
2. **Card screen:**
   - Both cards have the same layout (two lines, or three with the category), so the card's shape never gives a role away:

     | Role | Title line | Second line |
     |---|---|---|
     | Crew | "The secret word is" | the word |
     | Imposter | "You're the imposter!" | the hint (per-word hint in the round language, falling back to the category name) — or "No hint this time" when hints are off |

   - With "Show the category on the cards" on, both cards get a third line, "Category: …" — the imposter sees it too, even with hints off.
   - Each role gets its own guidance text below the card.
3. **"Hide & pass"** hides the card and advances to the next participant.

There is no back navigation, and the card is never shown again after "Hide & pass". After the last participant, the round moves to Starting (§3.4).

### 3.4 Starting and discussion

Two screens follow the last card:

1. **Starting:** a card announces "**Omar** starts" / «**عمر** بيبلّش». The starting player is picked uniformly among participants. The screen also shows turn-taking guidance, the imposter count (or "?" in random mode), and a **"Start playing"** button.
2. **Playing:** a "Playing…" card waits while the group gives clues and discusses. It shows the imposter count, and the countdown if the timer is on.
   - **The timer starts when "Start playing" is tapped**, not at the last card, so the group can settle first.
   - When it ends, the app beeps and vibrates where the device supports it. The timer can be ended early.
   - The **"Reveal the imposter"** / **"Time to vote"** button ends the discussion.

A screen wake-lock is held during Reveal, Starting and Playing.

### 3.5 End of round & scoring

**Scoring off:** the Result screen shows the imposter(s), the hint they were given (when hints are on), the word and the category.

**Scoring on:**
1. **Vote:** "Who did the group vote out?". Tap one participant, or "Nobody".
2. If the voted-out player is an imposter, **Guess:** "Name was an imposter! They get one guess at the word — did they get it?". Answer yes or no.
3. **Result:** reveal the imposters, their hint (when hints are on) and the word, name the winning side, update the scoreboard, and show confetti for the winners.

**Scoring rule:**

| Outcome | Winner | Points |
|---|---|---|
| Voted-out player is an imposter **and** fails to guess the word | Crew | every crew member +1 |
| Anything else (wrong player, nobody, or caught imposter guesses right) | Imposters | every imposter +2 |

The GM never scores. Players who join mid-session start at 0.

Each scoreboard row keeps a snapshot of the player's name:
- While the player still exists, the row shows their current name, so renames carry through.
- If the player is removed from the roster, the row stays for the rest of the session and shows the snapshot name.

### 3.6 Resilience / resume

- The whole app state, including the in-progress round, is saved after every action.
- After a reload or a killed tab, the app resumes in the saved phase.
  - **Reveal** resumes on the **Pass screen** of the next participant. Whether a card is visible is UI-only state and is never persisted, so a card is never shown on resume.
  - **Discussion** resumes the timer from its stored end timestamp. If that time has passed, the timer shows as ended.
- Score deltas are applied in the same saved write that moves the round into Result, so a reload can never apply them twice.

### 3.7 On-screen guidance (drafts; Arabic to be reviewed)

| Screen | English | Arabic (Levantine) |
|---|---|---|
| Pass | Hand the phone to **{name}**. Make sure nobody else can see the screen. | عطي التلفون لـ**{name}**. تأكد إنو ما حدا تاني شايف الشاشة. |
| Pass button | I'm {name} — show me | أنا {name} — فرجيني |
| Crew card | Remember this word. When it's your turn, say another word that shows you know it — without giving it away. | احفظ هالكلمة. لما يجي دورك، قول كلمة تانية بتبيّن إنك بتعرفها، بس بدون ما تفضحها. |
| Imposter card title | You're the imposter! | إنت المندسّ! |
| Imposter card | You don't know the word. Listen to the clues, blend in, and try to work out the word. | ما بتعرف الكلمة. اسمع تلميحات الباقيين، اندمج معهم، وحاول تحزر شو هي. |
| Hint label | Hint: | تلميح: |
| Hide & pass | Hide & pass | خبّي ومرّر |
| GM hand-off | Game Master only: type a secret word. Everyone except the imposter will see it. | بس للحَكَم: اكتب كلمة سرّية. الكل رح يشوفها إلا المندسّ. |
| Discussion | **{name}** starts. Everyone gives one clue in turn, then discuss and vote out who you think is the imposter. | **{name}** بيبلّش. كل واحد بيعطي تلميح بدوره، وبعدين تناقشوا وصوّتوا على مين مفكرينه المندسّ. |
| Vote | Who did the group vote out? | مين طلّعتوا بالتصويت؟ |
| Guess | **{name}** was an imposter! They get one guess at the word — did they get it? | **{name}** طلع مندسّ! إلو محاولة وحدة يحزر الكلمة — حزرها؟ |

## 4. Language & localization

- **One language per round.** The language is stored in app state and copied into the round when it starts, so a round never changes language.
- `<html lang dir>` follows the current language: `en`/`ltr` or `ar`/`rtl`.
- **CSS uses logical properties only** (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Direction-implying icons, such as arrows, are mirrored under `[dir=rtl]`.
- **Player names are interpolated inside `<bdi>`**, so a Latin name in Arabic UI (or the reverse) doesn't scramble the sentence.
- **Numbers use Western digits in both languages**, via `Intl.NumberFormat('ar-u-nu-latn')`.
- **Plurals use `Intl.PluralRules`.** Arabic has six forms: zero, one, two, few, many, other.
- **Dictionaries** are `i18n/en.ts` and `i18n/ar.ts`. The `ar` dictionary is typed against the key set of `en`, so a missing Arabic key is a compile error.
- **`t(key, params)`** does `{name}` interpolation and plural selection. It is custom code of about 50 lines; vue-i18n is not used.
- **Arabic normalization** is used only for duplicate detection and matching, never for display. It:
  - strips tashkeel (U+064B–U+0652) and tatweel (U+0640)
  - maps أ/إ/آ → ا, ة → ه, ى → ي
  - lowercases Latin text and trims/collapses whitespace

## 5. Content

### 5.1 Seed packs

- There are 20 categories of ~60 words (about 1,250 words). Every word has EN and/or AR text and a per-word hint in each language it has.
- They ship as typed TS modules in `src/data/seed/` and are never copied into storage.
- Seed IDs are hand-written and stable, such as `food` and `food.falafel`, so the used-word history survives app updates.
- Two categories are Arabic-only: «من عنّا» (Levantine culture) and «أكل شامي» (Levantine food). They exercise flexible pairs.
- Words and hints must not need American knowledge (no US-only holidays, sports, foods, brands or pop culture). No word appears twice in the seed, and no hint contains its word.
- All Arabic seed content is drafted for the user's review before release.

### 5.2 Eligibility in language L

- A **word** is eligible if `text[L]` is non-empty **and** its category has `name[L]`.
- A **category** is listed if it has at least one eligible word.
- A **hint** shows `hint[L]` if present, else the category's `name[L]`.

### 5.3 GM-entered words

- The GM's word is stored as a custom word with only the round's language filled in: `text[L]`, and `hint[L]` if given.
- Its `categoryId` may point at a seed category or a custom one.
- A new category typed by the GM becomes a custom category with only `name[L]`.
- **Dedupe:** if a word in the same category has the same normalized `text[L]`, it is reused, and a newly typed hint fills an empty `hint[L]`.
- The same dedupe applies to category names across seed and custom categories.

### 5.4 Repeat avoidance

- `usedWordIds[L]` lists the word ids used in random rounds in language L. It persists across sessions.
- The pool is the eligible words in the selected categories minus the used ones. If the pool is empty, those eligible ids are removed from the used list and the pick is made from all eligible words.
- GM rounds do not touch the used list.

### 5.5 "My Words" screen

- Lists custom categories and custom words, grouped by category. It also lists custom words that live in seed categories.
- For a custom word you can edit its EN/AR text and hint, or delete it.
- For a custom category you can edit its EN/AR name, or delete it. Deleting asks for confirmation and deletes its custom words.
- Seed content is read-only.

## 6. Import / export

### 6.1 Format (shared by export, file import, URL import)

```jsonc
{
  "format": "fennas-imposter",
  "version": 1,
  "categories": [ { "id": "levant-food", "name": { "en": "Levantine food", "ar": "أكل شامي" } } ],
  "words": [ { "id": "levant-food.manaeesh", "categoryId": "levant-food",
               "text": { "ar": "مناقيش" }, "hint": { "ar": "زعتر" } } ],
  "players": [ { "id": "…", "name": "Rami" } ],   // optional
  "settings": { … }                              // optional
}
```

**Validation:**
- **ids:** 1–64 characters of `[A-Za-z0-9._:-]`.
- **Localized fields:** at least one language, with these lengths after trimming:
  - word text and hint: ≤ 40 characters
  - category name: ≤ 30 characters
  - player name: 1–20 characters
- **`categoryId` references:** must resolve to a category in the file, a seed category, or an existing custom category.
- **Error handling:**
  - Unknown fields are ignored.
  - Any invalid entry **rejects the whole file**. Up to 10 errors are shown, and nothing changes.

### 6.2 Export

- Downloads `fennas-imposter-YYYY-MM-DD.json`.
- Contains players, custom categories, custom words and settings.
- Leaves out the in-progress round, the session and the used-word history, because those are device-local.

### 6.3 File import

- **Preview, then confirm.** Example: "Adds 2 categories, 40 words, 3 players; updates 5 words; replaces settings; skips 1 entry (built-in id)".
- **Categories and words:** upserted by id. Entries whose id matches a **seed** id are skipped and reported, so imports can never overwrite built-ins.
- **Players:** merged by normalized name. Names that already exist are kept; new ones are added.
- **Settings:** replaced, if present in the file.

### 6.4 URL import

- Imports **categories and words only**. `players`/`settings` in the file are ignored.
- **HTTPS only.** Fetched with `cache: 'no-store'`, a 15 s timeout, and a 1 MB size limit (checked via `Content-Length` and on the body).
- Same validation, seed-id protection, preview and upsert as file import.
- **Errors:**
  - Offline → "You're offline".
  - Network or CORS failure → "Couldn't reach that URL (the server may not allow cross-site access)".
  - Non-2xx response → shows the status.
  - Invalid JSON or schema → shows the validation errors.
- The last-used URL is remembered and prefilled.
- Upsert by id means re-importing the same URL refreshes the content. Local edits to those ids are overwritten, and the preview says so.
- Imported text is rendered only through Vue's escaped interpolation. `v-html` is never used anywhere in the app.

## 7. Architecture

Stack: **Vue 3 + TypeScript + Vite on Bun**, `vue-router` (hash history), `vite-plugin-pwa`, `@fontsource` (self-hosted font). No Pinia, no vue-i18n, no animation library.

```
UI (Vue SFCs)        views/, components/      renders state, dispatches actions
      │
App state            composables/useApp.ts    single reactive store; persists every change
      │
Engine (pure TS)     engine/                  no Vue, no DOM, no storage, no clock, no Math.random
```

Dependencies point downward only. The engine is deterministic given its inputs, including an injected RNG and `now` timestamps.

### 7.1 Repository layout

```
compose.yaml  containers/  package.json  bun.lock  bunfig.toml  vite.config.ts  playwright.config.ts
tsconfig*.json  index.html  .gitignore
public/                 CNAME, icons (svg + png 192/512/maskable)
src/
  main.ts  App.vue  router.ts
  engine/               types.ts  rng.ts  words.ts  assign.ts  round.ts  scoring.ts   (+ *.test.ts)
  data/                 seed/  storage.ts  transfer.ts  normalize.ts                (+ *.test.ts)
  i18n/                 en.ts  ar.ts  index.ts                                      (+ *.test.ts)
  composables/          useApp.ts  useTimer.ts  useWakeLock.ts  useSound.ts
  views/                HomeView  SetupView  PlayView  WordsView  DataView
  components/phases/    GmEntry  PassScreen  CardScreen  Discussion  Vote  Guess  Result  BetweenRounds
  components/ui/        StickerCard  PopButton  Chip  Confetti  Scoreboard  …
  styles/               tokens.css  base.css  animations.css
tests/e2e/              Playwright specs
.github/workflows/      deploy.yml
docs/superpowers/       specs/  plans/
```

### 7.2 Routes

| Route | View | Purpose |
|---|---|---|
| `#/` | Home | Title, language switch, Play / Continue, My Words, Data |
| `#/setup` | Setup | Roster, active players, categories, settings. The Done button stays pinned to the bottom while the page scrolls |
| `#/play` | Play | Between-rounds screen and the whole round. Phases are driven by engine state and add no history entries, so the back button can never step into another player's card. Back during a round asks "Leave the round?" and keeps it resumable. |
| `#/words` | My Words | Edit/delete custom content (§5.5) |
| `#/data` | Data | Export, file import, URL import |

## 8. Data model & storage

```ts
type Lang = 'en' | 'ar';
type Localized = Partial<Record<Lang, string>>;

interface Category { id: string; name: Localized; builtIn: boolean }
interface Word { id: string; categoryId: string; builtIn: boolean; text: Localized; hint: Localized }
interface Player { id: string; name: string }

interface Settings {
  imposterCount: number; randomImposterCount: boolean;
  hints: boolean; showCategory: boolean; timer: { enabled: boolean; seconds: number }; scoring: boolean;
}

interface Stored {
  version: 3;
  language: Lang;
  players: Player[]; activePlayerIds: string[];
  settings: Settings; selectedCategoryIds: string[];
  customCategories: Category[]; customWords: Word[];
  usedWordIds: Record<Lang, string[]>;
  lastImportUrl: string | null;
  session: { scores: Record<string, { name: string; points: number }>; rounds: number } | null;
  round: RoundState | null;
}
```

**Storage:**
- One JSON document at `localStorage['fennas-imposter']`. It is written synchronously after every state change; the data is small.
- **Migrations:** `migrations[n]` upgrades version n to n+1. They are applied in order on load. Version 2 switches on the categories added with it for players who saved before, leaving their other choices alone. Version 3 adds `showCategory: false` to the settings and to a round in progress.
- On first run the app calls `navigator.storage.persist()` to reduce eviction risk.
- The Data screen recommends exporting a backup.
- New ids use `crypto.randomUUID()`.

**Failure handling:**

| Condition | Behavior |
|---|---|
| `localStorage` unavailable or quota exceeded | Keep running in memory. Show a persistent banner: "Can't save on this device — changes will be lost when the app closes". |
| Stored JSON corrupt / fails validation | Copy the raw string to `fennas-imposter:corrupt:<timestamp>`, start with defaults, and show a notice. |
| Stored `version` newer than the app knows | Don't overwrite it. Run in memory with a persistent (not dismissible) notice to reload/update the app. |

## 9. Engine

### 9.1 Round state

```ts
type Phase = 'gmEntry' | 'reveal' | 'starting' | 'discussion' | 'vote' | 'guess' | 'result';
type Source = { kind: 'random' } | { kind: 'playerGm'; gmPlayerId: string } | { kind: 'outsideGm' };

interface Secret { wordId: string; word: string; hint: string | null; categoryName: string }

interface RoundState {
  number: number;                    // round number within the session
  lang: Lang;
  source: Source;
  participantIds: string[];          // pass order = roster order, GM excluded
  imposterIds: string[];
  startingPlayerId: string;
  secret: Secret | null;             // null only during gmEntry; a snapshot so later edits don't alter the round
  settings: Pick<Settings, 'hints' | 'showCategory' | 'scoring' | 'timer'> & { imposterCountHidden: boolean };
  phase: Phase;
  revealIndex: number;               // next participant to see their card
  timerEndsAt: number | null;        // epoch ms
  votedOut: { playerId: string | null } | null;   // null until voted; playerId null = "Nobody"
  imposterGuessed: boolean | null;
  outcome: 'crew' | 'imposters' | null;   // null when scoring is off
}
```

### 9.2 Functions

- `eligibleWords(content, lang, categoryIds): Word[]`
- `pickWord(eligible, used, rng): { word, used: string[] }`: applies the reset rule from §5.4.
- `maxImposters(n) = Math.floor((n - 1) / 2)`
- `assignImposters(participantIds, settings, rng): string[]`
- `startRound(input, rng): RoundState`
  - Validates that there are at least 3 participants and at least one eligible word (random source).
  - Does all the random picks.
  - Starts in `gmEntry` for GM sources, `reveal` for the random source.
- `reduce(state, action): RoundState`: pure. Throws `IllegalActionError` for an action that is invalid in the current phase.
- `scoreDeltas(state): Record<playerId, number>`: follows the table in §3.5. Returns `{}` when scoring is off.

### 9.3 Transitions

| Phase | Action | Next | Effect |
|---|---|---|---|
| gmEntry | `setSecret{secret}` | reveal | secret stored |
| reveal | `cardSeen{now}` | reveal | `revealIndex++` |
| reveal (last card) | `cardSeen{now}` | starting | starter announced; no timer yet |
| starting | `startPlaying{now}` | discussion | `timerEndsAt = timer.enabled ? now + seconds·1000 : null` |
| discussion | `endDiscussion` | vote (scoring on) / result (scoring off) | — |
| vote | `voteOut{playerId \| null}` | guess (voted-out is imposter) / result | otherwise `outcome = 'imposters'` |
| guess | `imposterGuess{correct}` | result | `outcome = correct ? 'imposters' : 'crew'` |
| result | — | — | terminal; the app clears `round` on "Next round" |

- The app layer (`useApp`) resolves or creates GM words and categories (§5.3) before dispatching `setSecret`. This keeps the engine free of storage.
- When a transition enters `result`, `useApp` applies `scoreDeltas` to the session **in the same saved write**.

## 10. Visual design & animation — "Candy Pop"

- **Palette (CSS tokens):**

| Token | Hex |
|---|---|
| sun | `#FFE14D` |
| bubblegum | `#FF5DA2` |
| grape | `#6C4DFF` |
| mint | `#00C2A8` |
| tangerine | `#FF7A00` |
| ink | `#1B1036` |
| paper | `#FFFFFF` |

  Screens get a bold solid background per phase: sun for pass screens, mint for every card screen. **Crew and imposter card screens look identical** (same background, card and motion); only the text differs, so bystanders can't read a role from colour or movement.
- **Sticker style:** 3 px ink outlines, hard offset shadows (`6px 6px 0 ink`), large radii (18–22 px), and slight rotations.
- **Typography:** **Baloo Bhaijaan 2** (Latin + Arabic), self-hosted via `@fontsource`, weights 500/700/800. The secret word is shown at 40–48 px.
- **Motion:**
  - CSS keyframes and Vue `<Transition>` only.
  - **Phase changes:** pop-in (fade + vertical bounce). Whole screens never scale or rotate, because that overflows the viewport sideways.
  - **Stickers:** wobble.
  - **Buttons:** squish on press.
  - **Background:** drifting background shapes.
  - **Cards:** the same wobble for every role (never a role-specific motion).
  - **Confetti:** hand-rolled CSS/canvas, about 50 lines, for the winning side.
  - Only `transform` and `opacity` are animated.
  - `prefers-reduced-motion: reduce` disables looping animations and replaces pop-ins with short fades.
- **Layout:**
  - Mobile-first portrait.
  - Tap targets are at least 48 px.
  - Primary actions sit at the bottom of the screen, within thumb reach.
  - The UI works on desktop too, as a centered phone-width column.
- **Accessibility:**
  - Ink-on-color text meets WCAG AA.
  - Visible focus rings.
  - The timer has an `aria-live="polite"` label that updates once per minute and at 10 s left.
- **Reference mockup:** `.superpowers/brainstorm/*/content/visual-style.html`, option A. It is local only and not committed.

## 11. PWA & offline

- **`vite-plugin-pwa` with `registerType: 'prompt'`.**
  - Workbox precaches the full build: HTML, JS, CSS, fonts and icons.
  - URL imports are never cached.
- **Update prompt:** "New version available — tap to reload". It shows only on Home and Setup, never during a round.
- **Manifest:**

| Field | Value |
|---|---|
| `name` / `short_name` | `Fennass, Imposter — فنّاص` / `Fennass` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` / `background_color` | `#FFE14D` |
| `start_url` | `/` |
| icons | 192, 512 and a maskable icon in the Candy Pop style |

- **CSP via `<meta>`**, because a static host can't set response headers: `default-src 'self'; connect-src 'self' https:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'`. `https:` in `connect-src` exists for URL import.
- **Wake Lock API:** used where supported, ignored otherwise.
- **Timer beep:** Web Audio oscillator, with no audio file. The `AudioContext` is created or resumed on the last "Hide & pass" tap, which satisfies iOS's user-gesture requirement.
- **Vibration:** `navigator.vibrate` where available; iOS has none, so the beep is the reliable signal.
- **Supported browsers:** iOS Safari 17+ and current Android Chrome are primary. Current desktop browsers also work.

## 12. Deployment

- `bun run build` produces a static `dist/` served at the root path (`base: '/'`).
- The GitHub Actions workflow `.github/workflows/deploy.yml` builds on push to `main` and deploys to **GitHub Pages**.
- `public/CNAME` contains `fennas-game.abisalloum.com`.
- **Manual steps for the user:**
  - Create the GitHub repo and remote, and push. Claude never pushes.
  - Add a DNS `CNAME fennas-game → <user>.github.io`.
  - Enable Pages → GitHub Actions in the repo settings.
  - Enable HTTPS enforcement.
- If the user's own server serves or proxies the site instead, the same `dist/` works unchanged. The service worker requires HTTPS.

## 13. Development environment

- **Toolchain: Bun ≥ 1.4 (pinned 1.4.2), with Node only where a tool can't run on Bun.**
  - **Bun runs:** install (`bun.lock`), scripts, unit tests (`bun test`), and Vite, ESLint and icon generation on the Bun runtime (`bunx --bun`).
  - **Node 24 runs only two tools**, both verified in a dry run:
    - `vue-tsc`: on the Bun runtime it cannot resolve `.vue` imports.
    - Playwright's test runner: Playwright does not support Bun as its runtime.
- `compose.yaml` (podman compose), with the repo bind-mounted at `/app`:
  - **`web` service:**
    - Image built from `containers/web.Containerfile`: `node:24` plus the Bun 1.4.2 binary.
    - Command: `bun install && bun run dev`, on port `5173:5173`.
    - `node_modules` lives in a **container volume** so Linux native binaries never mix with Windows ones.
  - **`e2e` service:** image built from `containers/e2e.Containerfile`, which is the official Playwright image (pinned to the version in `package.json`) plus Bun. It runs `bun run test:e2e` against `vite preview`, because the service worker only exists in production builds.
- **Scripts:**

| Script | Runs |
|---|---|
| `dev` | Vite dev server (Bun runtime) |
| `typecheck` | `vue-tsc --noEmit` over the app, test and node configs (Node runtime) |
| `build` | `typecheck` then `vite build` (Bun runtime) |
| `preview` | `vite preview` (Bun runtime) |
| `test` | `bun test` |
| `test:e2e` | `playwright test` (Node runtime) |
| `lint` | `eslint` (Bun runtime) |

- All installs, builds and tests run inside the containers.
- **Test mode (dev server only):** a Setup toggle, shown only on the Vite dev server, makes every random round deal the fixed word "Secret word" / hint "Secret hint" / category "Category" (Arabic «كلمة سرّية» / «تلميح سرّي» / «فئة») without touching the used-word history, so the UI can be exercised repeatedly. Production builds never show or honour it.

## 14. Testing

Tests encode *why* a rule exists, not only what the code does.

**Unit tests (`bun test`), colocated `*.test.ts`:**

| Area | Tests |
|---|---|
| `assign` | Crew always outnumbers imposters for n = 3…12. Random mode stays within 1…max. The seeded RNG makes results reproducible. |
| `words` | Eligibility per language, including Arabic-only words, which are ineligible in English. No repeats until the pool is exhausted, then a reset. The history survives across calls. |
| `round` | Every legal transition. Illegal actions throw. The timer end is set only when the timer is enabled. The GM is never a participant. |
| `scoring` | Every row of the scoring table. The GM and non-participants get nothing. |
| `storage` | The migration chain. The corrupt-data backup path. Refusal of a newer version. |
| `transfer` | Validation errors. Seed-id collisions skipped. Upsert semantics. Players merged by name. URL-mode ignores players and settings. |
| `normalize` | Tashkeel, alef variants, ة/ه, ى/ي, whitespace and case. |
| `i18n` | Arabic plural forms (0, 1, 2, 3, 11, 100). Interpolation. |

**End-to-end tests (Playwright), against the production preview, phone viewport:**
1. A full English random round with scoring. The scoreboard updates correctly.
2. A full Arabic round. `html[dir=rtl]` is set, and the Arabic word and hint are shown.
3. A player-GM round. The GM's word is dealt, then appears in My Words. The GM is not dealt a card.
4. Reload during reveal lands on the "Pass to" screen, never on a card.
5. Offline: load once, go offline, reload, and a full round still works.
6. Export, then import into a fresh context, round-trips the custom content.
7. URL import of a fixture pack. Playwright `page.route()` answers a mocked `https://` URL, so no real network is used and the HTTPS-only rule is exercised as written.

## 15. Error handling summary

| Situation | Behavior |
|---|---|
| Fewer than 3 participants / no eligible words | Start disabled with the reason shown |
| Illegal engine action (bug) | Throws; dev overlay in dev. In production, an error screen offers "Abandon round" (keeps the session). |
| Storage problems | See §8 |
| Import/URL errors | See §6.4. Nothing changes until the user confirms a valid preview. |
| Wake Lock / Vibration / Audio unsupported | Silently skipped |

## 16. Open items for the user to confirm

1. **App name:** decided — "Fennass, Imposter" / «فنّاص».
2. **Arabic wording:** all strings in §3.7 and all Arabic seed content are drafts. They use generic-masculine imperatives (اسمع، اكتب), as is standard in Arabic UI.
3. **Starting player:** chosen uniformly among participants, which means an imposter can start. The alternative is excluding imposters from starting.
