import type { Lang, RoundState, Secret, Settings, Source } from './types'
import type { Rng } from './rng'
import { MIN_PARTICIPANTS, assignImposters, pickStartingPlayer, resolveImposterCount } from './assign'

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalActionError'
  }
}

export interface StartRoundInput {
  number: number
  lang: Lang
  source: Source
  /** Active players in roster order; this is the pass order. */
  activePlayerIds: readonly string[]
  settings: Settings
  /** Required for the random source; must be null for GM sources (the GM types it). */
  secret: Secret | null
}

export type RoundAction =
  | { type: 'setSecret'; secret: Secret }
  | { type: 'cardSeen'; now: number }
  | { type: 'startPlaying'; now: number }
  | { type: 'endDiscussion' }
  | { type: 'voteOut'; playerId: string | null }
  | { type: 'imposterGuess'; correct: boolean }

export function participantsFor(activePlayerIds: readonly string[], source: Source): string[] {
  return source.kind === 'playerGm'
    ? activePlayerIds.filter((id) => id !== source.gmPlayerId)
    : [...activePlayerIds]
}

export function startRound(input: StartRoundInput, rng: Rng): { round: RoundState; clamped: boolean } {
  const { source, secret, settings } = input
  if (source.kind === 'playerGm' && !input.activePlayerIds.includes(source.gmPlayerId)) {
    throw new IllegalActionError('The Game Master must be an active player')
  }
  const participantIds = participantsFor(input.activePlayerIds, source)
  if (participantIds.length < MIN_PARTICIPANTS) {
    throw new IllegalActionError(`A round needs at least ${MIN_PARTICIPANTS} participants`)
  }
  if (source.kind === 'random' && !secret) throw new IllegalActionError('A random round needs a word')
  if (source.kind !== 'random' && secret) throw new IllegalActionError('A Game Master round starts without a word')

  const { count, clamped } = resolveImposterCount(settings, participantIds.length, rng)
  const round: RoundState = {
    number: input.number,
    lang: input.lang,
    source,
    participantIds,
    imposterIds: assignImposters(participantIds, count, rng),
    startingPlayerId: pickStartingPlayer(participantIds, rng),
    secret,
    settings: {
      hints: settings.hints,
      showCategory: settings.showCategory,
      scoring: settings.scoring,
      timer: { ...settings.timer },
      imposterCountHidden: settings.randomImposterCount,
    },
    phase: source.kind === 'random' ? 'reveal' : 'gmEntry',
    revealIndex: 0,
    timerEndsAt: null,
    votedOut: null,
    imposterGuessed: null,
    outcome: null,
  }
  return { round, clamped }
}

function expectPhase(state: RoundState, phase: RoundState['phase'], action: RoundAction): void {
  if (state.phase !== phase) {
    throw new IllegalActionError(`"${action.type}" is not allowed during "${state.phase}"`)
  }
}

export function reduce(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'setSecret':
      expectPhase(state, 'gmEntry', action)
      return { ...state, secret: action.secret, phase: 'reveal' }

    case 'cardSeen': {
      expectPhase(state, 'reveal', action)
      const revealIndex = state.revealIndex + 1
      if (revealIndex < state.participantIds.length) return { ...state, revealIndex }
      return { ...state, revealIndex, phase: 'starting' }
    }

    case 'startPlaying': {
      expectPhase(state, 'starting', action)
      const { timer } = state.settings
      return {
        ...state,
        phase: 'discussion',
        timerEndsAt: timer.enabled ? action.now + timer.seconds * 1000 : null,
      }
    }

    case 'endDiscussion':
      expectPhase(state, 'discussion', action)
      return { ...state, phase: state.settings.scoring ? 'vote' : 'result' }

    case 'voteOut': {
      expectPhase(state, 'vote', action)
      const { playerId } = action
      if (playerId !== null && !state.participantIds.includes(playerId)) {
        throw new IllegalActionError(`${playerId} is not in this round`)
      }
      const votedOut = { playerId }
      if (playerId !== null && state.imposterIds.includes(playerId)) {
        return { ...state, votedOut, phase: 'guess' }
      }
      return { ...state, votedOut, phase: 'result', outcome: 'imposters' }
    }

    case 'imposterGuess':
      expectPhase(state, 'guess', action)
      return {
        ...state,
        imposterGuessed: action.correct,
        phase: 'result',
        outcome: action.correct ? 'imposters' : 'crew',
      }
  }
}
