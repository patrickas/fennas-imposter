import { describe, expect, it } from 'bun:test'
import { seededRng } from '../engine/rng'
import { STORAGE_KEY, memoryStorage, type StorageLike } from '../data/storage'
import { createAppStore, type AppStore } from './useApp'

function setup(storage: StorageLike | null = memoryStorage(), seed = 1): AppStore {
  let n = 0
  return createAppStore({ storage, rng: seededRng(seed), now: () => 1_000, newId: () => `id${++n}` })
}
function withPlayers(app: AppStore, names = ['Rami', 'Lina', 'Omar', 'Sara']): string[] {
  for (const name of names) expect(app.addPlayer(name)).toBeNull()
  return app.state.players.map((p) => p.id)
}
function revealAll(app: AppStore): void {
  const r = app.state.round!
  for (let i = r.revealIndex; i < r.participantIds.length; i++) app.dispatch({ type: 'cardSeen', now: 0 })
}
function playOut(app: AppStore): void {
  revealAll(app)
  app.dispatch({ type: 'startPlaying', now: 0 })
  app.dispatch({ type: 'endDiscussion' })
  if (app.state.round!.phase === 'vote') app.dispatch({ type: 'voteOut', playerId: null })
  app.finishRound()
}

describe('persistence', () => {
  it('saves after every action so a killed tab loses nothing', () => {
    const storage = memoryStorage()
    setup(storage).addPlayer('Rami')
    expect(JSON.parse(storage.dump()[STORAGE_KEY]).players[0].name).toBe('Rami')
  })

  it('keeps working in memory when storage is unavailable, and says so', () => {
    const app = setup(null)
    expect(app.meta.status).toBe('unavailable')
    expect(app.addPlayer('Rami')).toBeNull()
    expect(app.state.players).toHaveLength(1)
  })

  it('switches to "unavailable" when a save fails mid-session (quota full)', () => {
    let fail = false
    const flaky: StorageLike = { getItem: () => null, setItem: () => { if (fail) throw new Error('quota') } }
    const app = setup(flaky)
    fail = true
    app.addPlayer('Rami')
    expect(app.meta).toMatchObject({ status: 'unavailable', canSave: false })
  })
})

describe('rounds', () => {
  it('locks the language while a round is in progress', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(() => app.setLanguage('ar')).toThrow()
    expect(app.state.language).toBe('en')
  })

  it('applies scores exactly once, even if the app reloads on the result screen', () => {
    const storage = memoryStorage()
    const app = setup(storage)
    withPlayers(app)
    app.updateSettings({ scoring: true })
    app.beginRound({ kind: 'random' })
    revealAll(app)
    app.dispatch({ type: 'startPlaying', now: 0 })
    app.dispatch({ type: 'endDiscussion' })
    const r = app.state.round!
    app.dispatch({ type: 'voteOut', playerId: r.imposterIds[0] })
    app.dispatch({ type: 'imposterGuess', correct: false })
    const scores = JSON.parse(JSON.stringify(app.state.session!.scores))

    const reloaded = setup(storage)
    expect(reloaded.state.round?.phase).toBe('result')
    expect(reloaded.state.session!.scores).toEqual(scores)
    expect(reloaded.state.session!.rounds).toBe(1)
    expect(() => reloaded.dispatch({ type: 'imposterGuess', correct: true })).toThrow()

    for (const id of r.participantIds) {
      expect(scores[id].points).toBe(r.imposterIds.includes(id) ? 0 : 1)
    }
  })

  it('does not repeat a random word until every word in the selected categories was used', () => {
    const app = setup()
    withPlayers(app)
    for (const id of [...app.state.selectedCategoryIds]) if (id !== 'food') app.toggleCategory(id)
    const seen = new Set<string>()
    for (let i = 0; i < 25; i++) {
      app.beginRound({ kind: 'random' })
      seen.add(app.state.round!.secret!.wordId)
      playOut(app)
    }
    expect(seen.size).toBe(25)
  })

  it('saves the Game Master word, selects its new category, and deals it without the GM', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.beginRound({ kind: 'playerGm', gmPlayerId: ids[0] })
    expect(app.state.round!.participantIds).not.toContain(ids[0])
    expect(app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { newName: 'Jordanian food' } })).toEqual([])
    expect(app.state.round!.phase).toBe('reveal')
    expect(app.state.round!.secret!.word).toBe('Mansaf')
    expect(app.state.customWords.map((w) => w.text.en)).toEqual(['Mansaf'])
    expect(app.state.selectedCategoryIds).toContain(app.state.customCategories[0].id)
  })

  it('returns Game Master form errors without starting the deal', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    expect(app.submitGmWord({ lang: 'en', word: ' ', hint: '', category: { existingId: 'food' } }))
      .toEqual([{ field: 'word', code: 'empty' }])
    expect(app.state.round!.phase).toBe('gmEntry')
    expect(app.state.customWords).toEqual([])
  })

  it('refuses to remove a player who is in the running round, and the round still completes', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(app.removePlayer(ids[1])).toBe('inRound')
    expect(app.state.players).toHaveLength(4)
    playOut(app)
    expect(app.removePlayer(ids[1])).toBeNull()
  })

  it('keeps a running round intact when its custom word is deleted, and never deals that word again', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { newName: 'Jordanian food' } })
    const categoryId = app.state.customCategories[0].id
    const wordId = app.state.round!.secret!.wordId
    app.deleteCustomCategory(categoryId)
    expect(app.state.round!.secret!.word).toBe('Mansaf')
    expect(app.state.selectedCategoryIds).not.toContain(categoryId)
    playOut(app)
    for (let i = 0; i < 30; i++) {
      app.beginRound({ kind: 'random' })
      expect(app.state.round!.secret!.wordId).not.toBe(wordId)
      playOut(app)
    }
  })

  it('explains why a round cannot start', () => {
    const app = setup()
    const ids = withPlayers(app, ['A', 'B', 'C'])
    expect(app.roundBlocker({ kind: 'random' })).toBeNull()
    expect(app.roundBlocker({ kind: 'playerGm', gmPlayerId: ids[0] })).toBe('needPlayers')
    expect(app.roundBlocker({ kind: 'playerGm', gmPlayerId: 'ghost' })).toBe('noGm')
    for (const id of [...app.state.selectedCategoryIds]) app.toggleCategory(id)
    expect(app.roundBlocker({ kind: 'random' })).toBe('noWords')
    expect(app.roundBlocker({ kind: 'outsideGm' })).toBeNull()
  })

  it('tells the between-rounds screen when the imposter count will be lowered', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ imposterCount: 3 })
    expect(app.clampedImposterCount({ kind: 'random' })).toBe(1)
    app.updateSettings({ imposterCount: 1 })
    expect(app.clampedImposterCount({ kind: 'random' })).toBeNull()
  })
})

describe('import', () => {
  it('applies a previewed import and makes its new categories playable', () => {
    const app = setup()
    const preview = app.previewImport({
      format: 'fennas-imposter', version: 1,
      categories: [{ id: 'jo', name: { en: 'Jordan' } }],
      words: [{ id: 'jo.mansaf', categoryId: 'jo', text: { en: 'Mansaf' } }],
    }, 'url')
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    app.applyImport(preview.plan)
    expect(app.state.customWords.map((w) => w.id)).toEqual(['jo.mansaf'])
    expect(app.state.selectedCategoryIds).toContain('jo')
  })
})
