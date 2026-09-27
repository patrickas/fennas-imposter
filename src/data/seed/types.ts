import type { Localized } from '../../engine/types'

/** [slug, English word, Arabic word, English hint, Arabic hint] — null when a language is absent. */
export type SeedRow = readonly [slug: string, en: string | null, ar: string | null, hintEn: string | null, hintAr: string | null]

export interface SeedPack {
  id: string
  name: Localized
  rows: readonly SeedRow[]
}
