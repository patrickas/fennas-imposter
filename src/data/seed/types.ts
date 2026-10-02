import type { Localized } from '../../engine/types'

/** [slug, English word, Arabic word, English hint, Arabic hint] — null when a language is absent. */
export type SeedRow = readonly [slug: string, en: string | null, ar: string | null, hintEn: string | null, hintAr: string | null]

/** [slug of a row in the same pack, subtle hint EN, AR, explanation EN, AR] — null when a language is absent. */
export type SubtleRow = readonly [slug: string, hintEn: string | null, hintAr: string | null, whyEn: string | null, whyAr: string | null]

export interface SeedPack {
  id: string
  name: Localized
  rows: readonly SeedRow[]
  /** Hard words, in the same columns as rows. */
  hard: readonly SeedRow[]
  /** Subtle hints for easy words (rows), dealt in hard rounds. */
  subtle: readonly SubtleRow[]
}
