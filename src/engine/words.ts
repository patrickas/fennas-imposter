import type { Category, Content, Lang, Secret, Word } from './types'
import { pickOne, type Rng } from './rng'

const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== ''

export function eligibleCategories(content: Content, lang: Lang): Category[] {
  const withWords = new Set(content.words.filter((w) => present(w.text[lang])).map((w) => w.categoryId))
  return content.categories.filter((c) => present(c.name[lang]) && withWords.has(c.id))
}

export function eligibleWords(content: Content, lang: Lang, categoryIds: readonly string[]): Word[] {
  const selected = new Set(categoryIds)
  const playable = new Set(
    content.categories.filter((c) => selected.has(c.id) && present(c.name[lang])).map((c) => c.id),
  )
  return content.words.filter((w) => playable.has(w.categoryId) && present(w.text[lang]))
}

/**
 * Picks an unused word. When every eligible word has been used, only this pool's ids are
 * dropped from the history (other languages/categories keep theirs) and picking starts over.
 */
export function pickWord(
  eligible: readonly Word[],
  used: readonly string[],
  rng: Rng,
): { word: Word; used: string[] } {
  if (eligible.length === 0) throw new Error('pickWord: no eligible words')
  const usedSet = new Set(used)
  let pool = eligible.filter((w) => !usedSet.has(w.id))
  let history = [...used]
  if (pool.length === 0) {
    const eligibleIds = new Set(eligible.map((w) => w.id))
    history = history.filter((id) => !eligibleIds.has(id))
    pool = [...eligible]
  }
  const word = pickOne(rng, pool)
  return { word, used: [...history, word.id] }
}

export function makeSecret(word: Word, category: Category, lang: Lang): Secret {
  const text = word.text[lang]
  const categoryName = category.name[lang]
  if (word.categoryId !== category.id) {
    throw new Error(`makeSecret: word ${word.id} is not in category ${category.id}`)
  }
  if (!present(text) || !present(categoryName)) {
    throw new Error(`makeSecret: ${word.id} is not playable in ${lang}`)
  }
  const hint = word.hint[lang]
  return {
    wordId: word.id,
    word: text.trim(),
    hint: present(hint) ? hint.trim() : null,
    categoryName: categoryName.trim(),
  }
}

export function imposterHint(secret: Secret): string {
  return secret.hint ?? secret.categoryName
}
