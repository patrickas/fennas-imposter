# Difficulty levels — Design Spec

- **Date:** 2026-10-03
- **Status:** Approved in brainstorming; pending written-spec review
- **Extends:** `2026-09-27-fennas-imposter-design.md` (§3.1 settings, §5 content, §6.1 format, §8 storage, §9 engine)

## 1. Goal

Rounds can be **easy** or **hard**. A *Difficulty* setting picks Easy, Hard or Random, and every player sees the round's level as a badge.

A hard round is one of two kinds:

- **Hard word:** a less common word, with its normal hint.
- **Subtle hint:** an ordinary (easy) word, but the imposter gets a subtler hint. An optional explanation of that hint is shown at the end of the round.

"Show the category on the cards" is already in the app (§3.1 of the main spec) and is not part of this work.

### Non-goals

- Fields for level or subtle hints in the app's own word editing (GM entry, *My Words*). In-app words are always easy with no subtle hint; hard words and subtle hints come only from the built-in packs and imported JSON.
- A level for Game Master rounds. The GM picks the word, so those rounds have no level and no badge.
- Subtle hints on hard words.

## 2. Setting

| Setting | Values | Default |
|---|---|---|
| Difficulty | Easy, Hard, Random | Easy |

- Shown in *Setup → Settings* as a radio group styled like *Word source*, right below it.
- Shown only while the word source is Random; it has no effect on GM rounds.
- Saved data from before this feature gets **Easy**, so existing games play exactly as before.
- Included in backups. Backups without it import as Easy.

## 3. Data

### 3.1 Word

```ts
export type Level = 'easy' | 'hard'

export interface SubtleHint {
  hint: Localized   // at least one language
  why: Localized    // optional explanation; may be empty
}

export interface Word {
  // …existing fields
  level: Level
  subtle: SubtleHint | null   // only on easy words
}
```

### 3.2 Pack format (extends main spec §6.1)

```jsonc
{ "id": "animals.chameleon", "categoryId": "animals",
  "level": "hard",                                   // optional: "easy" | "hard"; absent = "easy"
  "text": { "en": "Chameleon", "ar": "حرباية" }, "hint": { "en": "Colours", "ar": "ألوان" } }

{ "id": "animals.cat", "categoryId": "animals",
  "text": { "en": "Cat", "ar": "بسّة" }, "hint": { "en": "Meow", "ar": "مياو" },
  "subtle": {                                        // optional, easy words only
    "hint": { "en": "Nine", "ar": "سبعة" },
    "why":  { "en": "A cat has nine lives", "ar": "البسّة إلها سبع أرواح" } } }  // "why" optional
```

- **`version` stays 1.**
  - Packs and backups made before this feature import unchanged, and every word in them is easy.
  - An older copy of the app ignores the new fields (main spec §6.1, "unknown fields are ignored"), so there a hard word plays as an ordinary word. That is accepted.
- **Validation** (any failure rejects the whole file, as today):
  - `level` must be `"easy"` or `"hard"` when present.
  - `subtle` must be an object when present.
  - `subtle.hint` is required, needs at least one language, and allows ≤ 40 characters (`LIMITS.hint`).
  - `subtle.why` is optional. Each language allows ≤ 80 characters (new `LIMITS.why`).
  - A word with `"level": "hard"` and a `subtle` is rejected, with a new error code `subtleOnHard`.
- **Export** writes `level` only for hard words and `subtle` only when one is set.

### 3.3 Playability in language L (extends main spec §5.2)

- A word is playable as before: its category is named in L and `text[L]` is present.
- An easy word's **subtle hint is playable in L** when `subtle.hint[L]` is present. `why[L]` is optional.

### 3.4 Storage

- `CURRENT_VERSION` goes from 5 to 6. The migration from v5:
  - sets `settings.difficulty = 'easy'`;
  - sets each custom word to `level: 'easy', subtle: null`;
  - sets `level: null, hintWhy: null` on the secret of a round in progress.
- Custom words updated by an import take the imported `level`/`subtle`. An import never touches built-in words (main spec §6.3).

### 3.5 Built-in packs

`SeedPack` gains two lists next to `rows`. The existing 1,254 rows stay unchanged.

```ts
/** Same five columns as SeedRow; these words are hard. */
hard: readonly SeedRow[]
/** [slug of an existing easy row, subtle hint EN, AR, why EN, AR] — null when a language is absent. */
subtle: readonly SubtleRow[]
```

- **Ids:** hard words get ids `${pack}.${slug}`, like other words. Slugs must be unique across `rows` and `hard`.
- **Content target:** about 10 hard words and about 10 subtle hints (with explanations) per pack, in English and Levantine Arabic, in the pack's existing tone.
  - Hard words are less common but still recognisable to a family table, not trivia.
  - The Arabic is reviewed by the user before release.

## 4. Choosing the round's word (Random source only)

### 4.1 Level

| Setting | Level |
|---|---|
| Easy | easy |
| Hard | hard |
| Random | coin flip: easy or hard |

### 4.2 Pools

Each pool is drawn from the playable words in the selected categories, in the round's language L:

| Pool | Words | Imposter's hint |
|---|---|---|
| **easy** | easy words | `hint[L]`, falling back to the category name (as today) |
| **hardWord** | hard words | `hint[L]`, falling back to the category name |
| **subtle** | easy words whose subtle hint is playable in L | `subtle.hint[L]`; explanation `subtle.why[L]` if present |

### 4.3 Resolution

1. **Level easy:** the easy pool.
2. **Level hard:** candidate kinds are hardWord and subtle.
   - Drop a kind whose pool is empty.
   - Drop subtle when *Imposter hint* is off, since the imposter would not see it.
   - Two kinds left: a coin flip picks one. One left: that one.
   - None left: the round **falls back to easy**, and the badge says Easy.
3. **Level easy, empty easy pool:** this happens when the selected categories hold only hard words. The round uses step 2 instead, and the badge says Hard.
4. **No playable word at all:** starting a round is already blocked when no word is eligible (main spec §5.2). That check counts easy and hard words alike, so it is unchanged. The Setup word counts include hard words too.

Over many Random rounds this gives about 50% easy, 25% hard word and 25% subtle hint, when all pools have words.

### 4.4 Repeat avoidance (extends main spec §5.4)

- There is still one used-word history per language.
- Each pool is drawn with `pickWord` against that history.
  - When a pool runs out, only that pool's ids are dropped from the history, as today.
  - An easy word played in an easy round therefore counts as used for the subtle pool too, and the other way round.

### 4.5 Round snapshot

`Secret` gains:

```ts
level: Level | null     // null for GM rounds and for rounds saved before v6
hintWhy: string | null  // subtle rounds only, when why[L] is present
```

In a subtle round, `Secret.hint` holds the subtle hint. `imposterHint()` is unchanged.

### 4.6 Test mode (dev server only)

- Test mode settles the level and kind exactly as in §4.3, as if every pool were non-empty.
- It deals the fixed test word:
  - Easy and hard-word rounds deal "Secret word" with "Secret hint".
  - Subtle rounds deal "Secret word" with "Secret subtle hint" and the explanation "Secret explanation".
  - All of these have Arabic equivalents.
- The used-word history stays untouched, as today.

## 5. Screens

- **Badge:** a chip reading **Easy** / **Hard** (Arabic: **سهل** / **صعب**).
  - It shows during a round whenever `secret.level` is set: on the pass screen, the card screen, the "X starts" screen, discussion and result.
  - It has the same place and look on every player's card, so it reveals no role.
  - It never says which kind of hard round it is.
- **Result:** when *Imposter hint* is on and `secret.hintWhy` is set, the explanation shows under the imposter's hint.
- **Setup:** the *Difficulty* radio group (§2).
- All new text gets English and Arabic strings.

## 6. Testing

### Unit tests (`bun test`)

- **Pack parsing** (`transfer`):
  - `level` is accepted, and a bad value is rejected.
  - `subtle` works with and without `why`.
  - A `subtle` with no hint is rejected.
  - Too-long `why` is rejected.
  - `subtle` on a hard word is rejected (`subtleOnHard`).
  - Old packs import as easy.
  - Export round-trips `level` and `subtle`.
- **Storage:** the v5 → v6 migration covers settings, custom words and a round in progress.
- **Word choice** (`engine/words`, with a fixed random seed):
  - each setting maps to the right level, including both coin flips;
  - each fallback: an empty hardWord pool, an empty subtle pool, hints off, nothing hard → easy;
  - the subtle snapshot has the subtle hint and the explanation, with and without `why`.
- **Seed:**
  - Every `subtle` slug points at an existing row in the same pack.
  - Hard slugs are unique and do not clash with `rows`.
  - Every pack has at least 8 hard words and 8 subtle hints.
  - All text is within the limits.
  - Hard words and subtle hints have both English and Arabic.

### End-to-end (Playwright)

- With test mode and Difficulty Hard, the badge appears on the pass and card screens.
- When a subtle round is dealt, the explanation appears on the result screen.
- With Difficulty Easy, the badge says Easy.
- In a GM round, no badge appears.

### Before reporting done

`bun test`, `bun run lint`, `bun run build` and the e2e run, all inside the podman containers.
