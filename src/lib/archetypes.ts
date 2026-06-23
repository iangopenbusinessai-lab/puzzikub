import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'

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

// Type 1: N colors × L values tile universe.
// Board A = N full runs (one per row). Disrupt by removing K tiles into rack.
// Solution B = L groups of size N — same tiles, different structure.
// Rack tiles are mixed colors so the run-to-group transformation is non-obvious.
export function buildRunToGroup(diff: Difficulty): ArchetypeResult | null {
  const N = diff === 'hard' ? 3 : 4
  const L = diff === 'extreme' ? randomInt(4, 5) : randomInt(3, 4)
  const K = diff === 'extreme' ? randomInt(4, 6) : randomInt(2, 3)

  // Need enough removable slots: each run can lose at most L-2 tiles
  // Total removable = N × (L-2). Need K ≤ N×(L-2).
  if (K > N * (L - 2)) return null

  const start = randomInt(1, 14 - L)
  const colors = shuffle([...ALL_COLORS]).slice(0, N) as Tile['c'][]

  const allTiles: Tile[] = []
  for (const c of colors)
    for (let v = start; v < start + L; v++)
      allTiles.push({ n: v, c })

  if (!solveBag(allTiles).solvable) return null

  // Build full grid: N rows of runs
  const numCols = Math.max(10, L + 2)
  const numRows = N + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  for (let i = 0; i < N; i++)
    for (let col = 0; col < L; col++)
      grid[i][col] = { n: start + col, c: colors[i] }

  // Disruption: pick K positions to remove, each run retains ≥ 2 tiles
  const runRemaining = Array(N).fill(L)
  const positions = shuffle(
    Array.from({ length: N * L }, (_, idx) => ({ row: Math.floor(idx / L), col: idx % L }))
  )

  const removed: { row: number; col: number }[] = []
  for (const pos of positions) {
    if (removed.length >= K) break
    if (runRemaining[pos.row] > 2) {
      removed.push(pos)
      runRemaining[pos.row]--
    }
  }
  if (removed.length < K) return null

  // Apply disruptions
  const rack: Tile[] = []
  for (const { row, col } of removed) {
    rack.push(grid[row][col] as Tile)
    grid[row][col] = null
  }

  return { grid, rack: shuffle(rack), allTiles }
}
