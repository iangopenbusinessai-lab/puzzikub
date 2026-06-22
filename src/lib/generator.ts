import type { Tile, Grid, Difficulty, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'
import { solve } from './solver'

const COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

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

function tileKey(t: Tile): string {
  return `${t.n}_${t.c}`
}

function makeRun(diff: Difficulty): Tile[] {
  const len =
    diff === 'easy'   ? randomInt(3, 4) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(4, 6)
  const c = COLORS[randomInt(0, 3)]
  const start = randomInt(1, 14 - len)
  return Array.from({ length: len }, (_, i) => ({ n: start + i, c }))
}

function makeGroup(): Tile[] {
  const n = randomInt(1, 13)
  const size = randomInt(3, 4)
  const cols = shuffle([...COLORS]).slice(0, size)
  return cols.map(c => ({ n, c }))
}

function buildSolutionSets(numSets: number, diff: Difficulty): Tile[][] | null {
  const used = new Set<string>()
  const sets: Tile[][] = []
  for (let i = 0; i < numSets; i++) {
    let placed = false
    for (let attempt = 0; attempt < 60; attempt++) {
      const wantRun = Math.random() < 0.5
      const tiles = wantRun ? makeRun(diff) : makeGroup()
      if (tiles.some(t => used.has(tileKey(t)))) continue
      if (!isValidRun(tiles) && !isValidGroup(tiles)) continue
      tiles.forEach(t => used.add(tileKey(t)))
      sets.push(tiles)
      placed = true
      break
    }
    if (!placed) return null
  }
  return sets
}

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 6)

  for (let attempt = 0; attempt < 20; attempt++) {
    const sets = buildSolutionSets(numSets, diff)
    if (!sets) continue

    const rack = shuffle(sets.flat())
    const emptyGrid: Grid = Array.from({ length: 6 }, () => Array(10).fill(null))
    const solveResult = solve(emptyGrid, rack, 600)
    if (!solveResult.solvable) continue

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      rack,
      hint: '',
      generated: true,
    }
  }

  return null
}
