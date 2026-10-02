import { describe, expect, it } from 'bun:test'
import { SEED_CATEGORY_IDS } from './seed'
import { defaultSettings } from './storage'
import {
  MAX_PACK_BYTES, exportFileName, exportPack, fetchPackJson, parseJsonText, parsePack, planImport, readPackFile,
  type FetchDeps, type FetchFn, type ImportTarget,
} from './transfer'

const pack = (over: Record<string, unknown> = {}) => ({
  format: 'fennas-imposter',
  version: 1,
  categories: [{ id: 'jo-food', name: { en: 'Jordanian food', ar: 'أكل أردني' } }],
  words: [
    { id: 'jo-food.mansaf', categoryId: 'jo-food', text: { en: 'Mansaf', ar: 'منسف' }, hint: { ar: 'لبن' } },
    { id: 'food.knafeh', categoryId: 'food', text: { ar: 'كنافة' } },
  ],
  ...over,
})
const emptyTarget = (): ImportTarget => ({ customCategories: [], customWords: [], players: [], settings: defaultSettings() })
let n = 0
const newId = () => `n${++n}`

function valid(json: unknown) {
  const r = parsePack(json, SEED_CATEGORY_IDS)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.pack
}

describe('parsePack', () => {
  it('accepts a well-formed pack, including words filed under built-in categories', () => {
    const p = valid(pack())
    expect(p.categories).toHaveLength(1)
    expect(p.words.map((w) => w.categoryId)).toEqual(['jo-food', 'food'])
    expect(p.words[1].hint).toEqual({})
  })

  it('rejects files that are not ours at all', () => {
    expect(parsePack({ hello: 1 }, SEED_CATEGORY_IDS)).toEqual({ ok: false, errors: [{ path: '', code: 'badFormat' }] })
  })

  it('points at each broken entry by path so the user can fix the file', () => {
    const r = parsePack(pack({
      categories: [{ id: 'bad id!', name: { en: 'X' } }, { id: 'ok', name: {} }],
      words: [
        { id: 'w1', categoryId: 'nowhere', text: { en: 'A' } },
        { id: 'w1', categoryId: 'ok', text: { en: 'x'.repeat(41) } },
      ],
      settings: { imposterCount: 'two' },
    }), SEED_CATEGORY_IDS)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toEqual([
        { path: 'categories[0].id', code: 'invalidId' },
        { path: 'categories[1].name', code: 'empty' },
        { path: 'words[0].categoryId', code: 'unknownCategory' },
        { path: 'words[1].id', code: 'duplicateId' },
        { path: 'words[1].text.en', code: 'tooLong' },
        { path: 'settings', code: 'wrongType' },
      ])
    }
  })

  it('reads hard words and subtle hints; words without a level are easy', () => {
    const p = valid(pack({
      words: [
        { id: 'w.hard', categoryId: 'food', level: 'hard', text: { en: 'Saffron' }, hint: { en: 'Gold' } },
        { id: 'w.easy', categoryId: 'food', level: 'easy', text: { en: 'Bread' } },
        { id: 'w.plain', categoryId: 'food', text: { en: 'Rice' } },
        {
          id: 'w.cake', categoryId: 'food', text: { en: 'Cake' },
          subtle: { hint: { en: ' Lie ' }, why: { en: 'The cake is a lie' } },
        },
        { id: 'w.nowhy', categoryId: 'food', text: { en: 'Soup' }, subtle: { hint: { en: 'Spoon' } } },
      ],
    }))
    expect(p.words.map((w) => w.level)).toEqual(['hard', undefined, undefined, undefined, undefined])
    expect(p.words[3].subtle).toEqual({ hint: { en: 'Lie' }, why: { en: 'The cake is a lie' } })
    // The explanation is optional: a subtle hint without one still plays.
    expect(p.words[4].subtle).toEqual({ hint: { en: 'Spoon' }, why: {} })
  })

  it('rejects broken levels and subtle hints, pointing at each one', () => {
    const r = parsePack(pack({
      words: [
        { id: 'w1', categoryId: 'food', level: 'expert', text: { en: 'A' } },
        { id: 'w2', categoryId: 'food', text: { en: 'B' }, subtle: 'sneaky' },
        { id: 'w3', categoryId: 'food', text: { en: 'C' }, subtle: { why: { en: 'Because' } } },
        { id: 'w4', categoryId: 'food', text: { en: 'D' }, subtle: { hint: { en: 'x' }, why: { en: 'y'.repeat(81) } } },
        { id: 'w5', categoryId: 'food', text: { en: 'E' }, subtle: { hint: { en: 'x'.repeat(41) } } },
        // A subtle hint on a hard word would never be dealt, so the pack author should hear about it.
        { id: 'w6', categoryId: 'food', level: 'hard', text: { en: 'F' }, subtle: { hint: { en: 'x' } } },
      ],
    }), SEED_CATEGORY_IDS)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toEqual([
        { path: 'words[0].level', code: 'wrongType' },
        { path: 'words[1].subtle', code: 'wrongType' },
        { path: 'words[2].subtle.hint', code: 'missing' },
        { path: 'words[3].subtle.why.en', code: 'tooLong' },
        { path: 'words[4].subtle.hint.en', code: 'tooLong' },
        { path: 'words[5].subtle', code: 'subtleOnHard' },
      ])
    }
  })

  it('caps the error list at 10 so a garbage file does not flood the screen', () => {
    const words = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, categoryId: 'nowhere', text: { en: 'A' } }))
    const r = parsePack(pack({ words }), SEED_CATEGORY_IDS)
    expect(!r.ok && r.errors.length).toBe(10)
  })
})

describe('planImport', () => {
  it('still imports old backups with a 30-second timer, raised to the 1-minute minimum', () => {
    const p = valid(pack({ settings: { ...defaultSettings(), timer: { enabled: true, seconds: 30 } } }))
    expect(p.settings!.timer).toEqual({ enabled: true, seconds: 60 })
  })

  it('still imports backups made before the category option existed, with the category kept off the cards', () => {
    const old: Record<string, unknown> = { ...defaultSettings() }
    delete old.showCategory
    expect(valid(pack({ settings: old })).settings!.showCategory).toBe(false)
    expect(valid(pack({ settings: { ...defaultSettings(), showCategory: true } })).settings!.showCategory).toBe(true)
    expect(parsePack(pack({ settings: { ...defaultSettings(), showCategory: 'yes' } }), SEED_CATEGORY_IDS).ok).toBe(false)
  })

  it('still imports backups made before the take-turns option existed, with turns on (the default)', () => {
    const old: Record<string, unknown> = { ...defaultSettings() }
    delete old.rotateStarter
    expect(valid(pack({ settings: old })).settings!.rotateStarter).toBe(true)
    expect(valid(pack({ settings: { ...defaultSettings(), rotateStarter: false } })).settings!.rotateStarter).toBe(false)
    expect(parsePack(pack({ settings: { ...defaultSettings(), rotateStarter: 'no' } }), SEED_CATEGORY_IDS).ok).toBe(false)
  })

  it('still imports backups made before the word source was a setting, with a random word', () => {
    const old: Record<string, unknown> = { ...defaultSettings() }
    delete old.wordSource
    expect(valid(pack({ settings: old })).settings!.wordSource).toBe('random')
    expect(valid(pack({ settings: { ...defaultSettings(), wordSource: 'outsideGm' } })).settings!.wordSource).toBe('outsideGm')
    expect(parsePack(pack({ settings: { ...defaultSettings(), wordSource: 'anyone' } }), SEED_CATEGORY_IDS).ok).toBe(false)
  })

  it('still imports backups made before difficulty existed, with easy rounds', () => {
    const old: Record<string, unknown> = { ...defaultSettings() }
    delete old.difficulty
    expect(valid(pack({ settings: old })).settings!.difficulty).toBe('easy')
    expect(valid(pack({ settings: { ...defaultSettings(), difficulty: 'random' } })).settings!.difficulty).toBe('random')
    expect(parsePack(pack({ settings: { ...defaultSettings(), difficulty: 'insane' } }), SEED_CATEGORY_IDS).ok).toBe(false)
  })

  it('keeps the level and subtle hint of imported words, and an update can make a word easy again', () => {
    const hard = { id: 'w.hard', categoryId: 'food', level: 'hard', text: { en: 'Saffron' } }
    const cake = { id: 'w.cake', categoryId: 'food', text: { en: 'Cake' }, subtle: { hint: { en: 'Lie' } } }
    const first = planImport(valid(pack({ words: [hard, cake] })), emptyTarget(), 'url', newId).result
    expect(first.customWords.map((w) => [w.level, w.subtle])).toEqual([
      ['hard', undefined], [undefined, { hint: { en: 'Lie' }, why: {} }],
    ])
    const plain = [{ ...hard, level: undefined }, { ...cake, subtle: undefined }]
    const again = planImport(valid(pack({ words: plain })), first, 'url', newId).result
    expect(again.customWords.map((w) => [w.level, w.subtle])).toEqual([[undefined, undefined], [undefined, undefined]])
  })

  it('counts additions and updates, merging by id so re-importing refreshes', () => {
    const first = planImport(valid(pack()), emptyTarget(), 'url', newId)
    expect(first.summary).toMatchObject({ addCategories: 1, addWords: 2, updateWords: 0 })
    const again = planImport(valid(pack()), first.result, 'url', newId)
    expect(again.summary).toMatchObject({ addCategories: 0, updateCategories: 1, addWords: 0, updateWords: 2 })
    expect(again.result.customWords).toHaveLength(2)
  })

  it('can never overwrite built-in entries', () => {
    const p = valid(pack({
      categories: [{ id: 'food', name: { en: 'Hacked' } }],
      words: [{ id: 'food.falafel', categoryId: 'food', text: { en: 'Hacked' } }],
    }))
    const plan = planImport(p, emptyTarget(), 'file', newId)
    expect(plan.summary.skippedBuiltIn).toBe(2)
    expect(plan.result.customCategories).toEqual([])
    expect(plan.result.customWords).toEqual([])
  })

  it('URL imports only bring words: players and settings in the file are ignored', () => {
    const p = valid(pack({ players: [{ name: 'Rami' }], settings: { ...defaultSettings(), scoring: true } }))
    const plan = planImport(p, emptyTarget(), 'url', newId)
    expect(plan.result.players).toEqual([])
    expect(plan.result.settings.scoring).toBe(false)
    expect(plan.summary).toMatchObject({ addPlayers: 0, replacesSettings: false })
  })

  it('file imports merge players by name and replace settings', () => {
    const target = { ...emptyTarget(), players: [{ id: 'p1', name: 'Rami' }] }
    const p = valid(pack({ players: [{ name: ' rami ' }, { name: 'Lina' }], settings: { ...defaultSettings(), scoring: true } }))
    const plan = planImport(p, target, 'file', newId)
    expect(plan.result.players.map((x) => x.name)).toEqual(['Rami', 'Lina'])
    expect(plan.result.settings.scoring).toBe(true)
    expect(plan.summary).toMatchObject({ addPlayers: 1, replacesSettings: true })
  })
})

describe('export', () => {
  it('round-trips custom content, players and settings through a file', () => {
    const original = planImport(valid(pack({ players: [{ name: 'Rami' }] })), emptyTarget(), 'file', newId).result
    const restored = planImport(valid(JSON.parse(exportPack(original))), emptyTarget(), 'file', newId).result
    expect(restored.customCategories).toEqual(original.customCategories)
    expect(restored.customWords).toEqual(original.customWords)
    expect(restored.players.map((p) => p.name)).toEqual(['Rami'])
    expect(restored.settings).toEqual(original.settings)
  })

  it('round-trips hard words and subtle hints, writing them only where set', () => {
    const words = [
      { id: 'w.hard', categoryId: 'food', level: 'hard', text: { en: 'Saffron' } },
      { id: 'w.cake', categoryId: 'food', text: { en: 'Cake' }, subtle: { hint: { en: 'Lie' }, why: { en: 'A lie' } } },
      { id: 'w.rice', categoryId: 'food', text: { en: 'Rice' } },
    ]
    const original = planImport(valid(pack({ words })), emptyTarget(), 'file', newId).result
    const json = JSON.parse(exportPack(original))
    expect(json.words.map((w: Record<string, unknown>) => Object.keys(w).filter((k) => k === 'level' || k === 'subtle')))
      .toEqual([['level'], ['subtle'], []])
    const restored = planImport(valid(json), emptyTarget(), 'file', newId).result
    expect(restored.customWords).toEqual(original.customWords)
  })

  it('names backups by local date', () => {
    expect(exportFileName(new Date(2026, 8, 7))).toBe('fennas-imposter-2026-09-07.json')
  })
})

describe('parseJsonText / readPackFile', () => {
  it('rejects oversized input before parsing it', () => {
    expect(parseJsonText('x'.repeat(MAX_PACK_BYTES + 1))).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('rejects non-JSON', () => {
    expect(parseJsonText('{oops')).toEqual({ ok: false, error: 'invalidJson' })
  })

  it('checks a file’s size before reading it', async () => {
    expect(await readPackFile(new Blob(['x'.repeat(MAX_PACK_BYTES + 1)]))).toEqual({ ok: false, error: 'tooLarge' })
    expect(await readPackFile(new Blob(['{"a":1}']))).toEqual({ ok: true, json: { a: 1 } })
  })
})

describe('fetchPackJson', () => {
  it('stops downloading once a pack passes 1 MB, instead of reading the whole body first', async () => {
    let pulled = 0
    const chunk = new Uint8Array(64 * 1024).fill(32)
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        if (pulled > 200) controller.close() // ~12.8 MB in total if read to the end
        else controller.enqueue(chunk)
      },
    })
    const huge: FetchFn = async () => new Response(body, { status: 200 })
    const result = await fetchPackJson('https://example.com/p.json', { fetch: huge, isOnline: () => true, timeoutMs: 10_000 })
    expect(result).toEqual({ ok: false, error: 'tooLarge' })
    expect(pulled).toBeLessThan(40)
  })

  const deps = (fetchImpl: FetchFn, online = true): FetchDeps => ({ fetch: fetchImpl, isOnline: () => online, timeoutMs: 20 })
  const ok = (body: string, init: ResponseInit = {}) => async () => new Response(body, { status: 200, ...init })
  const never: FetchFn = async () => { throw new Error('must not be called') }

  it('refuses non-links and plain http without making a request', async () => {
    expect(await fetchPackJson('not a url', deps(never))).toEqual({ ok: false, error: 'invalidUrl' })
    expect(await fetchPackJson('http://example.com/p.json', deps(never))).toEqual({ ok: false, error: 'httpsOnly' })
  })

  it('says "offline" instead of trying when there is no connection', async () => {
    expect(await fetchPackJson('https://example.com/p.json', deps(never, false))).toEqual({ ok: false, error: 'offline' })
  })

  it('returns the parsed JSON on success', async () => {
    expect(await fetchPackJson('https://example.com/p.json', deps(ok('{"a":1}')))).toEqual({ ok: true, json: { a: 1 } })
  })

  it('reports HTTP errors with their status', async () => {
    const notFound = async () => new Response('nope', { status: 404 })
    expect(await fetchPackJson('https://example.com/p.json', deps(notFound))).toEqual({ ok: false, error: 'httpStatus', status: 404 })
  })

  it('trusts a too-large Content-Length and stops early', async () => {
    const big = ok('{}', { headers: { 'content-length': String(MAX_PACK_BYTES + 1) } })
    expect(await fetchPackJson('https://example.com/p.json', deps(big))).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('gives up after the timeout', async () => {
    const hanging: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    expect(await fetchPackJson('https://example.com/p.json', deps(hanging))).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports blocked requests (CORS, DNS) as network errors', async () => {
    const blocked: FetchFn = async () => { throw new TypeError('Failed to fetch') }
    expect(await fetchPackJson('https://example.com/p.json', deps(blocked))).toEqual({ ok: false, error: 'network' })
  })
})
