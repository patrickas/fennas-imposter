export type Lang = 'en' | 'ar'
export const LANGS: readonly Lang[] = ['en', 'ar']

/** A text that may exist in English, Arabic, or both. */
export type Localized = Partial<Record<Lang, string>>

export interface Category {
  id: string
  name: Localized
  builtIn: boolean
}

export interface Word {
  id: string
  categoryId: string
  builtIn: boolean
  text: Localized
  hint: Localized
}

export interface Player {
  id: string
  name: string
}

export interface TimerSettings {
  enabled: boolean
  seconds: number
}

export interface Settings {
  imposterCount: number
  randomImposterCount: boolean
  hints: boolean
  /** Both reveal cards also show the category. */
  showCategory: boolean
  /** Players take turns to start, in list order; off picks the starter at random. */
  rotateStarter: boolean
  /** Where each round's word comes from. The player Game Master is stored apart (Stored.gmPlayerId). */
  wordSource: SourceKind
  timer: TimerSettings
  scoring: boolean
}

export interface Content {
  categories: Category[]
  words: Word[]
}

/** 'starting' announces who starts; the discussion (and its timer) begins on "Start playing". */
export type Phase = 'gmEntry' | 'reveal' | 'starting' | 'discussion' | 'vote' | 'guess' | 'result'

export type Source =
  | { kind: 'random' }
  | { kind: 'playerGm'; gmPlayerId: string }
  | { kind: 'outsideGm' }
export type SourceKind = Source['kind']
export const SOURCE_KINDS: readonly SourceKind[] = ['random', 'playerGm', 'outsideGm']

/** Snapshot of the round's word, so later edits/deletes never change a running round. */
export interface Secret {
  wordId: string
  word: string
  hint: string | null
  categoryName: string
}

export interface RoundSettings {
  hints: boolean
  showCategory: boolean
  scoring: boolean
  timer: TimerSettings
  imposterCountHidden: boolean
}

export type Outcome = 'crew' | 'imposters'

/** `null` until the vote happens; `playerId: null` means the group voted out nobody. */
export type VotedOut = { playerId: string | null } | null

export interface RoundState {
  number: number
  lang: Lang
  source: Source
  participantIds: string[]
  imposterIds: string[]
  startingPlayerId: string
  secret: Secret | null
  settings: RoundSettings
  phase: Phase
  revealIndex: number
  timerEndsAt: number | null
  votedOut: VotedOut
  imposterGuessed: boolean | null
  outcome: Outcome | null
}
