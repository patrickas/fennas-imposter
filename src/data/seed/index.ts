import type { Category, Localized, Word } from '../../engine/types'
import type { SeedPack } from './types'
import { food } from './packs/food'
import { animals } from './packs/animals'
import { home } from './packs/home'
import { jobs } from './packs/jobs'
import { places } from './packs/places'
import { sports } from './packs/sports'
import { nature } from './packs/nature'
import { transport } from './packs/transport'
import { clothes } from './packs/clothes'
import { body } from './packs/body'
import { fruitVeg } from './packs/fruit-veg'
import { school } from './packs/school'
import { tech } from './packs/tech'
import { music } from './packs/music'
import { occasions } from './packs/occasions'
import { world } from './packs/world'
import { fantasy } from './packs/fantasy'
import { tools } from './packs/tools'
import { levant } from './packs/levant'
import { levantFood } from './packs/levant-food'

export const SEED_PACKS: readonly SeedPack[] = [
  food, animals, home, jobs, places, sports, nature, transport, clothes,
  body, fruitVeg, school, tech, music, occasions, world, fantasy, tools,
  levant, levantFood,
]

function localized(en: string | null, ar: string | null): Localized {
  const out: Localized = {}
  if (en) out.en = en
  if (ar) out.ar = ar
  return out
}

export const SEED_CATEGORIES: readonly Category[] = SEED_PACKS.map((p) => ({ id: p.id, name: p.name, builtIn: true }))

export const SEED_WORDS: readonly Word[] = SEED_PACKS.flatMap((p) =>
  p.rows.map(([slug, en, ar, hintEn, hintAr]) => ({
    id: `${p.id}.${slug}`,
    categoryId: p.id,
    builtIn: true,
    text: localized(en, ar),
    hint: localized(hintEn, hintAr),
  })),
)

export const SEED_CATEGORY_IDS: ReadonlySet<string> = new Set(SEED_CATEGORIES.map((c) => c.id))
export const SEED_WORD_IDS: ReadonlySet<string> = new Set(SEED_WORDS.map((w) => w.id))
