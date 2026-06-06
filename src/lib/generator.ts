import type { Tile, Difficulty, Puzzle } from '../types'

const COLS: Tile['c'][] = ['r', 'b', 'a', 'k']

function randomInt(min: number, max: number): number {
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

function makeRun(diff: Difficulty): Tile[] {
  const len = diff === 'easy' ? 3 : diff === 'medium' ? randomInt(3, 4) : randomInt(3, 5)
  const c = COLS[randomInt(0, 3)]
  const start = randomInt(1, 14 - len)
  return Array.from({ length: len }, (_, i) => ({ n: start + i, c }))
}

function makeGroup(diff: Difficulty): Tile[] {
  const len = diff === 'easy' ? 3 : randomInt(3, 4)
  const n = randomInt(1, 13)
  const cols = shuffle([...COLS]).slice(0, len)
  return cols.map(c => ({ n, c }))
}

function tileKey(t: Tile): string {
  return `${t.n}_${t.c}`
}

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? randomInt(2, 3) : randomInt(3, 4)

  for (let attempt = 0; attempt < 50; attempt++) {
    const sets: Tile[][] = []
    const used = new Set<string>()
    let collision = false

    for (let i = 0; i < numSets; i++) {
      const tiles = Math.random() > 0.5 ? makeRun(diff) : makeGroup(diff)

      if (tiles.some(t => used.has(tileKey(t)))) {
        collision = true
        break
      }

      tiles.forEach(t => used.add(tileKey(t)))
      sets.push(tiles)
    }

    if (collision) continue

    return {
      id: crypto.randomUUID(),
      name: `${diff[0].toUpperCase()}${diff.slice(1)} Puzzle`,
      diff,
      rack: shuffle(sets.flat()),
      hint: '',
      generated: true,
    }
  }

  return null
}
