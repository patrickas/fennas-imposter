import { describe, expect, it } from 'bun:test'
import { seededRng } from '../engine/rng'
import { FREE_ROUNDS_PER_DAY } from './limits'
import { memoryStorage, type StorageLike } from './storage'
import {
  KEY_WORDS, LICENSE_KEY, countRound, findKeyIndex, freeRoundsLeft, isOwnerPassword, keyText, loadLicense, localDay,
  magicIndex, magicWord, saveLicense, type License,
} from './license'

const fresh: License = { secret: 3, unlocked: false, owner: false, day: '', used: 0 }

describe('key words', () => {
  it('are 256 different words, so a secret word Alex types finds exactly one entry', () => {
    expect(KEY_WORDS).toHaveLength(256)
    expect(new Set(KEY_WORDS.map(keyText)).size).toBe(256)
  })

  // Keys sold on one version only match phones on the same version. Changing the first 256 English
  // built-in easy words changes every key, so update these two lines only on purpose.
  it('are the first 256 English built-in easy words, in shipping order', () => {
    expect(KEY_WORDS[0]).toBe('Falafel')
    expect(KEY_WORDS[255]).toBe('Airport')
  })
})

describe('magic word', () => {
  it('is different for every secret word, so one bought key never unlocks a phone that did not pay', () => {
    const all = Array.from({ length: 256 }, (_, s) => magicIndex(s))
    expect(new Set(all).size).toBe(256)
    expect(all.every((m) => Number.isInteger(m) && m >= 0 && m < 256)).toBe(true)
  })

  it('is never the secret word itself, which the customer can read on their own screen', () => {
    for (let s = 0; s < 256; s++) expect(magicIndex(s)).not.toBe(s)
  })

  // Alex's phone and the customer's must work out the same key; changing the formula breaks every key already sold.
  it('comes from a fixed formula', () => {
    expect(magicIndex(0)).toBe(89)
    expect(magicIndex(1)).toBe(0)
    expect(magicIndex(255)).toBe(178)
    expect(magicWord(1)).toBe(KEY_WORDS[0])
  })
})

describe('typed words', () => {
  it('match however a phone keyboard capitalises or spaces them', () => {
    expect(keyText('Camel ')).toBe(keyText('camel'))
    expect(keyText('  ICE   cream ')).toBe(keyText('Ice cream'))
    expect(keyText('icecream')).toBe(keyText('Ice cream'))
  })

  it('findKeyIndex finds a key word typed any way, and nothing for other text', () => {
    expect(findKeyIndex(KEY_WORDS[5].toUpperCase())).toBe(5)
    expect(findKeyIndex(` ${KEY_WORDS[200]} `)).toBe(200)
    const multi = KEY_WORDS.findIndex((w) => /\s/.test(w))
    expect(multi).toBeGreaterThan(-1)
    expect(findKeyIndex(KEY_WORDS[multi].replace(/\s+/g, '').toLowerCase())).toBe(multi)
    expect(findKeyIndex('definitely not a word')).toBeNull()
    expect(findKeyIndex('')).toBeNull()
    expect(findKeyIndex('   ')).toBeNull()
  })

  it('accept the owner password in any capitals and spacing, and nothing shorter', () => {
    expect(isOwnerPassword('wrong horse battery staple')).toBe(true)
    expect(isOwnerPassword(' Wrong Horse  Battery STAPLE ')).toBe(true)
    expect(isOwnerPassword('wronghorsebatterystaple')).toBe(true)
    expect(isOwnerPassword('wrong horse')).toBe(false)
    expect(isOwnerPassword('')).toBe(false)
  })
})

describe('free rounds', () => {
  it('allow 2 rounds a day, then none, and start again the next day', () => {
    expect(FREE_ROUNDS_PER_DAY).toBe(2)
    let l = fresh
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(2)
    l = countRound(l, '2026-10-03')
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(1)
    l = countRound(l, '2026-10-03')
    expect(freeRoundsLeft(l, '2026-10-03')).toBe(0)
    expect(freeRoundsLeft(l, '2026-10-04')).toBe(2)
    expect(countRound(l, '2026-10-04')).toMatchObject({ day: '2026-10-04', used: 1 })
  })

  it("follow the phone's own date, so the rounds come back at local midnight, not UTC midnight", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
    expect(localDay(new Date(2026, 0, 6, 0, 1).getTime())).toBe('2026-01-06')
  })
})

describe('saved license', () => {
  it('gets a secret word once and keeps it, so the word Alex was told never changes', () => {
    const storage = memoryStorage()
    const first = loadLicense(storage, seededRng(1))
    expect(first).toMatchObject({ unlocked: false, owner: false, day: '', used: 0 })
    expect(Number.isInteger(first.secret) && first.secret >= 0 && first.secret < 256).toBe(true)
    expect(JSON.parse(storage.dump()[LICENSE_KEY])).toEqual(first)
    expect(loadLicense(storage, seededRng(99))).toEqual(first)
  })

  it('replaces a damaged license with a new locked one', () => {
    const damaged = [
      '{oops',
      '[]',
      'null',
      JSON.stringify({ secret: 300, unlocked: true, owner: false, day: '', used: 0 }),
      JSON.stringify({ secret: 1, unlocked: 'yes', owner: false, day: '', used: 0 }),
    ]
    for (const raw of damaged) {
      expect(loadLicense(memoryStorage({ [LICENSE_KEY]: raw }), seededRng(1)).unlocked).toBe(false)
    }
  })

  it('keeps working in memory when storage is missing or refuses', () => {
    expect(loadLicense(null, seededRng(1)).unlocked).toBe(false)
    const blocked: StorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(loadLicense(blocked, seededRng(1)).unlocked).toBe(false)
    expect(saveLicense(blocked, fresh)).toBe(false)
    expect(saveLicense(null, fresh)).toBe(false)
  })
})
