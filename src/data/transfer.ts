import {
  LANGS, SOURCE_KINDS, type Category, type Localized, type Player, type Settings, type SourceKind, type Word,
} from '../engine/types'
import { SEED_CATEGORY_IDS, SEED_WORD_IDS } from './seed'
import { cleanLocalized, cleanText, normalizeText } from './normalize'
import { LIMITS, MAX_IMPOSTER_SETTING, OLDEST_TIMER_MIN, TIMER, textLength } from './limits'
import type { Stored } from './storage'

export const PACK_FORMAT = 'fennas-imposter'
export const PACK_VERSION = 1
export const MAX_PACK_BYTES = 1_000_000
const MAX_ERRORS = 10
const ID_RE = /^[A-Za-z0-9._:-]{1,64}$/

export type PackErrorCode =
  | 'badFormat' | 'wrongType' | 'missing' | 'invalidId' | 'empty' | 'tooLong' | 'unknownCategory' | 'duplicateId'
export interface PackError {
  path: string
  code: PackErrorCode
}
export interface PackCategory {
  id: string
  name: Localized
}
export interface PackWord {
  id: string
  categoryId: string
  text: Localized
  hint: Localized
}
export interface ValidPack {
  categories: PackCategory[]
  words: PackWord[]
  playerNames: string[] | null
  settings: Settings | null
}
export type ParseResult = { ok: true; pack: ValidPack } | { ok: false; errors: PackError[] }

type Fail = (path: string, code: PackErrorCode) => void

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function readId(value: unknown, path: string, seen: Set<string>, fail: Fail): string | null {
  let code: PackErrorCode | null = null
  if (value === undefined) code = 'missing'
  else if (typeof value !== 'string' || !ID_RE.test(value)) code = 'invalidId'
  else if (seen.has(value)) code = 'duplicateId'
  if (code) {
    fail(path, code)
    return null
  }
  seen.add(value as string)
  return value as string
}

function readLocalized(value: unknown, path: string, max: number, required: boolean, fail: Fail): Localized | null {
  if (value === undefined) {
    if (required) fail(path, 'missing')
    return required ? null : {}
  }
  if (!isRecord(value)) {
    fail(path, 'wrongType')
    return null
  }
  let ok = true
  for (const lang of LANGS) {
    const v = value[lang]
    if (v === undefined) continue
    if (typeof v !== 'string') {
      fail(`${path}.${lang}`, 'wrongType')
      ok = false
    } else if (textLength(cleanText(v)) > max) {
      fail(`${path}.${lang}`, 'tooLong')
      ok = false
    }
  }
  if (!ok) return null
  const clean = cleanLocalized(value as Localized)
  if (required && Object.keys(clean).length === 0) {
    fail(path, 'empty')
    return null
  }
  return clean
}

function readSettings(v: unknown, fail: Fail): Settings | null {
  const t = isRecord(v) ? v.timer : undefined
  const valid =
    isRecord(v) &&
    Number.isInteger(v.imposterCount) &&
    (v.imposterCount as number) >= 1 &&
    (v.imposterCount as number) <= MAX_IMPOSTER_SETTING &&
    typeof v.randomImposterCount === 'boolean' &&
    typeof v.hints === 'boolean' &&
    (v.showCategory === undefined || typeof v.showCategory === 'boolean') && // absent in backups from before the option
    (v.rotateStarter === undefined || typeof v.rotateStarter === 'boolean') && // likewise
    (v.wordSource === undefined || SOURCE_KINDS.includes(v.wordSource as SourceKind)) && // likewise
    typeof v.scoring === 'boolean' &&
    isRecord(t) &&
    typeof t.enabled === 'boolean' &&
    Number.isInteger(t.seconds) &&
    (t.seconds as number) >= OLDEST_TIMER_MIN &&
    (t.seconds as number) <= TIMER.max &&
    (t.seconds as number) % TIMER.step === 0
  if (!valid) {
    fail('settings', 'wrongType')
    return null
  }
  return {
    imposterCount: v.imposterCount as number,
    randomImposterCount: v.randomImposterCount as boolean,
    hints: v.hints as boolean,
    showCategory: v.showCategory === true,
    rotateStarter: v.rotateStarter !== false,
    wordSource: (v.wordSource as SourceKind | undefined) ?? 'random',
    scoring: v.scoring as boolean,
    timer: { enabled: t.enabled as boolean, seconds: Math.max(TIMER.min, t.seconds as number) },
  }
}

export function parsePack(json: unknown, knownCategoryIds: ReadonlySet<string>): ParseResult {
  if (!isRecord(json) || json.format !== PACK_FORMAT || json.version !== PACK_VERSION) {
    return { ok: false, errors: [{ path: '', code: 'badFormat' }] }
  }
  const errors: PackError[] = []
  const fail: Fail = (path, code) => {
    if (errors.length < MAX_ERRORS) errors.push({ path, code })
  }

  const categories: PackCategory[] = []
  const categoryIds = new Set<string>()
  const rawCategories = json.categories ?? []
  if (!Array.isArray(rawCategories)) fail('categories', 'wrongType')
  else {
    rawCategories.forEach((c: unknown, i) => {
      const path = `categories[${i}]`
      if (!isRecord(c)) return fail(path, 'wrongType')
      const id = readId(c.id, `${path}.id`, categoryIds, fail)
      const name = readLocalized(c.name, `${path}.name`, LIMITS.category, true, fail)
      if (id && name) categories.push({ id, name })
    })
  }

  const resolvable = new Set([...knownCategoryIds, ...categoryIds])
  const words: PackWord[] = []
  const wordIds = new Set<string>()
  const rawWords = json.words ?? []
  if (!Array.isArray(rawWords)) fail('words', 'wrongType')
  else {
    rawWords.forEach((w: unknown, i) => {
      const path = `words[${i}]`
      if (!isRecord(w)) return fail(path, 'wrongType')
      const id = readId(w.id, `${path}.id`, wordIds, fail)
      let categoryId: string | null = null
      if (typeof w.categoryId !== 'string') fail(`${path}.categoryId`, w.categoryId === undefined ? 'missing' : 'wrongType')
      else if (!resolvable.has(w.categoryId)) fail(`${path}.categoryId`, 'unknownCategory')
      else categoryId = w.categoryId
      const text = readLocalized(w.text, `${path}.text`, LIMITS.word, true, fail)
      const hint = readLocalized(w.hint, `${path}.hint`, LIMITS.hint, false, fail)
      if (id && categoryId && text && hint) words.push({ id, categoryId, text, hint })
    })
  }

  let playerNames: string[] | null = null
  if (json.players !== undefined) {
    if (!Array.isArray(json.players)) fail('players', 'wrongType')
    else {
      const names: string[] = []
      json.players.forEach((p: unknown, i) => {
        const path = `players[${i}].name`
        if (!isRecord(p) || typeof p.name !== 'string') return fail(path, 'wrongType')
        const name = cleanText(p.name)
        if (!name) return fail(path, 'empty')
        if (textLength(name) > LIMITS.player) return fail(path, 'tooLong')
        names.push(name)
      })
      playerNames = names
    }
  }

  const settings = json.settings === undefined ? null : readSettings(json.settings, fail)

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, pack: { categories, words, playerNames, settings } }
}

export type ImportMode = 'file' | 'url'

export interface ImportTarget {
  customCategories: Category[]
  customWords: Word[]
  players: Player[]
  settings: Settings
}

export interface ImportSummary {
  addCategories: number
  updateCategories: number
  addWords: number
  updateWords: number
  skippedBuiltIn: number
  addPlayers: number
  replacesSettings: boolean
}

export interface ImportPlan {
  summary: ImportSummary
  result: ImportTarget
}

export function planImport(pack: ValidPack, current: ImportTarget, mode: ImportMode, newId: () => string): ImportPlan {
  const summary: ImportSummary = {
    addCategories: 0, updateCategories: 0, addWords: 0, updateWords: 0, skippedBuiltIn: 0, addPlayers: 0, replacesSettings: false,
  }

  const categories = new Map(current.customCategories.map((c) => [c.id, c]))
  for (const c of pack.categories) {
    if (SEED_CATEGORY_IDS.has(c.id)) { summary.skippedBuiltIn++; continue }
    if (categories.has(c.id)) summary.updateCategories++
    else summary.addCategories++
    categories.set(c.id, { id: c.id, name: c.name, builtIn: false })
  }

  const words = new Map(current.customWords.map((w) => [w.id, w]))
  for (const w of pack.words) {
    if (SEED_WORD_IDS.has(w.id)) { summary.skippedBuiltIn++; continue }
    if (words.has(w.id)) summary.updateWords++
    else summary.addWords++
    words.set(w.id, { id: w.id, categoryId: w.categoryId, builtIn: false, text: w.text, hint: w.hint })
  }

  let players = current.players
  let settings = current.settings
  if (mode === 'file') {
    if (pack.playerNames) {
      const known = new Set(players.map((p) => normalizeText(p.name)))
      for (const name of pack.playerNames) {
        const key = normalizeText(name)
        if (known.has(key)) continue
        known.add(key)
        players = [...players, { id: newId(), name }]
        summary.addPlayers++
      }
    }
    if (pack.settings) {
      settings = pack.settings
      summary.replacesSettings = true
    }
  }

  return {
    summary,
    result: { customCategories: [...categories.values()], customWords: [...words.values()], players, settings },
  }
}

export function exportPack(data: Pick<Stored, 'players' | 'settings' | 'customCategories' | 'customWords'>): string {
  return JSON.stringify(
    {
      format: PACK_FORMAT,
      version: PACK_VERSION,
      categories: data.customCategories.map(({ id, name }) => ({ id, name })),
      words: data.customWords.map(({ id, categoryId, text, hint }) => ({ id, categoryId, text, hint })),
      players: data.players.map(({ id, name }) => ({ id, name })),
      settings: data.settings,
    },
    null,
    2,
  )
}

export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `fennas-imposter-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

export type FetchErrorCode =
  | 'invalidUrl' | 'httpsOnly' | 'offline' | 'network' | 'timeout' | 'httpStatus' | 'tooLarge' | 'invalidJson'
export type FetchResult = { ok: true; json: unknown } | { ok: false; error: FetchErrorCode; status?: number }

/** Just the part of fetch we use; runtime-specific extras (e.g. Bun's fetch.preconnect) stay out of our types. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface FetchDeps {
  fetch: FetchFn
  isOnline: () => boolean
  timeoutMs: number
}

function defaultFetchDeps(): FetchDeps {
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    isOnline: () => navigator.onLine,
    timeoutMs: 15_000,
  }
}

export function parseJsonText(text: string): FetchResult {
  if (new TextEncoder().encode(text).length > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'invalidJson' }
  }
}

export async function readPackFile(file: Blob): Promise<FetchResult> {
  if (file.size > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
  return parseJsonText(await file.text())
}

/** Reads the body but stops (and cancels the download) as soon as it passes MAX_PACK_BYTES. */
async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return res.text()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_PACK_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function fetchPackJson(url: string, deps: FetchDeps = defaultFetchDeps()): Promise<FetchResult> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return { ok: false, error: 'invalidUrl' }
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'httpsOnly' }
  if (!deps.isOnline()) return { ok: false, error: 'offline' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs)
  try {
    const res = await deps.fetch(parsed.href, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return { ok: false, error: 'httpStatus', status: res.status }
    if (Number(res.headers.get('content-length') ?? 0) > MAX_PACK_BYTES) return { ok: false, error: 'tooLarge' }
    const text = await readCapped(res)
    return text === null ? { ok: false, error: 'tooLarge' } : parseJsonText(text)
  } catch {
    if (controller.signal.aborted) return { ok: false, error: 'timeout' }
    return { ok: false, error: deps.isOnline() ? 'network' : 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
