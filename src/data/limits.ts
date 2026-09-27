export const LIMITS = { player: 20, word: 40, hint: 40, category: 30 } as const

export const TIMER = { min: 30, max: 600, step: 30, default: 180 } as const

/** Upper bound accepted from settings/imports; the real cap is maxImposters(participants). */
export const MAX_IMPOSTER_SETTING = 10

/** Length in code points, so an emoji counts as one character. */
export function textLength(s: string): number {
  return [...s].length
}
