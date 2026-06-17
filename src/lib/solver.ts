import type { Grid, Tile } from '../types'
import { validateGrid } from './validator'

export interface SolveResult {
  solvable: boolean
  solutionGrid?: Grid   // a grid state that passes validateGrid, if found
  movesUsed?: number    // number of rack tiles successfully placed
}

export function solve(grid: Grid, rack: Tile[], maxDepthMs = 800): SolveResult {
  const startTime = Date.now()
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  function emptyCells(g: Grid): { r: number; c: number }[] {
    const out: { r: number; c: number }[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (g[r][c] === null) out.push({ r, c })
      }
    }
    return out
  }

  function backtrackPlaceOnly(g: Grid, remaining: Tile[]): Grid | null {
    if (Date.now() - startTime > maxDepthMs) return null
    if (remaining.length === 0) {
      return validateGrid(g) ? g : null
    }
    const empties = emptyCells(g)
    const [tile, ...rest] = remaining
    for (const { r, c } of empties) {
      const g2 = g.map(row => [...row])
      g2[r][c] = tile
      const result = backtrackPlaceOnly(g2, rest)
      if (result) return result
    }
    return null
  }

  const placeOnlyResult = backtrackPlaceOnly(grid.map(row => [...row]), rack)
  if (placeOnlyResult) {
    return { solvable: true, solutionGrid: placeOnlyResult, movesUsed: rack.length }
  }

  // If pure placement fails, try allowing one board-to-board swap
  // combined with placements — covers puzzles that require
  // reorganizing an existing tile to make room (like the earlier
  // "lone 1" bug case). Limit to single-swap depth to keep runtime
  // bounded; this is a heuristic safety net, not exhaustive search.
  function backtrackWithOneSwap(g: Grid, remaining: Tile[], swapUsed: boolean): Grid | null {
    if (Date.now() - startTime > maxDepthMs) return null
    if (remaining.length === 0) {
      return validateGrid(g) ? g : null
    }
    const empties = emptyCells(g)
    const [tile, ...rest] = remaining

    for (const { r, c } of empties) {
      const g2 = g.map(row => [...row])
      g2[r][c] = tile
      const result = backtrackWithOneSwap(g2, rest, swapUsed)
      if (result) return result
    }

    if (!swapUsed) {
      // try moving an existing board tile to a different empty cell,
      // freeing its original position for the current rack tile
      const occupied: { r: number; c: number }[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (g[r][c] !== null) occupied.push({ r, c })
        }
      }
      for (const from of occupied) {
        for (const to of empties) {
          const g2 = g.map(row => [...row])
          const movedTile = g2[from.r][from.c]
          g2[from.r][from.c] = tile
          g2[to.r][to.c] = movedTile
          const result = backtrackWithOneSwap(g2, rest, true)
          if (result) return result
        }
      }
    }
    return null
  }

  const swapResult = backtrackWithOneSwap(grid.map(row => [...row]), rack, false)
  if (swapResult) {
    return { solvable: true, solutionGrid: swapResult, movesUsed: rack.length }
  }

  return { solvable: false }
}
