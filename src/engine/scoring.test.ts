import { describe, expect, it } from 'bun:test'
import type { RoundState, Settings, Source } from './types'
import { seededRng } from './rng'
import { reduce, startRound } from './round'
import { scoreDeltas } from './scoring'

const secret = { wordId: 'w', word: 'Falafel', hint: null, categoryName: 'Food' }

function votingRound(opts: { scoring?: boolean; source?: Source; imposters?: number } = {}): RoundState {
  const settings: Settings = {
    imposterCount: opts.imposters ?? 1, randomImposterCount: false, hints: true,
    timer: { enabled: false, seconds: 180 }, scoring: opts.scoring ?? true,
  }
  const source = opts.source ?? { kind: 'random' }
  let r = startRound(
    { number: 1, lang: 'en', source, activePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'], settings, secret: source.kind === 'random' ? secret : null },
    seededRng(11),
  ).round
  if (r.phase === 'gmEntry') r = reduce(r, { type: 'setSecret', secret })
  for (let i = 0; i < r.participantIds.length; i++) r = reduce(r, { type: 'cardSeen', now: 0 })
  return reduce(reduce(r, { type: 'startPlaying', now: 0 }), { type: 'endDiscussion' })
}
const crew = (r: RoundState) => r.participantIds.filter((id) => !r.imposterIds.includes(id))

describe('scoreDeltas', () => {
  it('crew catches the imposter who then misses the word: every crew member +1, imposter nothing', () => {
    const r = votingRound()
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: false })
    const expected = Object.fromEntries(crew(r).map((id) => [id, 1]))
    expect(scoreDeltas(end)).toEqual(expected)
  })

  it('caught imposter guesses the word: every imposter +2', () => {
    const r = votingRound({ imposters: 2 })
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: true })
    expect(scoreDeltas(end)).toEqual(Object.fromEntries(r.imposterIds.map((id) => [id, 2])))
  })

  it('wrong player voted out: every imposter +2', () => {
    const r = votingRound()
    const end = reduce(r, { type: 'voteOut', playerId: crew(r)[0] })
    expect(scoreDeltas(end)).toEqual({ [r.imposterIds[0]]: 2 })
  })

  it('nobody voted out: every imposter +2', () => {
    const r = votingRound()
    expect(scoreDeltas(reduce(r, { type: 'voteOut', playerId: null }))).toEqual({ [r.imposterIds[0]]: 2 })
  })

  it('never gives the Game Master points', () => {
    const r = votingRound({ source: { kind: 'playerGm', gmPlayerId: 'p1' } })
    const end = reduce(reduce(r, { type: 'voteOut', playerId: r.imposterIds[0] }), { type: 'imposterGuess', correct: false })
    expect(Object.keys(scoreDeltas(end))).not.toContain('p1')
  })

  it('gives nothing when scoring is off or the round is not finished', () => {
    const noScoring = votingRound({ scoring: false })
    expect(noScoring.phase).toBe('result')
    expect(scoreDeltas(noScoring)).toEqual({})
    expect(scoreDeltas(votingRound())).toEqual({})
  })
})
