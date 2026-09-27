import type { Player } from '../engine/types'
import { cleanText, normalizeText } from './normalize'
import { LIMITS, textLength } from './limits'

export interface Roster {
  players: Player[]
  activePlayerIds: string[]
}

export type NameError = 'empty' | 'tooLong' | 'taken'
export type RosterResult = { ok: true; roster: Roster } | { ok: false; error: NameError }

export function validateName(name: string, players: readonly Player[], exceptId?: string): NameError | null {
  const clean = cleanText(name)
  if (!clean) return 'empty'
  if (textLength(clean) > LIMITS.player) return 'tooLong'
  const key = normalizeText(clean)
  if (players.some((p) => p.id !== exceptId && normalizeText(p.name) === key)) return 'taken'
  return null
}

export function addPlayer(roster: Roster, name: string, newId: () => string): RosterResult {
  const error = validateName(name, roster.players)
  if (error) return { ok: false, error }
  const player: Player = { id: newId(), name: cleanText(name) }
  return {
    ok: true,
    roster: { players: [...roster.players, player], activePlayerIds: [...roster.activePlayerIds, player.id] },
  }
}

export function renamePlayer(roster: Roster, id: string, name: string): RosterResult {
  if (!roster.players.some((p) => p.id === id)) throw new Error(`No player ${id}`)
  const error = validateName(name, roster.players, id)
  if (error) return { ok: false, error }
  return {
    ok: true,
    roster: {
      ...roster,
      players: roster.players.map((p) => (p.id === id ? { ...p, name: cleanText(name) } : p)),
    },
  }
}

export function removePlayer(roster: Roster, id: string): Roster {
  return {
    players: roster.players.filter((p) => p.id !== id),
    activePlayerIds: roster.activePlayerIds.filter((pid) => pid !== id),
  }
}

export function setActive(roster: Roster, id: string, active: boolean): Roster {
  const set = new Set(roster.activePlayerIds)
  if (active) set.add(id)
  else set.delete(id)
  return { players: roster.players, activePlayerIds: roster.players.map((p) => p.id).filter((pid) => set.has(pid)) }
}
