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
      .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '') // invisible direction/format marks
      .replace(/ی/g, 'ي') // Persian yeh
      .replace(/ک/g, 'ك') // Persian kaf
      .toLowerCase(),
  )
}
