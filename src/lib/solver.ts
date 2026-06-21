import type { Grid, Tile } from '../types'
import { validateGrid, isValidRun, isValidGroup } from './validator'

export interface SolveResult {
  solvable: boolean
  solutionGrid?: Grid
  movesUsed?: number
}

// Check whether a partial contiguous sequence (H or V) is already doomed.
// A sequence is prunable when it has ≥ 3 tiles and is neither a valid run
// nor extendable into one (wrong colors mixed, or numbers already broken).
function partialGroupOk(tiles: Tile[]): boolean {
  if (tiles.length < 2) return true
  if (tiles.length >= 3 && (isValidRun(tiles) || isValidGroup(tiles))) return true
  if (tiles.length >= 3) return false
  // length === 2: check if they CAN still form a valid run or group together
  const [a, b] = tiles
  const sameColor = a.c === b.c
  const consecutive = Math.abs(a.n - b.n) === 1
  const sameNumber = a.n === b.n
  const diffColor = a.c !== b.c
  return (sameColor && consecutive) || (sameNumber && diffColor)
}

function scanSequences(g: Grid, rows: number, cols: number): boolean {
  // horizontal
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!g[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && g[r][end + 1]) end++
      const seq: Tile[] = []
      for (let i = c; i <= end; i++) seq.push(g[r][i] as Tile)
      if (!partialGroupOk(seq)) return false
      c = end + 1
    }
  }
  // vertical
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!g[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && g[end + 1][c]) end++
      const seq: Tile[] = []
      for (let i = r; i <= end; i++) seq.push(g[i][c] as Tile)
      if (!partialGroupOk(seq)) return false
      r = end + 1
    }
  }
  return true
}

export function solve(grid: Grid, rack: Tile[], maxDepthMs = 800): SolveResult {
  const startTime = Date.now()
  const rows = grid.length || 6
  const cols = grid[0]?.length ?? 10

  // Build full tile pool: rack tiles + every board tile
  const pool: Tile[] = [...rack]
  const boardCells: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r]?.[c]) {
        pool.push(grid[r][c] as Tile)
        boardCells.push({ r, c })
      }
    }
  }

  // Start with a blank grid; we'll fill all cells from pool
  const startGrid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))

  // Collect all cells as placement targets
  const allCells: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      allCells.push({ r, c })

  // Backtracking: assign pool[idx] to some cell, recurse
  function backtrack(g: Grid, idx: number): Grid | null {
    if (Date.now() - startTime > maxDepthMs) return null
    if (idx === pool.length) {
      return validateGrid(g) ? g : null
    }

    const tile = pool[idx]
    for (const { r, c } of allCells) {
      if (g[r][c] !== null) continue
      g[r][c] = tile
      if (scanSequences(g, rows, cols)) {
        const result = backtrack(g, idx + 1)
        if (result) return result
      }
      g[r][c] = null
    }
    return null
  }

  const workGrid: Grid = startGrid.map(row => [...row])
  const result = backtrack(workGrid, 0)
  if (result) {
    return { solvable: true, solutionGrid: result, movesUsed: rack.length }
  }
  return { solvable: false }
}
