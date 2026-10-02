# Paid unlock — Design Spec

- **Date:** 2026-10-03
- **Status:** Approved in brainstorming; pending written-spec review
- **Extends:** `2026-09-27-fennas-imposter-design.md` (home screen, between rounds, storage)

## 1. Goal

Alex sells the game to family, face to face.

- The **free** version plays **2 rounds per day** on each phone.
- The **paid** version is unlimited.
- Payment happens in person, with no payment system. The customer reads Alex their phone's **secret word**, pays, and Alex tells them the **magic word**. Typing the magic word unlocks that phone.
- Alex makes magic words on his own phone, which is put in **owner mode** once with a password.

### Accepted risks and non-goals

This is a family game, not real copy protection. These are accepted:

- **Nothing is secret.** The key recipe and the owner password are in the code, which ships to every phone and sits in a public repo. Anyone who reads it can make keys.
- **The free limit is easy to dodge:** clear the site's data, use a private tab, or change the phone's date.
- **An unlock lives in the browser's storage.** Clearing site data, moving to a new phone, or Safari evicting the site's data after about 7 days unused (when it isn't installed to the home screen) gives the phone a new secret word, and it is locked again. Alex re-unlocks it for free.
- **Keys only match when both phones run the same version.** The key list comes from the built-in packs (§3.1), so editing early packs changes it.
- **No limit on unlock tries.** The box accepts any number of guesses.
- **No grandfathering.** Phones that already have the game get the free limit too.
- **The unlock is not in backups.** A backup file cannot be used to share it.
- **One unlock covers one phone,** or more exactly one browser's storage.

## 2. Free limit

- `FREE_ROUNDS_PER_DAY = 2`, in `src/data/limits.ts`.
- **A round counts when it is dealt** (`beginRound`), whatever the word source. Abandoned rounds count.
- **The day is the phone's local date** (`YYYY-MM-DD`, from `now()`). A different date from the stored one starts the count again from 0, including when the clock is moved back.
- **Unlocked phones** have no limit, and their rounds are not counted.
- **On the dev server** (`devTools`) the limit never blocks, just as test mode exists only there. Production builds, including the e2e preview, apply it.

## 3. Keys

### 3.1 Key list

`KEY_WORDS` is the **first 256 English words of `SEED_WORDS`**, in shipping order. Words without `text.en` are skipped.

- The list is derived from the packs, not frozen (§1, "same version").
- Today it runs from "Falafel" (food) to "Airport" (places). It contains no duplicates; 25 entries have more than one word, such as "Ice cream".

### 3.2 Secret word

- The secret is a random integer from 0 to 255. It is chosen the first time the app runs without a saved license, then kept forever (§4).
- The word shown is `KEY_WORDS[secret]`, always in English, even when the app is in Arabic.

### 3.3 Magic word

```ts
magicIndex(s) = (s * 167 + 89) % 256
```

- **167 is odd,** so the map is one-to-one: every secret word has its own magic word.
- **89 is odd,** so `166·s + 89` is always odd and never a multiple of 256. A secret word is therefore never its own magic word.

### 3.4 Matching typed words

- `keyText(s)` is `normalizeText(s)` with all whitespace removed.
- Typed text matches a word when their `keyText`s are equal. "ICE CREAM", "icecream" and " Ice  cream " all match "Ice cream".

### 3.5 Owner mode

- `OWNER_PASSWORD = 'wrong horse battery staple'`, stored in plain text and compared with `keyText`.
- **Typing it into the unlock box** makes the phone unlocked **and** the owner's.
- **Make a key** (owner's phone only):
  - Alex types the customer's secret word.
  - The app finds the index `i` whose word matches, and shows `KEY_WORDS[magicIndex(i)]`.
  - A word that isn't in the list shows "That's not one of the secret words".

## 4. Storage

The license is a separate localStorage entry, **`fennas-imposter:license`**, outside the main save:

```ts
interface License {
  secret: number     // 0–255
  unlocked: boolean
  owner: boolean
  day: string        // local date that `used` counts, 'YYYY-MM-DD'; '' before the first round
  used: number       // rounds dealt on `day`
}
```

- **Why it's separate:**
  - The main save is reset to defaults when it is damaged or from a newer version. A paying customer must not lose their unlock with it.
  - It needs no `CURRENT_VERSION` bump and no migration.
  - Backup and import never touch it.
- **Missing:** a new license is made (random secret, locked, `day: ''`, `used: 0`) and saved right away, so the secret word stays the same.
- **Damaged** (not JSON, or the wrong shape): treated as missing. This is as rare as clearing data, and has the same result.
- **Storage unavailable, or a failed save:** the license lives in memory until the page reloads.

## 5. Screens

### 5.1 Home

- **New secondary button "About"** (`nav-about`), after *Backup & import*. It opens `/about`.
- **On free phones,** a line under the tagline: "Free rounds left today: N" (`free-rounds`). It is hidden once the phone is unlocked.

### 5.2 Between rounds

Every round starts at the *Start round* button here, so this is where the limit blocks.

- **New blocker `'locked'`,** checked after the existing ones, so their messages take priority.
- **Message:** "No free rounds left today."
- **The Start round button** reads **Unlock** and opens `/about`, instead of being disabled.
- *Let's play* and *Next round* work as before; they lead here.

### 5.3 About (`/about`)

- A **Back** button to Home, like the other screens.
- **Alex's face:** the app icon, turning slowly (a new `spin` keyframe). It stops under `prefers-reduced-motion`, like the other animations.
- **Free phone:**
  - "Free version: 2 rounds a day. Ask Alex for the magic word to unlock the game."
  - "Your secret word:" followed by the word, big (`secret-word`).
  - A text box (`magic-input`) and an **Unlock** button (`unlock`). Enter submits too.
  - **Wrong word:** the box shakes, and "That's not it" appears (`unlock-wrong`).
  - **Right word, or the owner password:** "Unlocked! Thanks for supporting Alex." appears (`unlocked`), and the box goes away.
  - **Help link** (`help-email`): "Trouble getting a key? **Email us**", where "Email us" is the link. The address itself is not shown, to keep the line short on a phone.
    - It is a `mailto:` link with the subject "Fennass key" and a body that already says "My secret word: …", since Alex needs that word to make a key.
    - It shows on free phones only.
- **Unlocked phone:** only the thanks message. The secret word is hidden.
- **Owner's phone:** the thanks message, plus a **Make a key** section:
  - a text box "Their secret word" (`key-input`)
  - a **Make key** button (`make-key`)
  - the result (`key-result`): the magic word, big, or the "not one of the secret words" message.
- **Text boxes** have `autocapitalize="off"`, `autocomplete="off"` and `spellcheck="false"`.
- All new text has English and Arabic strings. Secret and magic words are always English.

## 6. Code

- **`src/data/limits.ts`:** `FREE_ROUNDS_PER_DAY`.
- **`src/data/license.ts`** (new), plain functions with no Vue:
  - `KEY_WORDS`, `magicIndex`, `keyText`, `OWNER_PASSWORD`
  - `findKeyIndex(input)` returns `number | null`
  - `localDay(now)`, `freeRoundsLeft(license, day)`, `countRound(license, day)`
  - `loadLicense(storage, rng)` and `saveLicense(storage, license)`, reusing `StorageLike`
- **`src/composables/useApp.ts`:**
  - loads the license next to the main save
  - `RoundBlocker` gains `'locked'`, which is never returned on the dev server
  - `beginRound` counts the round on phones that aren't unlocked
  - new exports: `freeRoundsLeft`, `secretWord`, `isUnlocked`, `isOwner`
  - `unlock(input)` returns `'unlocked' | 'owner' | 'wrong'`
  - `makeKey(input)` returns `string | null`
- **`src/router.ts`:** `/about` goes to the new `views/AboutView.vue`.
- **`HomeView.vue`, `BetweenRounds.vue`:** as in §5.
- **`src/i18n/en.ts`, `ar.ts`:** the new strings.
- **`src/styles/animations.css`:** the `spin` keyframe.

## 7. Testing

### Unit tests (`bun test`)

- **`magicIndex`:**
  - Over 0–255 it gives 256 different values. A shared key would let one magic word unlock phones that didn't pay.
  - No value equals its input. Otherwise a customer could unlock with the secret word shown on their own screen.
- **`KEY_WORDS`:** has exactly 256 words, all different by `keyText`. Make a key has to find exactly one word.
- **`keyText`:** capitals, spaces and tashkeel are ignored. "Ice cream" matches "icecream".
- **Owner password:** accepted with other capitals and extra spaces.
- **Free count:**
  - 2, 1, then 0 rounds left.
  - A new day starts again at 2.
  - The day key comes from the local date.
- **`loadLicense`:**
  - missing: a new random secret is made and saved
  - damaged: a new license
  - valid: kept as is.
- **`useApp`:**
  - The third round on the same day is blocked as `'locked'`. The next day it is allowed.
  - An unlocked phone is never blocked and never counted.
  - The dev server is never blocked.
  - A damaged main save leaves the license untouched.
  - `unlock` handles a wrong word, the magic word and the owner password.
  - `makeKey` handles a known word and an unknown word.

### End-to-end (Playwright, against the production preview)

- **Existing specs stay unchanged:** `playwright.config.ts` gets a `storageState` that pre-saves an unlocked license for `http://localhost:4173`.
- **New `paywall.spec.ts`,** which opts out with an empty storage state:
  - Play 2 rounds; between rounds, "No free rounds left today" and **Unlock** appear.
  - About shows the secret word. A wrong word shows "That's not it".
  - The help link goes to `mailto:fennas.game@abisalloum.com` and its body holds the secret word.
  - The magic word, worked out in the test from the secret word using `license.ts`, unlocks the phone, and *Start round* works again.
  - On a fresh phone, the owner password unlocks it and shows Make a key, which gives the right magic word for a sample secret word.

### Before reporting done

`bun test`, `bun run lint`, `bun run build` and the e2e run, all inside the podman containers.
