import type { Tile, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'

const COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeRun(len: number): Tile[] {
  const color = COLORS[rand(0, 3)]
  const start = rand(1, 14 - len)  // start + len - 1 <= 13
  return Array.from({ length: len }, (_, i) => ({ n: start + i, c: color }))
}

function makeGroup(len: number): Tile[] {
  const n = rand(1, 13)
  const colors = shuffle([...COLORS]).slice(0, len)
  return colors.map(c => ({ n, c }))
}

function makeSet(len: number): Tile[] {
  if (len > 4) return makeRun(len)  // only 4 colors, groups can't exceed 4 tiles
  return Math.random() > 0.5 ? makeRun(len) : makeGroup(len)
}

function tileKey(t: Tile): string {
  return `${t.n}:${t.c}`
}

function hasCollision(existing: Set<string>, candidate: Tile[]): boolean {
  return candidate.some(t => existing.has(tileKey(t)))
}

const CONFIGS: Record<Puzzle['diff'], { count: [number, number]; len: [number, number] }> = {
  easy:   { count: [2, 2], len: [3, 3] },
  medium: { count: [2, 3], len: [3, 4] },
  hard:   { count: [3, 4], len: [3, 5] },
}

export function generatePuzzle(diff: Puzzle['diff']): Puzzle {
  const { count, len } = CONFIGS[diff]

  for (let outer = 0; outer < 100; outer++) {
    const setCount = rand(count[0], count[1])
    const used = new Set<string>()
    const allTiles: Tile[] = []
    let ok = true

    for (let i = 0; i < setCount; i++) {
      let placed = false

      for (let attempt = 0; attempt < 20; attempt++) {
        const setLen = rand(len[0], len[1])
        const tiles = makeSet(setLen)

        if (!hasCollision(used, tiles) &&
            (isValidRun(tiles) || isValidGroup(tiles))) {
          tiles.forEach(t => used.add(tileKey(t)))
          allTiles.push(...tiles)
          placed = true
          break
        }
      }

      if (!placed) { ok = false; break }
    }

    if (!ok) continue

    return {
      id: crypto.randomUUID(),
      name: `${diff[0].toUpperCase()}${diff.slice(1)} Puzzle`,
      diff,
      sets: [],           // grid starts empty — all tiles are in the rack
      rack: shuffle(allTiles),
      hint: '',
      generated: true,
    }
  }

  // Unreachable in practice, but satisfies return type
  return {
    id: crypto.randomUUID(),
    name: 'Easy Puzzle',
    diff,
    sets: [],
    rack: shuffle([
      { n: 1, c: 'r' }, { n: 2, c: 'r' }, { n: 3, c: 'r' },
    ]),
    hint: '',
    generated: true,
  }
}
