import { describe, expect, it } from 'bun:test'
import { timerView } from './useTimer'

describe('timerView', () => {
  it('is inactive when the round has no timer', () => {
    expect(timerView(null, 0)).toEqual({ active: false, secondsLeft: 0, ended: false })
  })

  it('counts from the stored end time, so a reload resumes instead of restarting', () => {
    expect(timerView(185_000, 5_000)).toEqual({ active: true, secondsLeft: 180, ended: false })
  })

  it('rounds up so it never shows 0:00 while time remains', () => {
    expect(timerView(10_000, 9_001).secondsLeft).toBe(1)
  })

  it('is ended at and after the end time (a reload after time-up shows "Time\'s up")', () => {
    expect(timerView(10_000, 10_000).ended).toBe(true)
    expect(timerView(10_000, 99_000)).toEqual({ active: true, secondsLeft: 0, ended: true })
  })
})
