import { computed, reactive } from 'vue'
import type { Lang, Localized, Secret, Settings, Source } from '../engine/types'
import { cryptoRng, newId, type Rng } from '../engine/rng'
import { eligibleWords, makeSecret, pickWord } from '../engine/words'
import { MIN_PARTICIPANTS, maxImposters } from '../engine/assign'
import { participantsFor, reduce, startRound, type RoundAction } from '../engine/round'
import { scoreDeltas } from '../engine/scoring'
import { browserStorage, loadStored, saveStored, type LoadStatus, type StorageLike } from '../data/storage'
import * as roster from '../data/roster'
import * as custom from '../data/content'
import { parsePack, planImport, type ImportMode, type ImportPlan, type PackError } from '../data/transfer'
import { translate, type MessageKey, type Params } from '../i18n'
import { TEST_SECRETS } from '../data/testWord'
import { cleanText } from '../data/normalize'

export interface AppDeps {
  storage: StorageLike | null
  rng: Rng
  now: () => number
  newId: () => string
  /** True only on the dev server: enables test mode. */
  devTools?: boolean
}

export type RoundBlocker = 'needPlayers' | 'noWords' | 'noGm'
export type RosterError = roster.NameError | 'inRound'
export type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; errors: PackError[] }

export function createAppStore(deps: AppDeps) {
  const loaded = loadStored(deps.storage, deps.now())
  const state = reactive(loaded.stored)
  const meta = reactive<{ status: LoadStatus; canSave: boolean; noticeDismissed: boolean }>({
    status: loaded.status,
    canSave: loaded.canSave,
    noticeDismissed: false,
  })

  function persist(): void {
    if (!meta.canSave) return
    if (!saveStored(deps.storage, state)) {
      meta.canSave = false
      meta.status = 'unavailable'
      meta.noticeDismissed = false
    }
  }

  const content = computed(() => custom.allContent(state))
  const devTools = deps.devTools ?? false
  // On the dev server test mode is on unless explicitly switched off; production never honours it.
  const testModeActive = computed(() => devTools && state.testMode !== false)

  function t(key: MessageKey, params?: Params): string {
    return translate(state.language, key, params)
  }

  function playerName(id: string): string {
    return state.players.find((p) => p.id === id)?.name ?? state.session?.scores[id]?.name ?? '?'
  }

  function activeIds(): string[] {
    const active = new Set(state.activePlayerIds)
    return state.players.filter((p) => active.has(p.id)).map((p) => p.id)
  }

  function applyRoster(r: roster.Roster): void {
    state.players = r.players
    state.activePlayerIds = r.activePlayerIds
  }

  function applyCustom(c: custom.CustomContent): void {
    const before = new Set(state.customCategories.map((x) => x.id))
    state.customCategories = c.customCategories
    state.customWords = c.customWords
    const added = c.customCategories.map((x) => x.id).filter((id) => !before.has(id))
    const selected = new Set(state.selectedCategoryIds)
    state.selectedCategoryIds = [...state.selectedCategoryIds, ...added.filter((id) => !selected.has(id))]
  }

  function setLanguage(lang: Lang): void {
    if (state.round) throw new Error('The language is locked during a round')
    state.language = lang
    persist()
  }

  function addPlayer(name: string): RosterError | null {
    const r = roster.addPlayer(state, name, deps.newId)
    if (!r.ok) return r.error
    applyRoster(r.roster)
    persist()
    return null
  }

  function renamePlayer(id: string, name: string): RosterError | null {
    const r = roster.renamePlayer(state, id, name)
    if (!r.ok) return r.error
    applyRoster(r.roster)
    persist()
    return null
  }

  function isInRound(id: string): boolean {
    const r = state.round
    if (!r) return false
    return r.participantIds.includes(id) || (r.source.kind === 'playerGm' && r.source.gmPlayerId === id)
  }

  function removePlayer(id: string): RosterError | null {
    if (isInRound(id)) return 'inRound'
    applyRoster(roster.removePlayer(state, id))
    persist()
    return null
  }

  function setActive(id: string, active: boolean): void {
    applyRoster(roster.setActive(state, id, active))
    persist()
  }

  function toggleCategory(id: string): void {
    state.selectedCategoryIds = state.selectedCategoryIds.includes(id)
      ? state.selectedCategoryIds.filter((c) => c !== id)
      : [...state.selectedCategoryIds, id]
    persist()
  }

  function updateSettings(patch: Partial<Settings>): void {
    state.settings = { ...state.settings, ...patch }
    persist()
  }

  function ensureSession(): void {
    if (state.session) return
    state.session = { scores: {}, rounds: 0 }
    persist()
  }

  function endSession(): void {
    state.session = null
    state.round = null
    persist()
  }

  function roundBlocker(source: Source): RoundBlocker | null {
    const active = activeIds()
    if (source.kind === 'playerGm' && !active.includes(source.gmPlayerId)) return 'noGm'
    if (participantsFor(active, source).length < MIN_PARTICIPANTS) return 'needPlayers'
    if (
      source.kind === 'random' &&
      !testModeActive.value &&
      eligibleWords(content.value, state.language, state.selectedCategoryIds).length === 0
    ) {
      return 'noWords'
    }
    return null
  }

  function clampedImposterCount(source: Source): number | null {
    if (state.settings.randomImposterCount) return null
    const max = maxImposters(participantsFor(activeIds(), source).length)
    return max >= 1 && state.settings.imposterCount > max ? max : null
  }

  function beginRound(source: Source): void {
    const blocker = roundBlocker(source)
    if (blocker) throw new Error(`Cannot start a round: ${blocker}`)
    if (state.round) throw new Error('A round is already in progress')
    if (!state.session) state.session = { scores: {}, rounds: 0 }
    const lang = state.language
    let secret: Secret | null = null
    if (source.kind === 'random' && testModeActive.value) {
      secret = TEST_SECRETS[lang] // the word history is left untouched
    } else if (source.kind === 'random') {
      const eligible = eligibleWords(content.value, lang, state.selectedCategoryIds)
      const picked = pickWord(eligible, state.usedWordIds[lang], deps.rng)
      const category = content.value.categories.find((c) => c.id === picked.word.categoryId)
      if (!category) throw new Error(`Category ${picked.word.categoryId} is missing`)
      secret = makeSecret(picked.word, category, lang)
      state.usedWordIds = { ...state.usedWordIds, [lang]: picked.used }
    }
    state.round = startRound(
      { number: state.session.rounds + 1, lang, source, activePlayerIds: activeIds(), settings: state.settings, secret },
      deps.rng,
    ).round
    persist()
  }

  function submitGmWord(input: custom.GmWordInput): custom.GmWordError[] {
    const round = state.round
    if (!round || round.phase !== 'gmEntry') throw new Error('No round is waiting for a Game Master word')
    if (input.lang !== round.lang) throw new Error('The Game Master word must be in the round language')
    const errors = custom.validateGmWord(input, content.value)
    if (errors.length > 0) return errors
    const saved = custom.addGmWord(state, input, deps.newId)
    applyCustom(saved.custom)
    // The hint the GM just typed is the one this round uses, even if the saved word already had another.
    const typedHint = cleanText(input.hint)
    const secret = makeSecret(saved.word, saved.category, round.lang)
    state.round = reduce(round, { type: 'setSecret', secret: typedHint ? { ...secret, hint: typedHint } : secret })
    persist()
    return []
  }

  function dispatch(action: RoundAction): void {
    const prev = state.round
    if (!prev) throw new Error('No round in progress')
    const next = reduce(prev, action)
    if (next.phase === 'result' && prev.phase !== 'result' && state.session) {
      const deltas = scoreDeltas(next)
      const scores = { ...state.session.scores }
      for (const id of next.participantIds) {
        scores[id] = { name: playerName(id), points: (scores[id]?.points ?? 0) + (deltas[id] ?? 0) }
      }
      state.session = { scores, rounds: state.session.rounds + 1 }
    }
    state.round = next
    persist()
  }

  function finishRound(): void {
    if (state.round?.phase !== 'result') throw new Error('The round is not finished')
    state.round = null
    persist()
  }

  function abandonRound(): void {
    state.round = null
    persist()
  }

  function updateCustomWord(id: string, text: Localized, hint: Localized): custom.LocalizedError[] {
    const errors = custom.validateWordEdit(text, hint)
    if (errors.length > 0) return errors
    applyCustom(custom.updateCustomWord(state, id, text, hint))
    persist()
    return []
  }

  function updateCustomCategory(id: string, name: Localized): custom.LocalizedError[] {
    const errors = custom.validateCategoryEdit(name)
    if (errors.length > 0) return errors
    applyCustom(custom.updateCustomCategory(state, id, name))
    persist()
    return []
  }

  function deleteCustomWord(id: string): void {
    applyCustom(custom.deleteCustomWord(state, id))
    persist()
  }

  function deleteCustomCategory(id: string): void {
    applyCustom(custom.deleteCustomCategory(state, id))
    state.selectedCategoryIds = state.selectedCategoryIds.filter((c) => c !== id)
    persist()
  }

  function previewImport(json: unknown, mode: ImportMode): PreviewResult {
    const parsed = parsePack(json, new Set(content.value.categories.map((c) => c.id)))
    if (!parsed.ok) return parsed
    return { ok: true, plan: planImport(parsed.pack, state, mode, deps.newId) }
  }

  function applyImport(plan: ImportPlan): void {
    applyCustom(plan.result)
    const known = new Set(state.players.map((p) => p.id))
    const added = plan.result.players.filter((p) => !known.has(p.id)).map((p) => p.id)
    state.players = plan.result.players
    state.activePlayerIds = [...state.activePlayerIds, ...added] // imported players play, like typed-in ones
    state.settings = plan.result.settings
    persist()
  }

  function setLastImportUrl(url: string): void {
    state.lastImportUrl = url.trim() || null
    persist()
  }

  function setTestMode(on: boolean): void {
    state.testMode = on
    persist()
  }

  function dismissNotice(): void {
    meta.noticeDismissed = true
  }

  return {
    state, meta, content, t, playerName,
    setLanguage, addPlayer, renamePlayer, removePlayer, setActive, toggleCategory, updateSettings,
    ensureSession, endSession, roundBlocker, clampedImposterCount, beginRound, submitGmWord, dispatch,
    finishRound, abandonRound,
    updateCustomWord, updateCustomCategory, deleteCustomWord, deleteCustomCategory,
    previewImport, applyImport, setLastImportUrl, dismissNotice,
    devTools, testModeActive, setTestMode,
  }
}

export type AppStore = ReturnType<typeof createAppStore>

let instance: AppStore | null = null

export function useApp(): AppStore {
  instance ??= createAppStore({
    storage: browserStorage(),
    rng: cryptoRng,
    now: () => Date.now(),
    newId,
    devTools: import.meta.env.DEV,
  })
  return instance
}
