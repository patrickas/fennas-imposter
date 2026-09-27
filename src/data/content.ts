import { LANGS, type Category, type Content, type Lang, type Localized, type Word } from '../engine/types'
import { SEED_CATEGORIES, SEED_WORDS } from './seed'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { LIMITS, textLength } from './limits'

export interface CustomContent {
  customCategories: Category[]
  customWords: Word[]
}

export function allContent(custom: CustomContent): Content {
  return {
    categories: [...SEED_CATEGORIES, ...custom.customCategories],
    words: [...SEED_WORDS, ...custom.customWords],
  }
}

export function categoriesNamedIn(content: Content, lang: Lang): Category[] {
  return content.categories.filter((c) => cleanText(c.name[lang] ?? '') !== '')
}

export type GmField = 'word' | 'hint' | 'category'
export interface GmWordError {
  field: GmField
  code: 'empty' | 'tooLong' | 'unknown'
}
export type GmCategoryChoice = { existingId: string } | { newName: string }
export interface GmWordInput {
  lang: Lang
  word: string
  hint: string
  category: GmCategoryChoice
}

export function validateGmWord(input: GmWordInput, content: Content): GmWordError[] {
  const errors: GmWordError[] = []
  const word = cleanText(input.word)
  if (!word) errors.push({ field: 'word', code: 'empty' })
  else if (textLength(word) > LIMITS.word) errors.push({ field: 'word', code: 'tooLong' })

  if (textLength(cleanText(input.hint)) > LIMITS.hint) errors.push({ field: 'hint', code: 'tooLong' })

  const choice = input.category
  if ('existingId' in choice) {
    if (choice.existingId === '') {
      errors.push({ field: 'category', code: 'empty' }) // nothing chosen yet
    } else if (!categoriesNamedIn(content, input.lang).some((c) => c.id === choice.existingId)) {
      errors.push({ field: 'category', code: 'unknown' })
    }
  } else {
    const name = cleanText(choice.newName)
    if (!name) errors.push({ field: 'category', code: 'empty' })
    else if (textLength(name) > LIMITS.category) errors.push({ field: 'category', code: 'tooLong' })
  }
  return errors
}

/** Saves (or reuses) the GM's word. Dedupe uses normalized text (spec §5.3). */
export function addGmWord(
  custom: CustomContent,
  input: GmWordInput,
  newId: () => string,
): { custom: CustomContent; word: Word; category: Category } {
  const content = allContent(custom)
  if (validateGmWord(input, content).length > 0) throw new Error('addGmWord: invalid input')
  const { lang } = input
  let customCategories = custom.customCategories
  let customWords = custom.customWords

  const choice = input.category
  let found: Category | undefined
  if ('existingId' in choice) {
    found = content.categories.find((c) => c.id === choice.existingId)
  } else {
    const name = cleanText(choice.newName)
    const key = normalizeText(name)
    found = categoriesNamedIn(content, lang).find((c) => normalizeText(c.name[lang] ?? '') === key)
    if (!found) {
      found = { id: newId(), name: { [lang]: name }, builtIn: false }
      customCategories = [...customCategories, found]
    }
  }
  if (!found) throw new Error('addGmWord: unknown category')
  const category = found

  const text = cleanText(input.word)
  const hint = cleanText(input.hint)
  const key = normalizeText(text)
  const existing = content.words.find(
    (w) => w.categoryId === category.id && normalizeText(w.text[lang] ?? '') === key,
  )

  let word: Word
  if (existing) {
    word = existing
    if (!existing.builtIn && hint && !existing.hint[lang]) {
      const updated: Word = { ...existing, hint: { ...existing.hint, [lang]: hint } }
      customWords = customWords.map((w) => (w.id === updated.id ? updated : w))
      word = updated
    }
  } else {
    word = { id: newId(), categoryId: category.id, builtIn: false, text: { [lang]: text }, hint: hint ? { [lang]: hint } : {} }
    customWords = [...customWords, word]
  }
  return { custom: { customCategories, customWords }, word, category }
}

export interface LocalizedError {
  field: 'text' | 'hint' | 'name'
  lang: Lang | null
  code: 'tooLong' | 'needOneLanguage'
}

function checkLocalized(value: Localized, field: LocalizedError['field'], max: number, required: boolean): LocalizedError[] {
  const errors: LocalizedError[] = []
  for (const lang of LANGS) {
    if (textLength(cleanText(value[lang] ?? '')) > max) errors.push({ field, lang, code: 'tooLong' })
  }
  if (required && Object.keys(cleanLocalized(value)).length === 0) {
    errors.push({ field, lang: null, code: 'needOneLanguage' })
  }
  return errors
}

export function validateWordEdit(text: Localized, hint: Localized): LocalizedError[] {
  return [...checkLocalized(text, 'text', LIMITS.word, true), ...checkLocalized(hint, 'hint', LIMITS.hint, false)]
}

export function validateCategoryEdit(name: Localized): LocalizedError[] {
  return checkLocalized(name, 'name', LIMITS.category, true)
}

export function updateCustomWord(custom: CustomContent, id: string, text: Localized, hint: Localized): CustomContent {
  if (!custom.customWords.some((w) => w.id === id)) throw new Error(`No custom word ${id}`)
  if (validateWordEdit(text, hint).length > 0) throw new Error('updateCustomWord: invalid edit')
  return {
    ...custom,
    customWords: custom.customWords.map((w) =>
      w.id === id ? { ...w, text: cleanLocalized(text), hint: cleanLocalized(hint) } : w,
    ),
  }
}

export function updateCustomCategory(custom: CustomContent, id: string, name: Localized): CustomContent {
  if (!custom.customCategories.some((c) => c.id === id)) throw new Error(`No custom category ${id}`)
  if (validateCategoryEdit(name).length > 0) throw new Error('updateCustomCategory: invalid edit')
  return {
    ...custom,
    customCategories: custom.customCategories.map((c) => (c.id === id ? { ...c, name: cleanLocalized(name) } : c)),
  }
}

export function deleteCustomWord(custom: CustomContent, id: string): CustomContent {
  return { ...custom, customWords: custom.customWords.filter((w) => w.id !== id) }
}

export function deleteCustomCategory(custom: CustomContent, id: string): CustomContent {
  return {
    customCategories: custom.customCategories.filter((c) => c.id !== id),
    customWords: custom.customWords.filter((w) => w.categoryId !== id),
  }
}
