import { describe, expect, it } from 'bun:test'
import { seededRng } from './rng'
import { assignImposters, maxImposters, nextStartingPlayer, pickStartingPlayer, resolveImposterCount } from './assign'

describe('maxImposters', () => {
  it.each([
    [2, 0], [3, 1], [4, 1], [5, 2], [6, 2], [7, 3], [12, 5],
  ])('%i participants allow at most %i imposters', (n, max) => {
    expect(maxImposters(n)).toBe(max)
  })
})

describe('resolveImposterCount', () => {
  it('always leaves the crew outnumbering the imposters, whatever the settings say', () => {
    for (let n = 3; n <= 12; n++) {
      for (let requested = 1; requested <= 10; requested++) {
        for (const randomImposterCount of [false, true]) {
          for (let seed = 0; seed < 10; seed++) {
            const { count } = resolveImposterCount({ imposterCount: requested, randomImposterCount }, n, seededRng(seed))
            expect(count).toBeGreaterThanOrEqual(1)
            expect(n - count).toBeGreaterThan(count)
          }
        }
      }
    }
  })

  it('reports clamping so the between-rounds screen can explain it', () => {
    expect(resolveImposterCount({ imposterCount: 3, randomImposterCount: false }, 4, seededRng(1)))
      .toEqual({ count: 1, clamped: true })
    expect(resolveImposterCount({ imposterCount: 2, randomImposterCount: false }, 5, seededRng(1)))
      .toEqual({ count: 2, clamped: false })
  })

  it('random mode can produce every count from 1 to max', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(resolveImposterCount({ imposterCount: 1, randomImposterCount: true }, 7, seededRng(seed)).count)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('refuses a round with fewer than 3 participants', () => {
    expect(() => resolveImposterCount({ imposterCount: 1, randomImposterCount: false }, 2, seededRng(1))).toThrow()
  })
})

describe('assignImposters / pickStartingPlayer', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']

  it('picks distinct imposters from the participants only', () => {
    for (let seed = 0; seed < 30; seed++) {
      const imposters = assignImposters(ids, 2, seededRng(seed))
      expect(new Set(imposters).size).toBe(2)
      for (const id of imposters) expect(ids).toContain(id)
    }
  })

  it('picks a starting player from the participants', () => {
    expect(ids).toContain(pickStartingPlayer(ids, seededRng(9)))
  })
})

describe('nextStartingPlayer', () => {
  const roster = ['a', 'b', 'c', 'd']

  it('lets the first player start the first round, then everyone in list order, looping back to the top', () => {
    const starters: string[] = []
    let last: string | null = null
    for (let i = 0; i < 6; i++) {
      last = nextStartingPlayer(roster, roster, last)
      starters.push(last)
    }
    expect(starters).toEqual(['a', 'b', 'c', 'd', 'a', 'b'])
  })

  it('skips whoever sits this round out (not playing, or the Game Master) without losing the place in line', () => {
    expect(nextStartingPlayer(roster, ['a', 'b', 'd'], 'b')).toBe('d')
    expect(nextStartingPlayer(roster, ['b', 'c', 'd'], 'd')).toBe('b')
  })

  it('carries on after the last starter even when they sit this round out', () => {
    expect(nextStartingPlayer(roster, ['a', 'c', 'd'], 'b')).toBe('c')
  })

  it('starts again from the top when the last starter was removed from the player list', () => {
    expect(nextStartingPlayer(roster, ['b', 'c', 'd'], 'gone')).toBe('b')
  })
})
