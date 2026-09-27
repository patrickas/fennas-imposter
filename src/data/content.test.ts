import { describe, expect, it } from 'bun:test'
import {
  addGmWord, allContent, deleteCustomCategory, updateCustomWord, validateGmWord, type CustomContent, type GmWordInput,
} from './content'
import { SEED_CATEGORIES, SEED_WORDS } from './seed'

const none: CustomContent = { customCategories: [], customWords: [] }
let n = 0
const newId = () => `c${++n}`
const input = (over: Partial<GmWordInput>): GmWordInput => ({
  lang: 'ar', word: 'منسف', hint: '', category: { existingId: 'food' }, ...over,
})

describe('allContent', () => {
  it('combines the built-in packs with custom content', () => {
    const c = allContent({ customCategories: [{ id: 'x', name: { en: 'X' }, builtIn: false }], customWords: [] })
    expect(c.categories).toHaveLength(SEED_CATEGORIES.length + 1)
    expect(c.words).toHaveLength(SEED_WORDS.length)
  })
})

describe('addGmWord', () => {
  it('saves a GM word in the round language only', () => {
    const { word, custom } = addGmWord(none, input({ hint: 'لحمة' }), newId)
    expect(word).toMatchObject({ categoryId: 'food', builtIn: false, text: { ar: 'منسف' }, hint: { ar: 'لحمة' } })
    expect(custom.customWords).toEqual([word])
  })

  it('lets the GM file a word under a built-in category', () => {
    const { category } = addGmWord(none, input({}), newId)
    expect(category.id).toBe('food')
    expect(category.builtIn).toBe(true)
  })

  it('reuses an existing category when the typed name matches, even with a different hamza', () => {
    const { category, custom } = addGmWord(none, input({ category: { newName: 'اكل  وشرب' } }), newId)
    expect(category.id).toBe('food')
    expect(custom.customCategories).toEqual([])
  })

  it('creates a new category with a name in the round language only', () => {
    const { category, custom } = addGmWord(none, input({ category: { newName: 'أكل أردني' } }), newId)
    expect(category).toMatchObject({ builtIn: false, name: { ar: 'أكل أردني' } })
    expect(custom.customCategories).toEqual([category])
  })

  it('reuses an existing word instead of saving a duplicate', () => {
    const { word, custom } = addGmWord(none, input({ word: 'فلافل' }), newId)
    expect(word.id).toBe('food.falafel')
    expect(custom.customWords).toEqual([])
  })

  it('fills in a missing hint on an existing custom word', () => {
    const first = addGmWord(none, input({}), newId)
    const second = addGmWord(first.custom, input({ hint: 'رز' }), newId)
    expect(second.word.id).toBe(first.word.id)
    expect(second.custom.customWords).toHaveLength(1)
    expect(second.word.hint).toEqual({ ar: 'رز' })
  })
})

describe('validateGmWord', () => {
  const content = allContent(none)

  it('reports every problem per field so the GM form can show them all at once', () => {
    expect(validateGmWord(input({ word: '  ', hint: 'x'.repeat(41), category: { newName: ' ' } }), content)).toEqual([
      { field: 'word', code: 'empty' },
      { field: 'hint', code: 'tooLong' },
      { field: 'category', code: 'empty' },
    ])
  })

  it('rejects a category that has no name in the round language', () => {
    expect(validateGmWord(input({ lang: 'en', word: 'Mansaf', category: { existingId: 'levant' } }), content))
      .toEqual([{ field: 'category', code: 'unknown' }])
  })

  it('refuses to save invalid input even if the UI forgot to validate', () => {
    expect(() => addGmWord(none, input({ word: '' }), newId)).toThrow()
  })
})

describe('editing and deleting custom content', () => {
  const base = addGmWord(none, input({ category: { newName: 'أكل أردني' } }), newId)

  it('saves cleaned text in both languages', () => {
    const out = updateCustomWord(base.custom, base.word.id, { en: ' Mansaf ', ar: 'منسف' }, { en: '', ar: 'لبن' })
    expect(out.customWords[0]).toMatchObject({ text: { en: 'Mansaf', ar: 'منسف' }, hint: { ar: 'لبن' } })
  })

  it('refuses to leave a word with no text at all', () => {
    expect(() => updateCustomWord(base.custom, base.word.id, { en: '', ar: ' ' }, {})).toThrow()
  })

  it('never edits built-in words', () => {
    expect(() => updateCustomWord(base.custom, 'food.falafel', { en: 'X' }, {})).toThrow()
  })

  it('deleting a category deletes its words too', () => {
    const out = deleteCustomCategory(base.custom, base.category.id)
    expect(out).toEqual({ customCategories: [], customWords: [] })
  })
})
