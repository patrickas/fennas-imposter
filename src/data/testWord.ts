import type { Lang, Secret } from '../engine/types'
import type { RoundKind } from '../engine/words'

/**
 * The fixed word dealt by dev-only test mode, so the UI can be tried over and over without
 * working through (or using up) the real word packs. Never dealt outside the dev server.
 */
export const TEST_SECRETS: Record<Lang, Secret> = {
  en: { wordId: 'test.secret-word', word: 'Secret word', hint: 'Secret hint', categoryName: 'Category' },
  ar: { wordId: 'test.secret-word', word: 'كلمة سرّية', hint: 'تلميح سرّي', categoryName: 'فئة' },
}

const TEST_SUBTLE: Record<Lang, { hint: string; why: string }> = {
  en: { hint: 'Secret subtle hint', why: 'Secret explanation' },
  ar: { hint: 'تلميح سرّي خفي', why: 'شرح سرّي' },
}

/** The test word for each kind of round, so the level badge and the subtle hint's explanation can be tried too. */
export function testSecret(lang: Lang, kind: RoundKind): Secret {
  const secret = TEST_SECRETS[lang]
  if (kind === 'subtle') return { ...secret, level: 'hard', hint: TEST_SUBTLE[lang].hint, hintWhy: TEST_SUBTLE[lang].why }
  return { ...secret, level: kind === 'easy' ? 'easy' : 'hard' }
}
