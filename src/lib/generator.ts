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

function generateRun(len: number): Tile[] {
  const color = COLORS[rand(0, 3)]
  const start = rand(1, 14 - len) // start + len - 1 <= 13
  return Array.from({ length: len }, (_, i) => ({ n: start + i, c: color }))
}

function generateGroup(len: number): Tile[] {
  const n = rand(1, 13)
  const colors = shuffle([...COLORS]).slice(0, len)
  return colors.map(c => ({ n, c }))
}

function tileKey(t: Tile): string {
  return `${t.n}:${t.c}`
}

const CONFIGS: Record<Puzzle['diff'], { sets: [number, number]; tiles: [number, number] }> = {
  easy:   { sets: [2, 2], tiles: [3, 3] },
  medium: { sets: [2, 3], tiles: [3, 4] },
  hard:   { sets: [3, 4], tiles: [3, 5] },
}

export function generatePuzzle(diff: Puzzle['diff']): Puzzle {
  const { sets: setRange, tiles: tileRange } = CONFIGS[diff]

  for (let attempt = 0; attempt < 100; attempt++) {
    const setCount = rand(setRange[0], setRange[1])
    const used = new Set<string>()
    const solution: Tile[][] = []
    let success = true

    for (let i = 0; i < setCount; i++) {
      let placed = false

      for (let retry = 0; retry < 20; retry++) {
        const len = rand(tileRange[0], tileRange[1])
        // Groups can't exceed 4 tiles (only 4 colors exist)
        const tiles = len > 4 || Math.random() > 0.5
          ? generateRun(len)
          : generateGroup(len)

        if (
          !tiles.some(t => used.has(tileKey(t))) &&
          (isValidRun(tiles) || isValidGroup(tiles))
        ) {
          tiles.forEach(t => used.add(tileKey(t)))
          solution.push(tiles)
          placed = true
          break
        }
      }

      if (!placed) { success = false; break }
    }

    if (!success) continue

    return {
      id: crypto.randomUUID(),
      name: `${diff[0].toUpperCase()}${diff.slice(1)} Puzzle`,
      diff,
      sets: [],           // grid starts empty — all tiles go to the rack
      rack: shuffle(solution.flat()),
      hint: '',
      generated: true,
    }
  }

  // Fallback: unreachable in practice
  return {
    id: crypto.randomUUID(),
    name: `${diff[0].toUpperCase()}${diff.slice(1)} Puzzle`,
    diff,
    sets: [],
    rack: shuffle([{ n: 1, c: 'r' }, { n: 2, c: 'r' }, { n: 3, c: 'r' }]),
    hint: '',
    generated: true,
  }
}
