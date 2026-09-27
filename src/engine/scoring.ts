import type { RoundState } from './types'

export const CREW_WIN_POINTS = 1
export const IMPOSTER_WIN_POINTS = 2

/** Points earned this round, per participant id. Empty unless the round ended with an outcome. */
export function scoreDeltas(round: RoundState): Record<string, number> {
  if (round.phase !== 'result' || round.outcome === null) return {}
  const imposters = new Set(round.imposterIds)
  const deltas: Record<string, number> = {}
  for (const id of round.participantIds) {
    const isImposter = imposters.has(id)
    if (round.outcome === 'crew' && !isImposter) deltas[id] = CREW_WIN_POINTS
    if (round.outcome === 'imposters' && isImposter) deltas[id] = IMPOSTER_WIN_POINTS
  }
  return deltas
}
