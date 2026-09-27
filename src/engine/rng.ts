export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
}

/** mulberry32 — small, fast, deterministic. Tests only; the app uses cryptoRng. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

export const cryptoRng: Rng = {
  next: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
}

export function randomInt(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`randomInt: invalid range [${min}, ${max}]`)
  }
  return min + Math.floor(rng.next() * (max - min + 1))
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: empty list')
  return items[randomInt(rng, 0, items.length - 1)]
}

/** k distinct items via a partial Fisher–Yates shuffle. */
export function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  if (k < 0 || k > items.length) throw new Error(`sample: cannot take ${k} of ${items.length}`)
  const copy = [...items]
  for (let i = 0; i < k; i++) {
    const j = randomInt(rng, i, copy.length - 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, k)
}

/** RFC 4122 v4 UUID from getRandomValues (works on plain-http LAN dev URLs too). */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
