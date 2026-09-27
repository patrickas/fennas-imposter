import { LANGS, type Category, type Lang, type Player, type RoundState, type Settings, type Word } from '../engine/types'
import { SEED_CATEGORIES } from './seed'
import { TIMER } from './limits'

export const STORAGE_KEY = 'fennas-imposter'
export const CURRENT_VERSION = 1

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SessionScore {
  name: string
  points: number
}

export interface Session {
  scores: Record<string, SessionScore>
  rounds: number
}

export interface Stored {
  version: 1
  language: Lang
  players: Player[]
  activePlayerIds: string[]
  settings: Settings
  selectedCategoryIds: string[]
  customCategories: Category[]
  customWords: Word[]
  usedWordIds: Record<Lang, string[]>
  lastImportUrl: string | null
  session: Session | null
  round: RoundState | null
  /** Dev-only: deal the fixed test word (see data/testWord.ts). Absent in older documents. */
  testMode?: boolean
}

export type LoadStatus = 'ok' | 'fresh' | 'corrupt' | 'newer' | 'unavailable'

export interface LoadResult {
  stored: Stored
  status: LoadStatus
  canSave: boolean
}

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] upgrades a version-n document to version n+1. Empty until version 2 exists. */
export const MIGRATIONS: Record<number, Migration> = {}

export function defaultSettings(): Settings {
  return {
    imposterCount: 1,
    randomImposterCount: false,
    hints: true,
    timer: { enabled: false, seconds: TIMER.default },
    scoring: false,
  }
}

export function defaultStored(): Stored {
  return {
    version: 1,
    language: 'en',
    players: [],
    activePlayerIds: [],
    settings: defaultSettings(),
    selectedCategoryIds: SEED_CATEGORIES.map((c) => c.id),
    customCategories: [],
    customWords: [],
    usedWordIds: { en: [], ar: [] },
    lastImportUrl: null,
    session: null,
    round: null,
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function upgrade(
  doc: Record<string, unknown>,
  migrations: Record<number, Migration>,
  target: number,
): Record<string, unknown> {
  let current = doc
  while (typeof current.version === 'number' && current.version < target) {
    const step = migrations[current.version]
    if (!step) throw new Error(`No migration from version ${current.version}`)
    current = step(current)
  }
  return current
}

function isSettings(x: unknown): x is Settings {
  return (
    isRecord(x) &&
    typeof x.imposterCount === 'number' &&
    typeof x.randomImposterCount === 'boolean' &&
    typeof x.hints === 'boolean' &&
    typeof x.scoring === 'boolean' &&
    isRecord(x.timer) &&
    typeof x.timer.enabled === 'boolean' &&
    typeof x.timer.seconds === 'number'
  )
}

/** Structural check of our own document. Deep round contents are trusted (we wrote them). */
export function isStored(x: unknown): x is Stored {
  return (
    isRecord(x) &&
    x.version === CURRENT_VERSION &&
    LANGS.includes(x.language as Lang) &&
    Array.isArray(x.players) &&
    Array.isArray(x.activePlayerIds) &&
    isSettings(x.settings) &&
    Array.isArray(x.selectedCategoryIds) &&
    Array.isArray(x.customCategories) &&
    Array.isArray(x.customWords) &&
    isRecord(x.usedWordIds) &&
    LANGS.every((l) => Array.isArray((x.usedWordIds as Record<string, unknown>)[l])) &&
    (x.lastImportUrl === null || typeof x.lastImportUrl === 'string') &&
    (x.session === null || isRecord(x.session)) &&
    (x.round === null || isRecord(x.round))
  )
}

function corrupt(storage: StorageLike, raw: string, now: number): LoadResult {
  try {
    storage.setItem(`${STORAGE_KEY}:corrupt:${now}`, raw)
  } catch {
    // Backup is best-effort; the notice still tells the user something was reset.
  }
  return { stored: defaultStored(), status: 'corrupt', canSave: true }
}

export function loadStored(storage: StorageLike | null, now: number): LoadResult {
  const unavailable: LoadResult = { stored: defaultStored(), status: 'unavailable', canSave: false }
  if (!storage) return unavailable
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return unavailable
  }
  if (raw === null) return { stored: defaultStored(), status: 'fresh', canSave: true }

  let doc: unknown
  try {
    doc = JSON.parse(raw)
  } catch {
    return corrupt(storage, raw, now)
  }
  if (!isRecord(doc) || typeof doc.version !== 'number') return corrupt(storage, raw, now)
  if (doc.version > CURRENT_VERSION) return { stored: defaultStored(), status: 'newer', canSave: false }
  try {
    doc = upgrade(doc, MIGRATIONS, CURRENT_VERSION)
  } catch {
    return corrupt(storage, raw, now)
  }
  if (!isStored(doc)) return corrupt(storage, raw, now)
  return { stored: doc, status: 'ok', canSave: true }
}

export function saveStored(storage: StorageLike | null, stored: Stored): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage
    const probe = `${STORAGE_KEY}:probe`
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function memoryStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    dump: () => Object.fromEntries(data),
  }
}
