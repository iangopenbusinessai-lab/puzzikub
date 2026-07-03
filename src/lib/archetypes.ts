import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'
import { isValidRun, isValidGroup, validateGrid } from './validator'

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

// Type 1: dual-block collapse. Board = N complete runs (one color each) over L
// consecutive values, ZERO gaps — valid both as N runs (rows) and L groups
// (columns). Rack = a STRICT SUBSET of a 4th color's tiles inside the block's
// value range: wrong color for every run (can't extend), no groups on the board
// yet (can't complete), so the only home is a group the player builds by
// disassembling the runs. Every candidate is gated on validateGrid, solveBag,
// and !isTrivial before it ships.
export function buildRunToGroup(diff: Difficulty): ArchetypeResult | null {
  const N = 3
  const L = diff === 'easy' ? 3 : diff === 'medium' ? 4 : diff === 'hard' ? 5 : 6
  const subsetSize = diff === 'easy' ? 1 : diff === 'medium' ? randomInt(1, 2)
    : diff === 'hard' ? randomInt(2, 3) : randomInt(3, Math.min(4, L))

  const start = randomInt(1, 14 - L)
  const allColors = shuffle([...ALL_COLORS]) as Tile['c'][]
  const boardColors = allColors.slice(0, N) as Tile['c'][]
  const rackColor = allColors[N] as Tile['c']

  // Board: N complete runs, one per boardColor, ZERO gaps.
  const numCols = Math.max(10, L + 2)
  const numRows = N + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  for (let i = 0; i < N; i++)
    for (let col = 0; col < L; col++)
      grid[i][col] = { n: start + col, c: boardColors[i] }

  // Sanity check: board must already be fully valid before any rack
  // is considered.
  if (!validateGrid(grid)) return null

  // Rack: a STRICT SUBSET of rackColor's tiles within the block's
  // value range — NOT all L of them (that would be a free-standing
  // valid run the player could place without touching the board).
  const allRackCandidates = Array.from({ length: L }, (_, i) => ({
    n: start + i, c: rackColor,
  }))
  const rack = shuffle(allRackCandidates).slice(0, subsetSize)

  // Gate 1: rack must not form a valid set alone (guaranteed here
  // since subsetSize < 3 for easy/medium, but verify anyway for
  // hard/extreme where subsetSize can reach 3-4).
  if (formsValidSetAlone(rack)) return null

  // Gate 2: full solvability check on board + rack combined.
  const boardTiles = grid.flat().filter((t): t is Tile => t !== null)
  const allTiles = [...boardTiles, ...rack]
  if (!solveBag(allTiles).solvable) return null

  // Gate 3: non-triviality — the real check.
  if (isTrivial(grid, rack)) return null

  return { grid, rack: shuffle(rack), allTiles }
}

// ---------------------------------------------------------------------------
// Trivial-puzzle gate helpers (used by the generator to reject fill-in-the-
// blank constructions). Added post-audit; see CLAUDE.md ENGINE ARCHITECTURE.
// ---------------------------------------------------------------------------

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size > arr.length) return []
  if (size === arr.length) return [arr]
  if (size === 1) return arr.map(x => [x])
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, size - 1).map(c => [first, ...c])
  const withoutFirst = getCombinations(rest, size)
  return [...withFirst, ...withoutFirst]
}

export function formsValidSetAlone(tiles: Tile[]): boolean {
  if (isValidRun(tiles) || isValidGroup(tiles)) return true
  for (let size = 3; size <= tiles.length; size++) {
    for (const combo of getCombinations(tiles, size)) {
      if (isValidRun(combo) || isValidGroup(combo)) return true
    }
  }
  return false
}

// Tries placing every rack tile at its "obvious" spot — extending a
// run endpoint (same color, adjacent value) or completing a group
// (same value, missing color) — with NO board tile relocation.
// Returns the resulting grid if every rack tile found an obvious home,
// or null if any rack tile has no obvious placement (meaning at least
// SOME thought is required, though this alone doesn't guarantee hard).
export function attemptNaiveReinsertion(board: Grid, rack: Tile[]): Grid | null {
  const grid = board.map(row => [...row])
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  for (const tile of rack) {
    let placed = false

    // Try extending a run: scan each row for a contiguous run of the
    // same color where this tile's value is exactly one below the
    // leftmost or one above the rightmost tile, with an adjacent empty
    // cell available.
    for (let r = 0; r < rows && !placed; r++) {
      const rowTiles: { t: Tile; c: number }[] = []
      for (let c = 0; c < cols; c++) {
        const t = grid[r][c]
        if (t) rowTiles.push({ t, c })
      }
      if (rowTiles.length === 0) continue
      const sameColor = rowTiles.filter(x => x.t.c === tile.c)
      if (sameColor.length === 0) continue
      const minEntry = sameColor.reduce((a, b) => a.t.n < b.t.n ? a : b)
      const maxEntry = sameColor.reduce((a, b) => a.t.n > b.t.n ? a : b)
      if (tile.n === minEntry.t.n - 1 && minEntry.c > 0 && !grid[r][minEntry.c - 1]) {
        grid[r][minEntry.c - 1] = tile
        placed = true
      } else if (tile.n === maxEntry.t.n + 1 && maxEntry.c < cols - 1 && !grid[r][maxEntry.c + 1]) {
        grid[r][maxEntry.c + 1] = tile
        placed = true
      }
    }
    if (placed) continue

    // Try completing a group: scan for a contiguous run of tiles with
    // this tile's value in an adjacent row (vertical group forming) —
    // for simplicity, only check horizontal groups already on the
    // board at this tile's value with an adjacent empty cell.
    for (let r = 0; r < rows && !placed; r++) {
      for (let c = 0; c < cols; c++) {
        const t = grid[r][c]
        if (t && t.n === tile.n && t.c !== tile.c) {
          // found a same-value tile of a different color — check for
          // an adjacent empty cell in the same row to extend a group
          if (c + 1 < cols && !grid[r][c + 1]) {
            grid[r][c + 1] = tile
            placed = true
            break
          }
          if (c > 0 && !grid[r][c - 1]) {
            grid[r][c - 1] = tile
            placed = true
            break
          }
        }
      }
    }
    if (!placed) return null  // this tile has no obvious placement
  }

  return grid
}

export function isTrivial(board: Grid, rack: Tile[]): boolean {
  if (formsValidSetAlone(rack)) return true
  const naive = attemptNaiveReinsertion(board, rack)
  if (naive && validateGrid(naive)) return true
  return false
}
