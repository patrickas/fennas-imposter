import { describe, expect, it } from 'bun:test'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { textLength } from './limits'

describe('normalizeText (used for matching only, never shown)', () => {
  it('ignores case and extra whitespace', () => {
    expect(normalizeText('  Falafel   Wrap ')).toBe(normalizeText('falafel wrap'))
  })

  it('ignores tashkeel so vowelled and plain spellings match', () => {
    expect(normalizeText('كِتَابٌ')).toBe(normalizeText('كتاب'))
  })

  it('ignores tatweel stretching', () => {
    expect(normalizeText('مـــرحبا')).toBe('مرحبا')
  })

  it('treats أ إ آ as ا because people type them interchangeably', () => {
    expect(normalizeText('أحمد')).toBe('احمد')
    expect(normalizeText('إبريق')).toBe('ابريق')
    expect(normalizeText('آخر')).toBe('اخر')
  })

  it('treats ة as ه and ى as ي, as casual Levantine spelling does', () => {
    expect(normalizeText('مدرسة')).toBe(normalizeText('مدرسه'))
    expect(normalizeText('مستشفى')).toBe(normalizeText('مستشفي'))
  })

  it('folds Arabic presentation forms (copied from PDFs) to normal letters', () => {
    expect(normalizeText('ﻻ')).toBe('لا')
  })
})

describe('cleanText / cleanLocalized (what we store and display)', () => {
  it('keeps the original spelling but trims and collapses spaces', () => {
    expect(cleanText('  أحمد   علي ')).toBe('أحمد علي')
  })

  it('drops languages that are empty after cleaning', () => {
    expect(cleanLocalized({ en: '   ', ar: ' كبّة ' })).toEqual({ ar: 'كبّة' })
  })
})

describe('textLength', () => {
  it('counts an emoji as one character, like a person would', () => {
    expect(textLength('Rami 😎')).toBe(6)
  })
})
