import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'

// Verify: generateArchetype('run-to-group', 'extreme') → non-null Puzzle
// where solveBag([...grid.flat().filter(Boolean), ...rack]).solvable === true

export type ArchetypeType = 'run-to-group'

const ALL_COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

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

export interface ArchetypeResult {
  grid: Grid
  rack: Tile[]
  allTiles: Tile[]
}

// Type 1: N runs of length L → L groups of size N
// Board: (N-1) full runs; rack: all L tiles of the Nth color
// Partition A (valid): N runs of length L (L≥3)
// Partition B (valid): L groups of size N (N∈{3,4})
export function buildRunToGroup(diff: Difficulty): ArchetypeResult | null {
  const N = diff === 'hard' ? 3 : 4
  const L = diff === 'extreme' ? randomInt(4, 5) : randomInt(3, 4)

  const start = randomInt(1, 14 - L)
  const colors = shuffle([...ALL_COLORS]).slice(0, N) as Tile['c'][]

  const allTiles: Tile[] = []
  for (const c of colors)
    for (let v = start; v < start + L; v++)
      allTiles.push({ n: v, c })

  if (!solveBag(allTiles).solvable) return null

  const numCols = Math.max(10, L + 2)
  const numRows = (N - 1) + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))

  for (let i = 0; i < N - 1; i++)
    for (let col = 0; col < L; col++)
      grid[i][col] = { n: start + col, c: colors[i] }

  const rack: Tile[] = []
  for (let v = start; v < start + L; v++)
    rack.push({ n: v, c: colors[N - 1] })

  return { grid, rack, allTiles }
}
