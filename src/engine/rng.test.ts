import { describe, expect, it } from 'bun:test'
import { cryptoRng, newId, pickOne, randomInt, sample, seededRng } from './rng'

describe('seededRng', () => {
  it('replays the same sequence for the same seed, so engine tests are reproducible', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
    expect(new Set(seqA).size).toBe(5)
  })

  it('stays within [0, 1)', () => {
    const rng = seededRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomInt', () => {
  it('reaches both inclusive ends, so every player can be picked', () => {
    const rng = seededRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 1, 4))
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('rejects an empty range instead of returning garbage', () => {
    expect(() => randomInt(seededRng(1), 3, 2)).toThrow()
  })
})

describe('pickOne / sample', () => {
  it('pickOne refuses an empty list instead of returning undefined', () => {
    expect(() => pickOne(seededRng(1), [])).toThrow()
  })

  it('sample returns k distinct members of the input', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    for (let seed = 0; seed < 50; seed++) {
      const picked = sample(seededRng(seed), items, 3)
      expect(new Set(picked).size).toBe(3)
      for (const p of picked) expect(items).toContain(p)
    }
  })

  it('sample refuses to take more items than exist', () => {
    expect(() => sample(seededRng(1), ['a'], 2)).toThrow()
  })
})

describe('cryptoRng and newId', () => {
  it('cryptoRng stays within [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = cryptoRng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('newId makes unique v4 UUIDs without crypto.randomUUID (which needs a secure context)', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()))
    expect(ids.size).toBe(100)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })
})
