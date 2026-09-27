import type { Settings } from './types'
import { pickOne, randomInt, sample, type Rng } from './rng'

export const MIN_PARTICIPANTS = 3

/** Crew must always outnumber imposters. */
export function maxImposters(participants: number): number {
  return Math.max(0, Math.floor((participants - 1) / 2))
}

export function resolveImposterCount(
  settings: Pick<Settings, 'imposterCount' | 'randomImposterCount'>,
  participants: number,
  rng: Rng,
): { count: number; clamped: boolean } {
  const max = maxImposters(participants)
  if (max < 1) throw new Error(`Need at least ${MIN_PARTICIPANTS} participants`)
  if (settings.randomImposterCount) return { count: randomInt(rng, 1, max), clamped: false }
  const requested = Math.max(1, Math.floor(settings.imposterCount))
  return { count: Math.min(requested, max), clamped: requested > max }
}

export function assignImposters(participantIds: readonly string[], count: number, rng: Rng): string[] {
  return sample(rng, participantIds, count)
}

export function pickStartingPlayer(participantIds: readonly string[], rng: Rng): string {
  return pickOne(rng, participantIds)
}
