import { describe, expect, it } from 'bun:test'
import { addPlayer, removePlayer, renamePlayer, setActive, validateName, type Roster } from './roster'

const empty: Roster = { players: [], activePlayerIds: [] }
let n = 0
const newId = () => `id${++n}`

function rosterOf(...names: string[]): Roster {
  let r = empty
  for (const name of names) {
    const res = addPlayer(r, name, newId)
    if (!res.ok) throw new Error(res.error)
    r = res.roster
  }
  return r
}

describe('roster', () => {
  it('adds players as active (tonight’s players are usually the ones just typed)', () => {
    const r = rosterOf('Rami', 'Lina')
    expect(r.players.map((p) => p.name)).toEqual(['Rami', 'Lina'])
    expect(r.activePlayerIds).toEqual(r.players.map((p) => p.id))
  })

  it('stores names cleaned but with their original spelling', () => {
    expect(rosterOf('  أحمد   علي ').players[0].name).toBe('أحمد علي')
  })

  it('rejects names that differ only by case, spacing or Arabic spelling, so players stay distinguishable', () => {
    const r = rosterOf('Rami', 'أحمد')
    expect(validateName(' rami ', r.players)).toBe('taken')
    expect(validateName('احمد', r.players)).toBe('taken')
    expect(validateName('Rania', r.players)).toBeNull()
  })

  it('rejects empty and over-long names', () => {
    expect(validateName('   ', [])).toBe('empty')
    expect(validateName('a'.repeat(21), [])).toBe('tooLong')
    expect(validateName('a'.repeat(20), [])).toBeNull()
  })

  it('lets a player fix the case of their own name', () => {
    const r = rosterOf('rami')
    const res = renamePlayer(r, r.players[0].id, 'Rami')
    expect(res.ok && res.roster.players[0].name).toBe('Rami')
  })

  it('removing a player also removes them from tonight’s players', () => {
    const r = rosterOf('Rami', 'Lina')
    const out = removePlayer(r, r.players[0].id)
    expect(out.players.map((p) => p.name)).toEqual(['Lina'])
    expect(out.activePlayerIds).toEqual([r.players[1].id])
  })

  it('setActive keeps roster order (the pass order) and ignores unknown ids', () => {
    const r = rosterOf('A', 'B', 'C')
    const [a, b, c] = r.players.map((p) => p.id)
    let out = setActive(r, b, false)
    out = setActive(out, 'ghost', true)
    out = setActive(out, b, true)
    expect(out.activePlayerIds).toEqual([a, b, c])
  })
})
