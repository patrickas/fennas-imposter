import { describe, expect, it } from 'bun:test'
import { SEED_CATEGORIES } from './seed'
import {
  CURRENT_VERSION, STORAGE_KEY, browserStorage, defaultStored, loadStored, memoryStorage, saveStored, upgrade, type StorageLike,
} from './storage'

describe('loadStored', () => {
  it('starts fresh with every built-in category selected on first run', () => {
    const r = loadStored(memoryStorage(), 1)
    expect(r.status).toBe('fresh')
    expect(r.canSave).toBe(true)
    expect(r.stored.selectedCategoryIds).toEqual(SEED_CATEGORIES.map((c) => c.id))
    expect(r.stored.settings.scoring).toBe(false)
    expect(r.stored.settings.hints).toBe(true)
    expect(r.stored.settings.showCategory).toBe(false)
    expect(r.stored.settings.rotateStarter).toBe(true)
    expect(r.stored.settings.wordSource).toBe('random')
    expect(r.stored.gmPlayerId).toBeNull()
  })

  it('reads back exactly what was saved', () => {
    const storage = memoryStorage()
    const doc = defaultStored()
    doc.players = [{ id: 'p1', name: 'Rami' }]
    doc.language = 'ar'
    expect(saveStored(storage, doc)).toBe(true)
    const r = loadStored(storage, 1)
    expect(r.status).toBe('ok')
    expect(r.stored).toEqual(doc)
  })

  it('backs up damaged data instead of silently throwing it away', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' })
    const r = loadStored(storage, 1234)
    expect(r.status).toBe('corrupt')
    expect(r.canSave).toBe(true)
    expect(r.stored).toEqual(defaultStored())
    expect(storage.dump()[`${STORAGE_KEY}:corrupt:1234`]).toBe('{not json')
  })

  it('treats valid JSON with the wrong shape as damaged too', () => {
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, players: 'nope' }) }), 1)
    expect(r.status).toBe('corrupt')
  })

  it('switches on the built-in categories added in version 2 for players who saved before, keeping their own choices', () => {
    const v1Seed = ['food', 'animals', 'home', 'jobs', 'places', 'sports', 'nature', 'transport', 'clothes', 'levant']
    const added = SEED_CATEGORIES.map((c) => c.id).filter((id) => !v1Seed.includes(id))
    expect(added).toHaveLength(10)
    // This player had switched most categories off and added a custom one; those choices must survive.
    const v1 = { ...defaultStored(), version: 1, selectedCategoryIds: ['food', 'c-custom'] }
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v1) }), 1)
    expect(r.status).toBe('ok')
    expect(r.stored.version).toBe(CURRENT_VERSION)
    expect(r.stored.selectedCategoryIds).toEqual(['food', 'c-custom', ...added])
  })

  it('upgrades version-2 data with the category kept off the cards, so saved games and a round in progress play as before', () => {
    const v2 = JSON.parse(JSON.stringify({ ...defaultStored(), version: 2 }))
    delete v2.settings.showCategory
    v2.settings.scoring = true
    v2.round = { phase: 'reveal', settings: { hints: true, scoring: true, timer: { enabled: false, seconds: 180 }, imposterCountHidden: false } }
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v2) }), 1)
    expect(r.status).toBe('ok')
    expect(r.stored.version).toBe(CURRENT_VERSION)
    expect(r.stored.settings.showCategory).toBe(false)
    expect(r.stored.settings.scoring).toBe(true)
    expect(r.stored.round?.settings.showCategory).toBe(false)
    expect(r.stored.round?.phase).toBe('reveal')
  })

  it('upgrades version-3 data to players taking turns to start, the new default, keeping every other setting', () => {
    const v3 = JSON.parse(JSON.stringify({ ...defaultStored(), version: 3 }))
    delete v3.settings.rotateStarter
    v3.settings.hints = false
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v3) }), 1)
    expect(r.status).toBe('ok')
    expect(r.stored.version).toBe(CURRENT_VERSION)
    expect(r.stored.settings.rotateStarter).toBe(true)
    expect(r.stored.settings.hints).toBe(false)
  })

  it('upgrades version-4 data to a random word with no Game Master chosen yet, keeping every other setting', () => {
    const v4 = JSON.parse(JSON.stringify({ ...defaultStored(), version: 4 }))
    delete v4.settings.wordSource
    delete v4.gmPlayerId
    v4.settings.rotateStarter = false
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v4) }), 1)
    expect(r.status).toBe('ok')
    expect(r.stored.version).toBe(5)
    expect(r.stored.settings.wordSource).toBe('random')
    expect(r.stored.gmPlayerId).toBeNull()
    expect(r.stored.settings.rotateStarter).toBe(false)
  })

  it('never overwrites data written by a newer app version', () => {
    const r = loadStored(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99 }) }), 1)
    expect(r.status).toBe('newer')
    expect(r.canSave).toBe(false)
  })

  it('reports storage that throws (e.g. blocked in private mode) as unavailable', () => {
    const throwing: StorageLike = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
    }
    expect(loadStored(throwing, 1)).toMatchObject({ status: 'unavailable', canSave: false })
    expect(loadStored(null, 1)).toMatchObject({ status: 'unavailable', canSave: false })
  })
})

describe('saveStored', () => {
  it('returns false when the write fails (quota full), so the app can warn', () => {
    const full: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(saveStored(full, defaultStored())).toBe(false)
  })
})

describe('upgrade', () => {
  it('applies migrations in order so old documents are usable', () => {
    const migrations = {
      0: (d: Record<string, unknown>) => ({ ...d, version: 1, a: 1 }),
      1: (d: Record<string, unknown>) => ({ ...d, version: 2, b: 2 }),
    }
    expect(upgrade({ version: 0 }, migrations, 2)).toEqual({ version: 2, a: 1, b: 2 })
  })

  it('throws when a migration step is missing rather than guessing', () => {
    expect(() => upgrade({ version: 0 }, {}, 1)).toThrow()
  })
})

describe('browserStorage', () => {
  it('still reads saved data when the browser refuses writes (storage full), instead of starting empty', () => {
    const saved = defaultStored()
    saved.players = [{ id: 'p1', name: 'Rami' }]
    const full = {
      getItem: () => JSON.stringify(saved),
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => {},
    } as unknown as Storage
    const storage = browserStorage(() => full)
    expect(storage).not.toBeNull()
    expect(loadStored(storage, 1).stored.players).toEqual(saved.players)
  })

  it('reports storage as unavailable when it cannot even be read (e.g. blocked)', () => {
    expect(browserStorage(() => { throw new Error('SecurityError') })).toBeNull()
  })
})
