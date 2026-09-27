let context: AudioContext | null = null

/** Generated beeps, no audio files. iOS only allows audio after a tap, so call prime() from a tap handler. */
export function useSound(): { prime(): void; beep(): void } {
  function prime(): void {
    try {
      context ??= new AudioContext()
      void context.resume()
    } catch {
      context = null
    }
  }

  function beep(): void {
    const audio = context
    if (!audio) return
    const start = audio.currentTime
    ;[880, 660, 880].forEach((frequency, i) => {
      const t0 = start + i * 0.25
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(t0)
      oscillator.stop(t0 + 0.22)
    })
  }

  return { prime, beep }
}
