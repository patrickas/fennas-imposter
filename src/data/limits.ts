export const LIMITS = { player: 20, word: 40, hint: 40, category: 30 } as const

/** Discussion timer: 1–10 minutes in 30 s steps (spec §3.1). */
export const TIMER = { min: 60, max: 600, step: 30, default: 180 } as const

/** Backups made before the 1-minute minimum may hold 30 s; they still import (raised to TIMER.min). */
export const OLDEST_TIMER_MIN = 30

/** Upper bound accepted from settings/imports; the real cap is maxImposters(participants). */
export const MAX_IMPOSTER_SETTING = 10

/** Length in code points, so an emoji counts as one character. */
export function textLength(s: string): number {
  return [...s].length
}
