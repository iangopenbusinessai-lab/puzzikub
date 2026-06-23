import type { Tile, Grid, Difficulty, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'

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

function layOnGrid(sets: Tile[][]): Grid {
  const maxLen = Math.max(...sets.map(s => s.length))
  const numCols = Math.max(10, maxLen + 2)
  const numRows = sets.length + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  sets.forEach((set, r) => {
    set.forEach((tile, c) => { grid[r][c] = tile })
  })
  return grid
}

function legalExtensions(sets: Tile[][], used: Set<string>): Tile[] {
  const extensions: Tile[] = []
  for (const set of sets) {
    if (isValidRun(set)) {
      const minN = Math.min(...set.map(t => t.n))
      const maxN = Math.max(...set.map(t => t.n))
      const c = set[0].c
      if (minN > 1) {
        const t: Tile = { n: minN - 1, c }
        if (!used.has(tileKey(t))) extensions.push(t)
      }
      if (maxN < 13) {
        const t: Tile = { n: maxN + 1, c }
        if (!used.has(tileKey(t))) extensions.push(t)
      }
    } else if (isValidGroup(set)) {
      const n = set[0].n
      const usedColors = new Set(set.map(t => t.c))
      for (const c of COLORS) {
        if (!usedColors.has(c)) {
          const t: Tile = { n, c }
          if (!used.has(tileKey(t))) extensions.push(t)
        }
      }
    }
  }
  return extensions
}

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 6)
  const numExtra =
    diff === 'easy'   ? randomInt(2, 3) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(5, 8)

  for (let attempt = 0; attempt < 20; attempt++) {
    const sets = buildSolutionSets(numSets, diff)
    if (!sets) continue

    const used = new Set<string>(sets.flat().map(tileKey))
    const extensions = legalExtensions(sets, used)
    if (extensions.length < numExtra) continue

    const rack = shuffle(extensions).slice(0, numExtra)
    const grid = layOnGrid(sets)

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid,
      rack,
      optimalMoves: numExtra,
      generated: true,
    }
  }

  return null
}
