import { describe, expect, it } from 'bun:test'
import type { Category, Content, Localized, Word } from './types'
import { seededRng, type Rng } from './rng'
import {
  chooseKind, eligibleCategories, eligibleWords, imposterHint, makeSecret, pickWord, roundPools,
} from './words'

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

describe('roundPools', () => {
  const hard: Word = { ...w('food.saffron', 'food', { en: 'Saffron', ar: 'زعفران' }, { en: 'Gold' }), level: 'hard' }
  const subtleBoth: Word = {
    ...w('food.cake', 'food', { en: 'Cake', ar: 'كيكة' }, { en: 'Candles' }),
    subtle: { hint: { en: 'Lie', ar: 'كذبة' }, why: { en: 'The cake is a lie' } },
  }
  const subtleArOnly: Word = {
    ...w('food.rice', 'food', { en: 'Rice', ar: 'رز' }),
    subtle: { hint: { ar: 'عرس' }, why: {} },
  }
  const pools = (lang: 'en' | 'ar') =>
    roundPools({ categories, words: [...words, hard, subtleBoth, subtleArOnly] }, lang, ['food'])

  it('keeps hard words out of easy rounds and easy words out of hard-word rounds', () => {
    const en = pools('en')
    expect(ids(en.easy)).toEqual(['food.falafel', 'food.pizza', 'food.cake', 'food.rice'])
    expect(ids(en.hardWord)).toEqual(['food.saffron'])
  })

  it('offers a subtle-hint round only for words whose subtle hint exists in the round language', () => {
    expect(ids(pools('en').subtle)).toEqual(['food.cake'])
    expect(ids(pools('ar').subtle)).toEqual(['food.cake', 'food.rice'])
  })
})

/** Hands out the given coin values in order; 0.2 picks the first option of two, 0.7 the second. */
function coins(...values: number[]): Rng {
  return {
    next: () => {
      const v = values.shift()
      if (v === undefined) throw new Error('flipped one coin too many')
      return v
    },
  }
}
const all = { easy: true, hardWord: true, subtle: true }

describe('chooseKind', () => {
  it('deals easy rounds on Easy and hard ones on Hard, splitting Hard between its two kinds', () => {
    expect(chooseKind('easy', all, true, coins())).toBe('easy')
    expect(chooseKind('hard', all, true, coins(0.2))).toBe('hardWord')
    expect(chooseKind('hard', all, true, coins(0.7))).toBe('subtle')
  })

  it('flips for the level on Random, then for the kind of hard round', () => {
    expect(chooseKind('random', all, true, coins(0.2))).toBe('easy')
    expect(chooseKind('random', all, true, coins(0.7, 0.2))).toBe('hardWord')
    expect(chooseKind('random', all, true, coins(0.7, 0.7))).toBe('subtle')
  })

  it('uses the other kind of hard round when one has no words in the selected categories', () => {
    expect(chooseKind('hard', { ...all, hardWord: false }, true, coins())).toBe('subtle')
    expect(chooseKind('hard', { ...all, subtle: false }, true, coins())).toBe('hardWord')
  })

  it('never deals a subtle-hint round with hints off: the imposter would not see the hint, so it would not be hard', () => {
    expect(chooseKind('hard', all, false, coins())).toBe('hardWord')
  })

  it('falls back to easy when no hard round is possible, so the badge never claims a hard round', () => {
    expect(chooseKind('hard', { easy: true, hardWord: false, subtle: false }, true, coins())).toBe('easy')
    expect(chooseKind('hard', { easy: true, hardWord: false, subtle: true }, false, coins())).toBe('easy')
  })

  it('deals a hard word on Easy when the selected categories hold only hard words', () => {
    expect(chooseKind('easy', { easy: false, hardWord: true, subtle: false }, true, coins())).toBe('hardWord')
  })

  it('refuses loudly when there is no word at all (starting a round is blocked before this)', () => {
    expect(() => chooseKind('easy', { easy: false, hardWord: false, subtle: false }, true, coins())).toThrow()
  })
})

describe('makeSecret with a round kind', () => {
  const food = categories[0]
  const hard: Word = { ...w('food.saffron', 'food', { en: 'Saffron' }, { en: 'Gold' }), level: 'hard' }
  const cake: Word = {
    ...w('food.cake', 'food', { en: 'Cake', ar: 'كيكة' }, { en: 'Candles', ar: 'شمع' }),
    subtle: { hint: { en: 'Lie', ar: 'كذبة' }, why: { en: ' The cake is a lie ' } },
  }

  it('labels easy and hard-word rounds with their level, keeping the normal hint', () => {
    expect(makeSecret(cake, food, 'en', 'easy')).toMatchObject({ level: 'easy', hint: 'Candles' })
    expect(makeSecret(hard, food, 'en', 'hardWord')).toMatchObject({ level: 'hard', hint: 'Gold' })
    expect(makeSecret(cake, food, 'en', 'easy').hintWhy).toBeUndefined()
  })

  it('gives the imposter the subtle hint in a subtle round, with its explanation for the end', () => {
    const secret = makeSecret(cake, food, 'en', 'subtle')
    expect(secret).toMatchObject({ level: 'hard', word: 'Cake', hint: 'Lie', hintWhy: 'The cake is a lie' })
    expect(imposterHint(secret)).toBe('Lie')
  })

  it('still plays a subtle hint that has no explanation in the round language', () => {
    const secret = makeSecret(cake, food, 'ar', 'subtle')
    expect(secret.hint).toBe('كذبة')
    expect(secret.hintWhy).toBeUndefined()
  })

  it('leaves Game Master rounds without a level, so they show no badge', () => {
    expect(makeSecret(cake, food, 'en').level).toBeUndefined()
  })

  it('refuses a word that does not fit the kind of round', () => {
    expect(() => makeSecret(words[0], food, 'en', 'subtle')).toThrow()
    expect(() => makeSecret(cake, food, 'en', 'hardWord')).toThrow()
    expect(() => makeSecret(hard, food, 'en', 'easy')).toThrow()
  })
})
