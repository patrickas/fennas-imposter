import { describe, expect, it } from 'bun:test'
import { en } from './en'
import { ar } from './ar'
import { dirFor, formatClock, formatList, formatNumber, translate } from './index'

describe('dictionaries', () => {
  it('Arabic has exactly the same keys as English, so no screen falls back to a raw key', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
  })

  it('every plural message has an "other" form to fall back on', () => {
    for (const dict of [en, ar]) {
      for (const value of Object.values(dict)) {
        if (typeof value !== 'string') expect(typeof value.other).toBe('string')
      }
    }
  })
})

describe('translate', () => {
  it('picks the grammatically correct Arabic plural (zero, one, two, few, many, other)', () => {
    expect(translate('ar', 'setup.wordCount', { count: 0 })).toBe('ما في كلمات')
    expect(translate('ar', 'setup.wordCount', { count: 1 })).toBe('كلمة وحدة')
    expect(translate('ar', 'setup.wordCount', { count: 2 })).toBe('كلمتين')
    expect(translate('ar', 'setup.wordCount', { count: 3 })).toBe('3 كلمات')
    expect(translate('ar', 'setup.wordCount', { count: 11 })).toBe('11 كلمة')
    expect(translate('ar', 'setup.wordCount', { count: 100 })).toBe('100 كلمة')
  })

  it('uses English one/other plurals', () => {
    expect(translate('en', 'setup.wordCount', { count: 1 })).toBe('1 word')
    expect(translate('en', 'setup.wordCount', { count: 25 })).toBe('25 words')
  })

  it('isolates interpolated names so a Latin name cannot scramble an Arabic sentence', () => {
    expect(translate('ar', 'reveal.show', { name: 'Rami' })).toBe('أنا ⁨Rami⁩ — فرجيني')
    expect(translate('en', 'reveal.show', { name: 'رامي' })).toBe("I'm ⁨رامي⁩ — show me")
  })

  it('writes numbers with Western digits in Arabic', () => {
    expect(translate('ar', 'play.round', { n: 3 })).toBe('الجولة 3')
    expect(formatNumber(12, 'ar')).toBe('12')
  })

  it('throws on a missing parameter instead of showing "{name}" to players', () => {
    expect(() => translate('en', 'reveal.show')).toThrow(/name/)
  })

  it('throws when a plural message gets no numeric count', () => {
    expect(() => translate('en', 'setup.wordCount')).toThrow(/count/)
  })
})

describe('formatting helpers', () => {
  it('dirFor gives rtl only for Arabic', () => {
    expect(dirFor('ar')).toBe('rtl')
    expect(dirFor('en')).toBe('ltr')
  })

  it('formatClock shows minutes and zero-padded seconds', () => {
    expect(formatClock(185)).toBe('3:05')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-4)).toBe('0:00')
  })

  it('formatList joins names the way each language does', () => {
    expect(formatList(['A', 'B', 'C'], 'en')).toBe('⁨A⁩, ⁨B⁩, and ⁨C⁩')
    expect(formatList(['A', 'B'], 'ar')).toContain('و')
  })
})
