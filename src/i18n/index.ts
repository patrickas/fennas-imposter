import type { Lang } from '../engine/types'
import { en, type Messages } from './en'
import { ar } from './ar'

export type MessageKey = keyof Messages
export type Params = Record<string, string | number>

const dictionaries: Record<Lang, Messages> = { en, ar }
const LOCALES: Record<Lang, string> = { en: 'en', ar: 'ar-u-nu-latn' }
const FSI = '⁨'
const PDI = '⁩'

const pluralRules = new Map<Lang, Intl.PluralRules>()
const numberFormats = new Map<Lang, Intl.NumberFormat>()

function rulesFor(lang: Lang): Intl.PluralRules {
  let rules = pluralRules.get(lang)
  if (!rules) {
    rules = new Intl.PluralRules(LOCALES[lang])
    pluralRules.set(lang, rules)
  }
  return rules
}

export function formatNumber(n: number, lang: Lang): string {
  let format = numberFormats.get(lang)
  if (!format) {
    format = new Intl.NumberFormat(LOCALES[lang])
    numberFormats.set(lang, format)
  }
  return format.format(n)
}

/** Plain-text equivalent of <bdi>: keeps mixed-direction text from scrambling a sentence. */
export function isolate(text: string): string {
  return FSI + text + PDI
}

export function dirFor(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatList(items: readonly string[], lang: Lang): string {
  return new Intl.ListFormat(LOCALES[lang], { style: 'long', type: 'conjunction' }).format(items.map(isolate))
}

export function translate(lang: Lang, key: MessageKey, params: Params = {}): string {
  const message = dictionaries[lang][key]
  let template: string
  if (typeof message === 'string') {
    template = message
  } else {
    const count = params.count
    if (typeof count !== 'number') throw new Error(`i18n: "${key}" needs a numeric "count"`)
    template = message[rulesFor(lang).select(count)] ?? message.other
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`i18n: "${key}" is missing "{${name}}"`)
    return typeof value === 'number' ? formatNumber(value, lang) : isolate(value)
  })
}
