import { describe, expect, it } from 'bun:test'
import type { RoundState, Secret, Settings } from './types'
import { seededRng } from './rng'
import { IllegalActionError, reduce, startRound, type StartRoundInput } from './round'

const settings = (over: Partial<Settings> = {}): Settings => ({
  imposterCount: 1,
  randomImposterCount: false,
  hints: true,
  showCategory: false,
  rotateStarter: false,
  wordSource: 'random',
  difficulty: 'easy',
  timer: { enabled: false, seconds: 180 },
  scoring: true,
  ...over,
})
const secret: Secret = { wordId: 'food.falafel', word: 'Falafel', hint: 'Fried', categoryName: 'Food' }
const players = ['p1', 'p2', 'p3', 'p4']

function start(over: Partial<StartRoundInput> = {}, seed = 1): RoundState {
  return startRound(
    {
      number: 1, lang: 'en', source: { kind: 'random' }, rosterIds: players, activePlayerIds: players,
      settings: settings(), secret, lastStarterId: null, ...over,
    },
    seededRng(seed),
  ).round
}
function revealAll(round: RoundState, now = 1_000): RoundState {
  let s = round
  for (let i = 0; i < round.participantIds.length; i++) s = reduce(s, { type: 'cardSeen', now })
  return s
}
const play = (r: RoundState, now = 2_000) => reduce(revealAll(r), { type: 'startPlaying', now })
const toVote = (r: RoundState) => reduce(play(r), { type: 'endDiscussion' })
const crewOf = (r: RoundState) => r.participantIds.find((id) => !r.imposterIds.includes(id))!

describe('startRound', () => {
  it('starts a random round dealing immediately, with its word', () => {
    const r = start()
    expect(r.phase).toBe('reveal')
    expect(r.secret).toEqual(secret)
    expect(r.participantIds).toEqual(players)
    expect(r.imposterIds).toHaveLength(1)
  })

  it('makes a Game Master round wait for the word before dealing', () => {
    const r = start({ source: { kind: 'outsideGm' }, secret: null })
    expect(r.phase).toBe('gmEntry')
    expect(r.secret).toBeNull()
    expect(reduce(r, { type: 'setSecret', secret }).phase).toBe('reveal')
  })

  it('never deals the player GM a card, never makes them imposter, never lets them start', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = start({ source: { kind: 'playerGm', gmPlayerId: 'p1' }, secret: null }, seed)
      expect(r.participantIds).toEqual(['p2', 'p3', 'p4'])
      expect(r.imposterIds).not.toContain('p1')
      expect(r.startingPlayerId).not.toBe('p1')
    }
  })

  it('refuses a round that a player GM would shrink below 3 participants', () => {
    expect(() =>
      start({ activePlayerIds: ['p1', 'p2', 'p3'], source: { kind: 'playerGm', gmPlayerId: 'p1' }, secret: null }),
    ).toThrow(IllegalActionError)
  })

  it('refuses a GM who is not an active player', () => {
    expect(() => start({ source: { kind: 'playerGm', gmPlayerId: 'ghost' }, secret: null })).toThrow(IllegalActionError)
  })

  it('treats a missing or unexpected word as a bug', () => {
    expect(() => start({ secret: null })).toThrow(IllegalActionError)
    expect(() => start({ source: { kind: 'outsideGm' }, secret })).toThrow(IllegalActionError)
  })

  it('remembers that the imposter count is a surprise in random-count mode', () => {
    expect(start({ settings: settings({ randomImposterCount: true }) }).settings.imposterCountHidden).toBe(true)
    expect(start().settings.imposterCountHidden).toBe(false)
  })

  it('keeps showing (or hiding) the category on the cards as the round started, even if Setup changes mid-deal', () => {
    expect(start({ settings: settings({ showCategory: true }) }).settings.showCategory).toBe(true)
    expect(start().settings.showCategory).toBe(false)
  })

  it('in take-turns mode, lets the player after the last starter start, whatever the dice say', () => {
    const turns = settings({ rotateStarter: true })
    for (let seed = 0; seed < 10; seed++) {
      expect(start({ settings: turns }, seed).startingPlayerId).toBe('p1')
      expect(start({ settings: turns, lastStarterId: 'p2' }, seed).startingPlayerId).toBe('p3')
      expect(start({ settings: turns, lastStarterId: 'p4' }, seed).startingPlayerId).toBe('p1')
    }
  })

  it('in take-turns mode, passes over a player Game Master', () => {
    const r = start({ settings: settings({ rotateStarter: true }), source: { kind: 'playerGm', gmPlayerId: 'p3' }, secret: null, lastStarterId: 'p2' })
    expect(r.startingPlayerId).toBe('p4')
  })
})

describe('reduce', () => {
  it('shows every participant exactly one card, then announces who starts', () => {
    let r = start()
    for (let i = 0; i < 3; i++) r = reduce(r, { type: 'cardSeen', now: 0 })
    expect(r.phase).toBe('reveal')
    expect(r.revealIndex).toBe(3)
    r = reduce(r, { type: 'cardSeen', now: 0 })
    expect(r.phase).toBe('starting')
  })

  it('starts the discussion only when the group taps "Start playing"', () => {
    expect(play(start()).phase).toBe('discussion')
  })

  it('starts the timer when play starts, not while the starter is being announced', () => {
    const timed = start({ settings: settings({ timer: { enabled: true, seconds: 120 } }) })
    const announced = revealAll(timed, 5_000)
    expect(announced.timerEndsAt).toBeNull()
    expect(reduce(announced, { type: 'startPlaying', now: 9_000 }).timerEndsAt).toBe(129_000)
    expect(play(start(), 9_000).timerEndsAt).toBeNull()
  })

  it('skips voting when scoring is off and just reveals', () => {
    const r = reduce(play(start({ settings: settings({ scoring: false }) })), { type: 'endDiscussion' })
    expect(r.phase).toBe('result')
    expect(r.outcome).toBeNull()
  })

  it('gives the win to the imposters when the group votes out a crew member', () => {
    const r = toVote(start())
    const next = reduce(r, { type: 'voteOut', playerId: crewOf(r) })
    expect(next.phase).toBe('result')
    expect(next.outcome).toBe('imposters')
  })

  it('gives the win to the imposters when the group votes out nobody', () => {
    const next = reduce(toVote(start()), { type: 'voteOut', playerId: null })
    expect(next.outcome).toBe('imposters')
    expect(next.votedOut).toEqual({ playerId: null })
  })

  it('gives a caught imposter one guess: right means imposters win, wrong means crew wins', () => {
    const r = toVote(start())
    const caught = reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] })
    expect(caught.phase).toBe('guess')
    expect(reduce(caught, { type: 'imposterGuess', correct: true }).outcome).toBe('imposters')
    expect(reduce(caught, { type: 'imposterGuess', correct: false }).outcome).toBe('crew')
  })

  it('rejects actions that are out of order, loudly', () => {
    const announced = revealAll(start())
    expect(() => reduce(announced, { type: 'cardSeen', now: 0 })).toThrow(IllegalActionError)
    expect(() => reduce(announced, { type: 'endDiscussion' })).toThrow(IllegalActionError)
    expect(() => reduce(play(start()), { type: 'startPlaying', now: 0 })).toThrow(IllegalActionError)
    expect(() => reduce(start(), { type: 'setSecret', secret })).toThrow(IllegalActionError)
    expect(() => reduce(toVote(start()), { type: 'voteOut', playerId: 'stranger' })).toThrow(IllegalActionError)
    const result = reduce(toVote(start()), { type: 'voteOut', playerId: null })
    expect(() => reduce(result, { type: 'endDiscussion' })).toThrow(IllegalActionError)
  })

  it('never mutates the previous state, which may already be persisted', () => {
    const r = start()
    const before = structuredClone(r)
    reduce(r, { type: 'cardSeen', now: 0 })
    expect(r).toEqual(before)
  })
})
