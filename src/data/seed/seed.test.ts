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
