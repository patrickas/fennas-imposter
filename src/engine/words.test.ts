import { describe, expect, it } from 'bun:test'
import type { Category, Content, Localized, Word } from './types'
import { seededRng } from './rng'
import { eligibleCategories, eligibleWords, imposterHint, makeSecret, pickWord } from './words'

const categories: Category[] = [
  { id: 'food', name: { en: 'Food', ar: 'أكل' }, builtIn: true },
  { id: 'levant', name: { ar: 'من عنّا' }, builtIn: true },
  { id: 'en-only', name: { en: 'English only' }, builtIn: false },
]
const w = (id: string, categoryId: string, text: Localized, hint: Localized = {}): Word => ({
  id, categoryId, builtIn: true, text, hint,
})
const words: Word[] = [
  w('food.falafel', 'food', { en: 'Falafel', ar: 'فلافل' }, { en: 'Fried', ar: 'مقلي' }),
  w('food.pizza', 'food', { en: 'Pizza', ar: 'بيتزا' }),
  w('food.bread', 'food', { en: '   ', ar: 'خبز' }),
  w('levant.kibbeh', 'levant', { ar: 'كبّة' }, { ar: 'برغل' }),
  w('en-only.bagel', 'en-only', { en: 'Bagel' }),
]
const content: Content = { categories, words }
const ids = (list: Word[]) => list.map((x) => x.id)

describe('eligibleWords', () => {
  it('never deals an Arabic-only word in an English round', () => {
    expect(ids(eligibleWords(content, 'en', ['food', 'levant']))).toEqual(['food.falafel', 'food.pizza'])
  })

  it('treats whitespace-only text as missing', () => {
    expect(ids(eligibleWords(content, 'en', ['food']))).not.toContain('food.bread')
    expect(ids(eligibleWords(content, 'ar', ['food']))).toContain('food.bread')
  })

  it('needs the category to have a name in the round language', () => {
    expect(eligibleWords(content, 'ar', ['en-only'])).toEqual([])
  })

  it('ignores categories that are not selected', () => {
    expect(ids(eligibleWords(content, 'en', ['food']))).not.toContain('en-only.bagel')
  })
})

describe('eligibleCategories', () => {
  it('lists only categories that can actually deal a word in that language', () => {
    expect(eligibleCategories(content, 'en').map((c) => c.id)).toEqual(['food', 'en-only'])
    expect(eligibleCategories(content, 'ar').map((c) => c.id)).toEqual(['food', 'levant'])
  })
})

describe('pickWord', () => {
  const pool = eligibleWords(content, 'ar', ['food'])

  it('does not repeat a word until the whole pool has been used', () => {
    let used: string[] = []
    const rng = seededRng(3)
    const picked: string[] = []
    for (let i = 0; i < pool.length; i++) {
      const r = pickWord(pool, used, rng)
      picked.push(r.word.id)
      used = r.used
    }
    expect(new Set(picked).size).toBe(pool.length)
  })

  it('starts over once the pool is exhausted, keeping history from other pools', () => {
    const used = ['other.word', ...ids(pool)]
    const r = pickWord(pool, used, seededRng(5))
    expect(r.used).toEqual(['other.word', r.word.id])
  })

  it('refuses an empty pool loudly', () => {
    expect(() => pickWord([], [], seededRng(1))).toThrow()
  })
})

describe('makeSecret / imposterHint', () => {
  const food = categories[0]

  it('snapshots the word, hint and category name in the round language', () => {
    expect(makeSecret(words[0], food, 'ar')).toEqual({
      wordId: 'food.falafel', word: 'فلافل', hint: 'مقلي', categoryName: 'أكل',
    })
  })

  it('falls back to the category name when the word has no hint', () => {
    const secret = makeSecret(words[1], food, 'en')
    expect(secret.hint).toBeNull()
    expect(imposterHint(secret)).toBe('Food')
  })

  it('refuses a word that is not playable in that language', () => {
    expect(() => makeSecret(words[3], categories[1], 'en')).toThrow()
  })

  it('refuses a word paired with the wrong category', () => {
    expect(() => makeSecret(words[0], categories[1], 'ar')).toThrow()
  })
})
