import {
  DIFFICULTIES, LANGS, SOURCE_KINDS, type Category, type Difficulty, type Lang, type Outcome, type Player, type RoundState,
  type Settings, type SourceKind, type Word,
} from '../engine/types'
import { SEED_CATEGORIES } from './seed'
import { TIMER } from './limits'

export const STORAGE_KEY = 'fennas-imposter'
export const CURRENT_VERSION = 6

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SessionScore {
  name: string
  points: number
}

/** One finished round, for the stats screen. `outcome` is null when the round was played without scoring. */
export interface RoundRecord {
  number: number
  word: string
  imposterIds: string[]
  starterId: string
  outcome: Outcome | null
}

export interface Session {
  scores: Record<string, SessionScore>
  rounds: number
  /** Who started the last finished round, so take-turns mode knows who is next. Absent before the first one. */
  lastStarterId?: string
  /** Finished rounds, oldest first. Absent in games saved before stats existed. */
  history?: RoundRecord[]
}

export interface Stored {
  version: 6
  language: Lang
  players: Player[]
  activePlayerIds: string[]
  settings: Settings
  selectedCategoryIds: string[]
  customCategories: Category[]
  customWords: Word[]
  usedWordIds: Record<Lang, string[]>
  lastImportUrl: string | null
  /** The player Game Master picked in Settings. Not a setting: player ids differ between devices, so backups leave it out. */
  gmPlayerId: string | null
  session: Session | null
  round: RoundState | null
  /** Dev-only: deal the fixed test word (see data/testWord.ts). Absent = on (dev server only); false = off. */
  testMode?: boolean
}

export type LoadStatus = 'ok' | 'fresh' | 'corrupt' | 'newer' | 'unavailable'

export interface LoadResult {
  stored: Stored
  status: LoadStatus
  canSave: boolean
}

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

/** Built-in categories that shipped with version 2. Players who saved before then never had the chance to select them. */
const ADDED_IN_V2 = ['body', 'fruit-veg', 'school', 'tech', 'music', 'occasions', 'world', 'fantasy', 'tools', 'levant-food']

/** migrations[n] upgrades a version-n document to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  1: (doc) => {
    const selected = doc.selectedCategoryIds
    if (!Array.isArray(selected)) return { ...doc, version: 2 } // isStored rejects it as damaged
    return { ...doc, version: 2, selectedCategoryIds: [...selected, ...ADDED_IN_V2.filter((id) => !selected.includes(id))] }
  },
  // Version 3 added "show the category on the cards"; off keeps saved games (and a round in progress) as they were.
  2: (doc) => {
    const next: Record<string, unknown> = { ...doc, version: 3 }
    if (isRecord(doc.settings)) next.settings = { ...doc.settings, showCategory: false }
    if (isRecord(doc.round) && isRecord(doc.round.settings)) {
      next.round = { ...doc.round, settings: { ...doc.round.settings, showCategory: false } }
    }
    return next // anything malformed is left for isStored to reject as damaged
  },
  // Version 4 added "take turns to start", on by default: a random starter felt like the same people every time.
  3: (doc) => {
    const next: Record<string, unknown> = { ...doc, version: 4 }
    if (isRecord(doc.settings)) next.settings = { ...doc.settings, rotateStarter: true }
    return next
  },
  // Version 5 made where the word comes from a setting; it used to be picked before every round.
  4: (doc) => {
    const next: Record<string, unknown> = { ...doc, version: 5, gmPlayerId: null }
    if (isRecord(doc.settings)) next.settings = { ...doc.settings, wordSource: 'random' }
    return next
  },
  // Version 6 added difficulty; easy deals exactly what was dealt before. Words without a level are easy
  // and a round without one shows no badge, so neither needs rewriting.
  5: (doc) => {
    const next: Record<string, unknown> = { ...doc, version: 6 }
    if (isRecord(doc.settings)) next.settings = { ...doc.settings, difficulty: 'easy' }
    return next
  },
}

export function defaultSettings(): Settings {
  return {
    imposterCount: 1,
    randomImposterCount: false,
    hints: true,
    showCategory: false,
    rotateStarter: true,
    wordSource: 'random',
    difficulty: 'easy',
    timer: { enabled: false, seconds: TIMER.default },
    scoring: false,
  }
}

export function defaultStored(): Stored {
  return {
    version: 6,
    language: 'en',
    players: [],
    activePlayerIds: [],
    settings: defaultSettings(),
    selectedCategoryIds: SEED_CATEGORIES.map((c) => c.id),
    customCategories: [],
    customWords: [],
    usedWordIds: { en: [], ar: [] },
    lastImportUrl: null,
    gmPlayerId: null,
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
    typeof x.showCategory === 'boolean' &&
    typeof x.rotateStarter === 'boolean' &&
    SOURCE_KINDS.includes(x.wordSource as SourceKind) &&
    DIFFICULTIES.includes(x.difficulty as Difficulty) &&
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
    (x.gmPlayerId === null || typeof x.gmPlayerId === 'string') &&
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

/**
 * The browser's localStorage if it can at least be read. A storage that refuses writes (quota full)
 * is still returned so saved data loads; the first failed save then flips the app to "can't save".
 */
export function browserStorage(get: () => Storage = () => window.localStorage): StorageLike | null {
  try {
    const s = get()
    s.getItem(STORAGE_KEY)
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
