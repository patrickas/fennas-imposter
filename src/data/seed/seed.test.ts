import { describe, expect, it } from 'bun:test'
import { LANGS } from '../../engine/types'
import { LIMITS, textLength } from '../limits'
import { normalizeText } from '../normalize'
import { SEED_CATEGORIES, SEED_PACKS, SEED_WORDS } from './index'

const ARABIC_ONLY = ['levant', 'levant-food']

describe('seed packs', () => {
  it('have unique, slug-style ids (the used-word history is keyed by them)', () => {
    const ids = SEED_WORDS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/)
    expect(new Set(SEED_CATEGORIES.map((c) => c.id)).size).toBe(SEED_CATEGORIES.length)
  })

  it('offer enough words per category that a group plays many rounds before words come back', () => {
    expect(SEED_PACKS).toHaveLength(20)
    for (const pack of SEED_PACKS) expect(pack.rows.length, pack.id).toBeGreaterThanOrEqual(50)
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

  it('include Arabic-only categories of Levantine culture and food words', () => {
    for (const id of ARABIC_ONLY) {
      const pack = SEED_PACKS.find((p) => p.id === id)!
      expect(pack.name.en, id).toBeUndefined()
      for (const [slug, en, ar] of pack.rows) {
        expect(en, `${id}.${slug}`).toBeNull()
        expect(ar, `${id}.${slug}`).toBeTruthy()
      }
    }
  })

  it('are otherwise fully bilingual, so English games get eighteen categories', () => {
    const bilingual = SEED_PACKS.filter((p) => !ARABIC_ONLY.includes(p.id))
    expect(bilingual).toHaveLength(18)
    for (const pack of bilingual) {
      expect(pack.name.en && pack.name.ar).toBeTruthy()
      for (const [slug, en, ar] of pack.rows) {
        expect(en, `${pack.id}.${slug} en`).toBeTruthy()
        expect(ar, `${pack.id}.${slug} ar`).toBeTruthy()
      }
    }
  })

  it('never repeat a word, even across categories (it would come up twice as often and look like a mistake)', () => {
    for (const lang of LANGS) {
      const seen = new Map<string, string>()
      for (const word of SEED_WORDS.filter((w) => w.text[lang])) {
        const key = normalizeText(word.text[lang]!)
        expect(seen.get(key), `${word.id} repeats ${lang} "${word.text[lang]}"`).toBeUndefined()
        seen.set(key, word.id)
      }
    }
  })

  it('never give the word away in its own hint, since the imposter sees the hint', () => {
    for (const word of SEED_WORDS) {
      for (const lang of LANGS) {
        if (!word.text[lang]) continue
        expect(normalizeText(word.hint[lang]!).includes(normalizeText(word.text[lang]!)), `${word.id} hint.${lang}`).toBe(false)
      }
    }
  })
})
