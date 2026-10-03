import { describe, expect, it } from 'bun:test'
import { computed } from 'vue'
import { seededRng } from '../engine/rng'
import { STORAGE_KEY, memoryStorage, type StorageLike } from '../data/storage'
import { KEY_WORDS, LICENSE_KEY, magicWord } from '../data/license'
import { TEST_SECRETS, testSecret } from '../data/testWord'
import { SEED_WORDS } from '../data/seed'
import { createAppStore, type AppStore } from './useApp'

/** A phone that already paid, so tests about the game itself never meet the free limit. */
function paidStorage(): StorageLike & { dump(): Record<string, string> } {
  return memoryStorage({ [LICENSE_KEY]: JSON.stringify({ secret: 0, unlocked: true, owner: false, day: '', used: 0 }) })
}
function setup(storage: StorageLike | null = paidStorage(), seed = 1, devTools = false): AppStore {
  let n = 0
  return createAppStore({ storage, rng: seededRng(seed), now: () => 1_000, newId: () => `id${++n}`, devTools })
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
    const storage = paidStorage()
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
  it('deleting one GM word filed under a built-in category keeps the running round, and it is never dealt again', () => {
    const app = setup()
    withPlayers(app)
    for (const id of [...app.state.selectedCategoryIds]) if (id !== 'food') app.toggleCategory(id)
    app.beginRound({ kind: 'outsideGm' })
    app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { existingId: 'food' } })
    const wordId = app.state.round!.secret!.wordId
    app.deleteCustomWord(wordId)
    expect(app.state.round!.secret!.word).toBe('Mansaf')
    expect(app.state.selectedCategoryIds).toContain('food')
    playOut(app)
    for (let i = 0; i < 30; i++) {
      app.beginRound({ kind: 'random' })
      expect(app.state.round!.secret!.wordId).not.toBe(wordId)
      playOut(app)
    }
  })

  it("uses the Game Master's typed hint for the round even when the word already exists with its own hint", () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    expect(app.submitGmWord({ lang: 'en', word: 'Falafel', hint: 'Crispy', category: { existingId: 'food' } })).toEqual([])
    expect(app.state.round!.secret).toMatchObject({ wordId: 'food.falafel', word: 'Falafel', hint: 'Crispy' })
  })

  it('locks the language while a round is in progress', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(() => app.setLanguage('ar')).toThrow()
    expect(app.state.language).toBe('en')
  })

  it('applies scores exactly once, even if the app reloads on the result screen', () => {
    const storage = paidStorage()
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
    expect(reloaded.state.session!.history).toHaveLength(1)
    expect(() => reloaded.dispatch({ type: 'imposterGuess', correct: true })).toThrow()

    for (const id of r.participantIds) {
      expect(scores[id].points).toBe(r.imposterIds.includes(id) ? 0 : 1)
    }
  })

  it('keeps a history of finished rounds for the stats screen; a new game starts it over', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ scoring: true })
    app.beginRound({ kind: 'random' })
    revealAll(app)
    app.dispatch({ type: 'startPlaying', now: 0 })
    app.dispatch({ type: 'endDiscussion' })
    const first = app.state.round!
    app.dispatch({ type: 'voteOut', playerId: first.imposterIds[0] })
    app.dispatch({ type: 'imposterGuess', correct: false })
    app.finishRound()
    app.updateSettings({ scoring: false })
    app.beginRound({ kind: 'random' })
    const second = app.state.round!
    app.abandonRound() // a round left early is not a played round
    app.beginRound({ kind: 'random' })
    const third = app.state.round!
    playOut(app)

    expect(second.secret!.word).not.toBe(third.secret!.word)
    expect(app.state.session!.history).toEqual([
      { number: 1, word: first.secret!.word, imposterIds: first.imposterIds, starterId: first.startingPlayerId, outcome: 'crew' },
      // Without scoring nobody votes, so nobody wins.
      { number: 2, word: third.secret!.word, imposterIds: third.imposterIds, starterId: third.startingPlayerId, outcome: null },
    ])

    app.endSession()
    app.beginRound({ kind: 'random' })
    playOut(app)
    expect(app.state.session!.history).toHaveLength(1)
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

  it('never deals a hard round on Easy (the default)', () => {
    const app = setup()
    withPlayers(app)
    const hardIds = new Set(SEED_WORDS.filter((w) => w.level === 'hard').map((w) => w.id))
    for (let i = 0; i < 30; i++) {
      app.beginRound({ kind: 'random' })
      const secret = app.state.round!.secret!
      expect(secret.level).toBe('easy')
      expect(hardIds.has(secret.wordId), secret.wordId).toBe(false)
      expect(secret.hintWhy).toBeUndefined()
      playOut(app)
    }
  })

  it('deals only hard rounds on Hard: hard words with their hint, or easy words with their subtle hint', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ difficulty: 'hard' })
    const byId = new Map(SEED_WORDS.map((w) => [w.id, w]))
    const kinds = new Set<string>()
    for (let i = 0; i < 30; i++) {
      app.beginRound({ kind: 'random' })
      const secret = app.state.round!.secret!
      const word = byId.get(secret.wordId)!
      expect(secret.level).toBe('hard')
      if (word.level === 'hard') {
        kinds.add('hardWord')
        expect(secret.hint).toBe(word.hint.en!)
      } else {
        kinds.add('subtle')
        expect(secret.hint).toBe(word.subtle!.hint.en!)
        expect(secret.hintWhy).toBe(word.subtle!.why.en!)
      }
      playOut(app)
    }
    expect([...kinds].sort()).toEqual(['hardWord', 'subtle'])
  })

  it('mixes easy and hard rounds on Random', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ difficulty: 'random' })
    const levels = new Set<string | undefined>()
    for (let i = 0; i < 20; i++) {
      app.beginRound({ kind: 'random' })
      levels.add(app.state.round!.secret!.level)
      playOut(app)
    }
    expect([...levels].sort()).toEqual(['easy', 'hard'])
  })

  it('plays an easy round on Hard when the selected categories have nothing hard, and says so on the badge', () => {
    const app = setup()
    withPlayers(app)
    app.beginRound({ kind: 'outsideGm' })
    app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: 'Jameed', category: { newName: 'Jordan' } })
    expect(app.state.round!.secret!.level).toBeUndefined() // the Game Master picked the word: no level
    playOut(app)
    const jordan = app.state.customCategories[0].id
    for (const id of [...app.state.selectedCategoryIds]) if (id !== jordan) app.toggleCategory(id)
    app.updateSettings({ difficulty: 'hard' })
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.secret).toMatchObject({ word: 'Mansaf', level: 'easy', hint: 'Jameed' })
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

  // Players felt the random starter kept landing on the same people; by default everyone gets a turn instead.
  it('by default lets players take turns to start, in list order, looping back to the first', () => {
    const app = setup()
    const ids = withPlayers(app)
    const starters: string[] = []
    for (let i = 0; i < 6; i++) {
      app.beginRound({ kind: 'random' })
      starters.push(app.state.round!.startingPlayerId)
      playOut(app)
    }
    expect(starters).toEqual([ids[0], ids[1], ids[2], ids[3], ids[0], ids[1]])
  })

  it('keeps the turn when a round is left early, remembers it after a reload, and starts over for a new game', () => {
    const storage = paidStorage()
    const app = setup(storage)
    const ids = withPlayers(app)
    app.beginRound({ kind: 'random' })
    playOut(app) // ids[0] started
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.startingPlayerId).toBe(ids[1])
    app.abandonRound()
    const reloaded = setup(storage)
    reloaded.beginRound({ kind: 'random' })
    expect(reloaded.state.round!.startingPlayerId).toBe(ids[1])
    playOut(reloaded)
    reloaded.endSession()
    reloaded.beginRound({ kind: 'random' })
    expect(reloaded.state.round!.startingPlayerId).toBe(ids[0])
  })

  it('never gives a player Game Master the turn to start, and moves on to the next player', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.beginRound({ kind: 'random' })
    playOut(app) // ids[0] started
    app.beginRound({ kind: 'playerGm', gmPlayerId: ids[1] })
    app.submitGmWord({ lang: 'en', word: 'Mansaf', hint: '', category: { existingId: 'food' } })
    expect(app.state.round!.startingPlayerId).toBe(ids[2])
  })

  it('picks the starter at random when taking turns is switched off', () => {
    const app = setup()
    withPlayers(app)
    app.updateSettings({ rotateStarter: false })
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      app.beginRound({ kind: 'random' })
      seen.add(app.state.round!.startingPlayerId)
      app.abandonRound()
    }
    expect(seen.size).toBe(4) // with turns this would stay on the first player, since abandoned rounds keep the turn
  })

  // Where the word comes from is a setting now, not a per-round pick that fell back to "random" every round.
  it('remembers where the word comes from and who the Game Master is, even after a reload', () => {
    const storage = paidStorage()
    const app = setup(storage)
    const ids = withPlayers(app)
    expect(app.roundSource()).toEqual({ kind: 'random' })
    app.updateSettings({ wordSource: 'playerGm' })
    app.setGameMaster(ids[2])
    const reloaded = setup(storage)
    expect(reloaded.roundSource()).toEqual({ kind: 'playerGm', gmPlayerId: ids[2] })
    reloaded.updateSettings({ wordSource: 'outsideGm' })
    expect(reloaded.roundSource()).toEqual({ kind: 'outsideGm' })
  })

  it('makes the first playing player Game Master until one is chosen, and while the chosen one sits out', () => {
    const app = setup()
    const ids = withPlayers(app)
    app.updateSettings({ wordSource: 'playerGm' })
    expect(app.roundSource()).toEqual({ kind: 'playerGm', gmPlayerId: ids[0] })
    app.setGameMaster(ids[1])
    app.setActive(ids[1], false)
    expect(app.roundSource()).toEqual({ kind: 'playerGm', gmPlayerId: ids[0] })
    app.setActive(ids[1], true)
    expect(app.roundSource()).toEqual({ kind: 'playerGm', gmPlayerId: ids[1] })
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
  it('ticks imported players as playing, like players typed in by hand', () => {
    const app = setup()
    const preview = app.previewImport({
      format: 'fennas-imposter', version: 1, categories: [], words: [], players: [{ name: 'Rami' }, { name: 'Lina' }],
    }, 'file')
    if (!preview.ok) throw new Error('preview failed')
    app.applyImport(preview.plan)
    expect(app.state.activePlayerIds).toEqual(app.state.players.map((p) => p.id))
    expect(app.state.players).toHaveLength(2)
  })

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

describe('test mode (dev server only)', () => {
  it('is on by default on the dev server, so a fresh dev session deals the placeholder word straight away', () => {
    const app = setup(paidStorage(), 1, true)
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.secret).toEqual(testSecret('en', 'easy'))
  })

  it('can be switched off on the dev server to play real words', () => {
    const app = setup(paidStorage(), 1, true)
    withPlayers(app)
    app.setTestMode(false)
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.secret!.wordId).not.toBe(TEST_SECRETS.en.wordId)
  })

  it('always deals the same fixed word, without using up the word history, so the UI can be tried again and again', () => {
    const app = setup(paidStorage(), 1, true)
    withPlayers(app)
    app.setTestMode(true)
    for (const id of [...app.state.selectedCategoryIds]) app.toggleCategory(id) // works even with nothing selected
    expect(app.roundBlocker({ kind: 'random' })).toBeNull()
    for (let i = 0; i < 3; i++) {
      app.beginRound({ kind: 'random' })
      expect(app.state.round!.secret).toEqual(testSecret('en', 'easy'))
      playOut(app)
    }
    expect(app.state.usedWordIds).toEqual({ en: [], ar: [] })
  })

  it('uses the Arabic test word in Arabic rounds', () => {
    const app = setup(paidStorage(), 1, true)
    withPlayers(app)
    app.setTestMode(true)
    app.setLanguage('ar')
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.secret).toEqual(testSecret('ar', 'easy'))
  })

  it('deals both kinds of hard round on Hard, so the badge and the explanation can be tried', () => {
    const app = setup(paidStorage(), 1, true)
    withPlayers(app)
    app.updateSettings({ difficulty: 'hard' })
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      app.beginRound({ kind: 'random' })
      const secret = app.state.round!.secret!
      expect(secret.level).toBe('hard')
      seen.add(secret.hintWhy ? 'subtle' : 'hardWord')
      playOut(app)
    }
    expect([...seen].sort()).toEqual(['hardWord', 'subtle'])
    expect(app.state.usedWordIds).toEqual({ en: [], ar: [] })
  })

  it('is ignored outside the dev server, so real players always get real words', () => {
    const app = setup(paidStorage(), 1, false)
    withPlayers(app)
    app.setTestMode(true)
    app.beginRound({ kind: 'random' })
    expect(app.state.round!.secret!.wordId).not.toBe(TEST_SECRETS.en.wordId)
  })
})

describe('free version (paid-unlock spec)', () => {
  const EVENING = new Date(2026, 9, 3, 20, 0).getTime()
  const NEXT_MORNING = new Date(2026, 9, 4, 9, 0).getTime()

  function freeApp(storage: StorageLike | null = memoryStorage(), clock = { now: EVENING }, devTools = false): AppStore {
    let n = 0
    return createAppStore({ storage, rng: seededRng(1), now: () => clock.now, newId: () => `id${++n}`, devTools })
  }
  function storedLicense(storage: { dump(): Record<string, string> }) {
    return JSON.parse(storage.dump()[LICENSE_KEY])
  }
  function wrongMagicWord(app: AppStore): string {
    const mine = magicWord(KEY_WORDS.indexOf(app.secretWord.value))
    return KEY_WORDS.find((w) => w !== mine)!
  }

  it('plays 2 rounds a day, counting a round when it is dealt, then blocks until the next day', () => {
    const clock = { now: EVENING }
    const app = freeApp(memoryStorage(), clock)
    withPlayers(app)
    expect(app.freeRoundsLeft()).toBe(2)
    app.beginRound({ kind: 'random' })
    playOut(app)
    app.beginRound({ kind: 'random' })
    app.abandonRound() // the cards were dealt, so it counts
    expect(app.freeRoundsLeft()).toBe(0)
    expect(app.roundBlocker({ kind: 'random' })).toBe('locked')
    expect(app.roundBlocker({ kind: 'outsideGm' })).toBe('locked')
    expect(() => app.beginRound({ kind: 'random' })).toThrow(/locked/)
    clock.now = NEXT_MORNING
    expect(app.freeRoundsLeft()).toBe(2)
    expect(app.roundBlocker({ kind: 'random' })).toBeNull()
  })

  it("a screen left open overnight offers the new day's rounds once the app is back in front", () => {
    const clock = { now: EVENING }
    const spent = JSON.stringify({ secret: 0, unlocked: false, owner: false, day: '2026-10-03', used: 2 })
    const app = freeApp(memoryStorage({ [LICENSE_KEY]: spent }), clock)
    withPlayers(app)
    const shown = computed(() => app.roundBlocker({ kind: 'random' })) // what Between rounds keeps on screen
    expect(shown.value).toBe('locked')
    clock.now = NEXT_MORNING
    app.recheckDay() // what the app does when it comes back to the front
    expect(shown.value).toBeNull()
  })

  it('remembers the count after a reload, and a reload mid-round neither counts it again nor gives it back', () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    withPlayers(app)
    app.beginRound({ kind: 'random' })
    const reloaded = freeApp(storage)
    expect(reloaded.state.round).not.toBeNull()
    expect(reloaded.freeRoundsLeft()).toBe(1)
    playOut(reloaded)
    reloaded.beginRound({ kind: 'random' })
    playOut(reloaded)
    expect(freeApp(storage).roundBlocker({ kind: 'random' })).toBe('locked')
  })

  it('shows the other reasons first, since unlocking would not help a round that cannot start anyway', () => {
    const spent = JSON.stringify({ secret: 0, unlocked: false, owner: false, day: '2026-10-03', used: 2 })
    const app = freeApp(memoryStorage({ [LICENSE_KEY]: spent }))
    withPlayers(app, ['Rami', 'Lina'])
    expect(app.roundBlocker({ kind: 'random' })).toBe('needPlayers')
  })

  it('never blocks or counts on an unlocked phone', () => {
    const storage = paidStorage()
    const app = freeApp(storage)
    withPlayers(app)
    for (let i = 0; i < 4; i++) {
      expect(app.roundBlocker({ kind: 'random' })).toBeNull()
      app.beginRound({ kind: 'random' })
      playOut(app)
    }
    expect(storedLicense(storage)).toMatchObject({ day: '', used: 0 })
  })

  it('never blocks on the dev server, so the UI can be tried again and again', () => {
    const app = freeApp(memoryStorage(), { now: EVENING }, true)
    withPlayers(app)
    for (let i = 0; i < 3; i++) {
      expect(app.roundBlocker({ kind: 'random' })).toBeNull()
      app.beginRound({ kind: 'random' })
      playOut(app)
    }
  })

  it('keeps the unlock when the main save is damaged and reset', () => {
    const paid = JSON.stringify({ secret: 7, unlocked: true, owner: false, day: '', used: 0 })
    const app = freeApp(memoryStorage({ [STORAGE_KEY]: '{damaged', [LICENSE_KEY]: paid }))
    expect(app.meta.status).toBe('corrupt')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.secretWord.value).toBe(KEY_WORDS[7])
  })

  it("unlocks only with this phone's magic word, typed any way, and stays unlocked after a reload", () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    expect(app.unlock(app.secretWord.value)).toBe('wrong') // the word on the customer's own screen is not the key
    expect(app.unlock(wrongMagicWord(app))).toBe('wrong') // a key bought for a different phone
    expect(app.unlock('')).toBe('wrong')
    expect(app.isUnlocked.value).toBe(false)
    const magic = magicWord(KEY_WORDS.indexOf(app.secretWord.value))
    expect(app.unlock(`  ${magic.toUpperCase()} `)).toBe('unlocked')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.isOwner.value).toBe(false)
    const reloaded = freeApp(storage)
    expect(reloaded.isUnlocked.value).toBe(true)
    expect(reloaded.secretWord.value).toBe(app.secretWord.value)
  })

  it("the owner password makes the phone Alex's key maker", () => {
    const storage = memoryStorage()
    const app = freeApp(storage)
    expect(app.unlock('Wrong Horse Battery Staple')).toBe('owner')
    expect(app.isUnlocked.value).toBe(true)
    expect(app.isOwner.value).toBe(true)
    expect(freeApp(storage).isOwner.value).toBe(true)
    expect(app.makeKey(KEY_WORDS[42].toLowerCase())).toBe(magicWord(42))
    expect(app.makeKey('not one of them')).toBeNull()
  })

  it('still shows a secret word and unlocks for the session when storage is blocked (private tab)', () => {
    const app = freeApp(null)
    expect(KEY_WORDS).toContain(app.secretWord.value)
    expect(app.unlock(magicWord(KEY_WORDS.indexOf(app.secretWord.value)))).toBe('unlocked')
    expect(app.isUnlocked.value).toBe(true)
  })
})
