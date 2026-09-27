import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'vue/compiler-sfc'

const COMMENT = 3 // @vue/compiler-core NodeTypes.COMMENT

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('component templates', () => {
  it('have no root-level comments (dev builds keep them, the root becomes a fragment, and <Transition mode="out-in"> hangs on a blank page)', () => {
    const offenders = vueFiles('src').filter((file) => {
      const root = parse(readFileSync(file, 'utf8')).descriptor.template?.ast
      return root?.children.some((node) => node.type === COMMENT) ?? false
    })
    expect(offenders).toEqual([])
  })
})
