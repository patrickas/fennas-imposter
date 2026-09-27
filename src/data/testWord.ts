import type { Lang, Secret } from '../engine/types'

/**
 * The fixed word dealt by dev-only test mode, so the UI can be tried over and over without
 * working through (or using up) the real word packs. Never dealt outside the dev server.
 */
export const TEST_SECRETS: Record<Lang, Secret> = {
  en: { wordId: 'test.secret-word', word: 'Secret word', hint: 'Secret hint', categoryName: 'Category' },
  ar: { wordId: 'test.secret-word', word: 'كلمة سرّية', hint: 'تلميح سرّي', categoryName: 'فئة' },
}
