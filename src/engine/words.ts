import type { Category, Content, Difficulty, Lang, Level, Secret, Word } from './types'
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

/**
 * The three kinds of random-word round (spec §4.2): an easy word with its hint, a hard word with its
 * hint, or an easy word whose imposter gets the subtle hint.
 */
export type RoundKind = 'easy' | 'hardWord' | 'subtle'

/** The words each kind of round can deal from the selected categories, in language `lang`. */
export function roundPools(content: Content, lang: Lang, categoryIds: readonly string[]): Record<RoundKind, Word[]> {
  const words = eligibleWords(content, lang, categoryIds)
  const easy = words.filter((w) => w.level !== 'hard')
  return {
    easy,
    hardWord: words.filter((w) => w.level === 'hard'),
    subtle: easy.filter((w) => present(w.subtle?.hint[lang])),
  }
}

/**
 * Settles the round's kind (spec §4.3). `available` says which pools have words. A hard round falls
 * back to easy rather than mislabel itself, and subtle rounds need the imposter hint switched on.
 */
export function chooseKind(
  difficulty: Difficulty,
  available: Record<RoundKind, boolean>,
  hints: boolean,
  rng: Rng,
): RoundKind {
  const level: Level = difficulty === 'random' ? pickOne(rng, ['easy', 'hard'] as const) : difficulty
  const hardKinds = (['hardWord', 'subtle'] as const).filter((k) => available[k] && (k === 'hardWord' || hints))
  if (level === 'easy' && available.easy) return 'easy'
  if (hardKinds.length > 0) return hardKinds.length === 1 ? hardKinds[0] : pickOne(rng, hardKinds)
  if (available.easy) return 'easy'
  throw new Error('chooseKind: no playable word')
}

/** `kind` is null for Game Master rounds, which have no level. */
export function makeSecret(word: Word, category: Category, lang: Lang, kind: RoundKind | null = null): Secret {
  const text = word.text[lang]
  const categoryName = category.name[lang]
  if (word.categoryId !== category.id) {
    throw new Error(`makeSecret: word ${word.id} is not in category ${category.id}`)
  }
  if (!present(text) || !present(categoryName)) {
    throw new Error(`makeSecret: ${word.id} is not playable in ${lang}`)
  }
  if (kind !== null && (kind === 'hardWord') !== (word.level === 'hard')) {
    throw new Error(`makeSecret: ${word.id} does not fit a "${kind}" round`)
  }
  const hint = word.hint[lang]
  const secret: Secret = {
    wordId: word.id,
    word: text.trim(),
    hint: present(hint) ? hint.trim() : null,
    categoryName: categoryName.trim(),
  }
  if (kind === null) return secret
  if (kind !== 'subtle') return { ...secret, level: kind === 'easy' ? 'easy' : 'hard' }
  const subtle = word.subtle?.hint[lang]
  if (!present(subtle)) throw new Error(`makeSecret: ${word.id} has no subtle hint in ${lang}`)
  const why = word.subtle?.why[lang]
  return { ...secret, level: 'hard', hint: subtle.trim(), ...(present(why) ? { hintWhy: why.trim() } : {}) }
}

export function imposterHint(secret: Secret): string {
  return secret.hint ?? secret.categoryName
}
