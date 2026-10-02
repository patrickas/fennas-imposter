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
 * The first 256 English built-in easy words, in shipping order. Hard words are left out: they are rarer and
 * harder to spell, and adding more of them must not change the keys. Derived, not frozen: keys only match
 * between phones running the same version of the packs.
 */
export const KEY_WORDS: readonly string[] = SEED_WORDS.flatMap((w) => (w.text.en && w.level !== 'hard' ? [w.text.en] : []))
  .slice(0, KEY_COUNT)

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
