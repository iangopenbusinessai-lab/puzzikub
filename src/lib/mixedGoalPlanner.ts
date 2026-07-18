// ---------------------------------------------------------------------------
// mixedGoalPlanner.ts — goal planning for MIXED final layouts.
//
// The existing planners (planColorRunGoal / planValueGroupGoal in archetypes.ts)
// each represent one PURE goal shape: EVERY destination row is a run, or EVERY
// row is a group. Three independent design briefs (DECOY_DESIGN.md,
// COUPLED_DESIGN.md, RED_HERRING_DESIGN.md) all hit the same wall — the genuinely
// interesting puzzles need a HYBRID final layout: some rows are runs (a colour,
// consecutive values), others are groups (a value, distinct colours), together
// in one solution.
//
// THE CRUX CLAIM this file rests on: the proven move-cost model
//     cost(goal) = totalTiles − fixed(goal) − cycles(goal)
// (makeCostCtx in archetypes.ts, verified against real move-BFS on 250+ instances
// in a prior session) does NOT depend on the destination windows sharing a type.
// Its graph argument uses only that each tile has exactly one current location
// and one target CELL, giving a functional graph of disjoint paths and cycles
// (cell out-degree ≤ 1, target-cell in-degree ≤ 1). Window shape never enters it.
// So the same formula scores an injective tile→cell goal whether the cells spell
// runs, groups, or any mixture. mixedGoalPlanner.verify.ts confirms this
// empirically against unrestricted move-BFS, including cycles that pass through
// both a run window and a group window.
//
// This file is deliberately STANDALONE (no import from archetypes.ts) so it can
// be upgraded independently as decoy / coupled / red-herring modifiers adopt it.
// The move model it targets is usePlayState.ts's DROP reducer, re-read at build
// time: RACK→GRID (displaced tile → rack), GRID→GRID onto an occupied cell SWAPS
// in one move, GRID→GRID onto empty relocates in one move.
// ---------------------------------------------------------------------------

import type { Tile, Grid } from '../types'
import { isValidRun, isValidGroup, validateGrid } from './validator'
import { solveBag } from './solver'

export type WindowSpec =
  | { type: 'run'; color: Tile['c']; start: number; length: number }
  | { type: 'group'; value: number; colors: Tile['c'][] }

/** A window placed on the grid: its leftmost cell is (row, col); tiles fill
 * col..col+len-1 left to right, in the order `windowTiles` returns. */
export interface PlacedWindow {
  spec: WindowSpec
  row: number
  col: number
}

export type Drop =
  | { from: 'grid'; r: number; c: number; tr: number; tc: number }
  | { from: 'rack'; key: string; tr: number; tc: number }

export const tileKey = (t: Tile): string => `${t.n}_${t.c}`

/** The tiles a window contains, left-to-right in their placed column order. */
export function windowTiles(w: WindowSpec): Tile[] {
  if (w.type === 'run') {
    const out: Tile[] = []
    for (let i = 0; i < w.length; i++) out.push({ n: w.start + i, c: w.color })
    return out
  }
  return w.colors.map(c => ({ n: w.value, c }))
}

function windowIsValid(w: WindowSpec): boolean {
  const tiles = windowTiles(w)
  if (w.type === 'run') {
    if (w.length < 3 || w.length > 13) return false
    if (w.start < 1 || w.start + w.length - 1 > 13) return false
    return isValidRun(tiles)
  }
  if (new Set(w.colors).size !== w.colors.length) return false
  return isValidGroup(tiles)
}

// ---------------------------------------------------------------------------
// Feasibility: do the given windows form a valid, complete, duplicate-free
// partition of the current board + rack? Bag-level solvability is delegated to
// solveBag as the brief suggested; the windows are then confirmed to BE one such
// partition (every tile placed exactly once, each window a valid set).
// ---------------------------------------------------------------------------
export interface Feasibility {
  feasible: boolean
  reason?: string
}

export function windowsPartitionBag(currentGrid: Grid, rack: Tile[], windows: WindowSpec[]): Feasibility {
  const bag: Tile[] = [...currentGrid.flat().filter((t): t is Tile => t !== null), ...rack]

  for (const w of windows) if (!windowIsValid(w)) return { feasible: false, reason: `invalid window ${JSON.stringify(w)}` }

  const need = new Map<string, number>()
  for (const t of bag) need.set(tileKey(t), (need.get(tileKey(t)) ?? 0) + 1)
  // Puzzles never carry duplicate tiles; a repeated (n,c) can't sit on two cells.
  for (const [k, count] of need) if (count > 1) return { feasible: false, reason: `duplicate tile ${k} in bag` }

  const have = new Map<string, number>()
  for (const w of windows) for (const t of windowTiles(w)) {
    const k = tileKey(t)
    have.set(k, (have.get(k) ?? 0) + 1)
  }

  for (const [k, count] of have) {
    if (count > 1) return { feasible: false, reason: `tile ${k} claimed by two windows` }
    if (!need.has(k)) return { feasible: false, reason: `window tile ${k} not in bag` }
  }
  for (const k of need.keys()) if (!have.has(k)) return { feasible: false, reason: `bag tile ${k} covered by no window` }

  // Sanity: a valid partition into valid sets means the bag is solvable. If
  // solveBag disagrees, something is inconsistent upstream.
  if (!solveBag(bag).solvable) return { feasible: false, reason: 'solveBag says bag is not partitionable' }

  return { feasible: true }
}

// ---------------------------------------------------------------------------
// Core: exact move count + concrete witness for a CONCRETE goal layout
// (tileKey → [row, col]). Shape-agnostic — this is the whole point.
// ---------------------------------------------------------------------------
export interface MoveResult {
  moves: number
  fixed: number
  cycles: number
  witness: Drop[]
  /** Witness executed under faithful reducer semantics lands every tile on its
   * goal cell with an empty rack. If false, the witness generator is buggy. */
  reachedGoal: boolean
  /** validateGrid of the goal layout (a real win, not just a permutation). */
  validGoal: boolean
}

/** Analytic cost via the functional-graph argument, mirroring makeCostCtx. */
function analyticCost(boardCells: number[], goalCells: number[], rackCount: number): { moves: number; fixed: number; cycles: number } {
  const n = boardCells.length
  const occupant = new Map<number, number>()
  for (let i = 0; i < n; i++) occupant.set(boardCells[i], i)

  const mark = new Uint8Array(n) // 0 unseen, 1 on-walk, 2 retired, 3 fixed
  let fixed = 0
  for (let i = 0; i < n; i++) if (boardCells[i] === goalCells[i]) { fixed++; mark[i] = 3 }

  let cycles = 0
  const walk = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    if (mark[i] !== 0) continue
    let len = 0
    let cur = i
    while (cur !== -1 && mark[cur] === 0) {
      mark[cur] = 1
      walk[len++] = cur
      const nextCell = goalCells[cur]
      cur = occupant.has(nextCell) ? occupant.get(nextCell)! : -1
    }
    if (cur !== -1 && mark[cur] === 1) cycles++
    for (let w = 0; w < len; w++) mark[walk[w]] = 2
  }

  return { moves: n + rackCount - fixed - cycles, fixed, cycles }
}

/** Faithful transcription of usePlayState's DROP reducer, for building/replaying
 * a witness. GRID→GRID onto occupied swaps; RACK→GRID displaced → rack. */
function applyDrop(grid: Grid, rack: Tile[], d: Drop): void {
  if (d.from === 'rack') {
    const idx = rack.findIndex(t => tileKey(t) === d.key)
    const tile = rack[idx]
    rack.splice(idx, 1)
    const displaced = grid[d.tr][d.tc]
    grid[d.tr][d.tc] = tile
    if (displaced) rack.push(displaced)
  } else {
    const tile = grid[d.r][d.c]
    grid[d.r][d.c] = grid[d.tr][d.tc]
    grid[d.tr][d.tc] = tile
  }
}

export function mixedLayoutMoves(currentGrid: Grid, rack: Tile[], goal: Map<string, [number, number]>): MoveResult | null {
  const curRows = currentGrid.length
  const curCols = currentGrid[0]?.length ?? 0
  if (curRows === 0 || curCols === 0) return null

  let maxR = curRows - 1
  let maxC = curCols - 1
  for (const [r, c] of goal.values()) { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c) }
  const cols = maxC + 1
  const rows = maxR + 1
  const flat = (r: number, c: number) => r * cols + c

  // Board tiles at their current cells.
  const boardKeys: string[] = []
  const boardCells: number[] = []
  for (let r = 0; r < curRows; r++)
    for (let c = 0; c < curCols; c++) {
      const t = currentGrid[r][c]
      if (t) { boardKeys.push(tileKey(t)); boardCells.push(flat(r, c)) }
    }

  // Every board + rack tile needs a goal cell, all distinct.
  const goalCellSet = new Set<number>()
  const goalCells: number[] = []
  for (const k of boardKeys) {
    const g = goal.get(k)
    if (!g) return null
    const cell = flat(g[0], g[1])
    if (goalCellSet.has(cell)) return null
    goalCellSet.add(cell)
    goalCells.push(cell)
  }
  for (const t of rack) {
    const g = goal.get(tileKey(t))
    if (!g) return null
    const cell = flat(g[0], g[1])
    if (goalCellSet.has(cell)) return null
    goalCellSet.add(cell)
  }

  const analytic = analyticCost(boardCells, goalCells, rack.length)

  // ---- Witness: drain paths (tile whose goal cell is empty) then unwind cycles
  // (swap into goal cell), then drop rack onto the now-free goal cells.
  const grid: Grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (r < curRows && c < curCols ? currentGrid[r][c] : null)),
  )
  const rackArr = [...rack]
  const witness: Drop[] = []
  const goalOf = (t: Tile) => goal.get(tileKey(t))!

  const misplaced = (): [number, number][] => {
    const out: [number, number][] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const t = grid[r][c]
        if (!t) continue
        const [gr, gc] = goalOf(t)
        if (gr !== r || gc !== c) out.push([r, c])
      }
    return out
  }

  const budget = rows * cols * 4
  let moves = 0
  for (let guard = 0; guard <= budget; guard++) {
    const bad = misplaced()
    if (bad.length === 0) break
    if (guard === budget) return { ...analytic, moves, witness, reachedGoal: false, validGoal: false }
    const drain = bad.find(([r, c]) => {
      const [gr, gc] = goalOf(grid[r][c]!)
      return grid[gr][gc] === null
    })
    const [r, c] = drain ?? bad[0]
    const [tr, tc] = goalOf(grid[r][c]!)
    const d: Drop = { from: 'grid', r, c, tr, tc }
    applyDrop(grid, rackArr, d)
    witness.push(d)
    moves++
  }
  while (rackArr.length > 0) {
    const t = rackArr[0]
    const [tr, tc] = goalOf(t)
    if (grid[tr][tc] !== null) return { ...analytic, moves, witness, reachedGoal: false, validGoal: false }
    const d: Drop = { from: 'rack', key: tileKey(t), tr, tc }
    applyDrop(grid, rackArr, d)
    witness.push(d)
    moves++
  }

  const reachedGoal = rackArr.length === 0 && misplaced().length === 0
  return { moves: analytic.moves, fixed: analytic.fixed, cycles: analytic.cycles, witness, reachedGoal, validGoal: reachedGoal && validateGrid(grid) }
}

// ---------------------------------------------------------------------------
// Convenience optimizer: given window SHAPES (not placements), search placements
// (which row each window owns, its colStart) for the minimum-move layout.
//
// WARNING — combinatorial cost. Assigning W windows to distinct rows is P(rows,W)
// = factorial-ish, the same L! wall that planValueGroupGoal hit (see CLAUDE.md).
// This is fine for small W and MEASURED in the verify harness. Callers that
// already know their intended layout (decoy does) should build the goal map and
// call mixedLayoutMoves directly, bypassing this search entirely.
// ---------------------------------------------------------------------------
export interface PlanResult extends MoveResult {
  layout: PlacedWindow[]
  goal: Map<string, [number, number]>
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  const out: T[][] = []
  for (let i = 0; i < xs.length; i++) {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)]
    for (const p of permutations(rest)) out.push([xs[i], ...p])
  }
  return out
}

export function planMixedGoal(currentGrid: Grid, rack: Tile[], windows: WindowSpec[], rows: number, cols: number): PlanResult | null {
  const feas = windowsPartitionBag(currentGrid, rack, windows)
  if (!feas.feasible) return null
  if (windows.length > rows) return null

  const rowChoices = Array.from({ length: rows }, (_, i) => i)
  let best: { moves: number; goal: Map<string, [number, number]>; layout: PlacedWindow[] } | null = null

  // Each window can start at cols 0..cols-len; enumerate rows (as an ordered
  // choice of distinct rows) × colStart per window.
  for (const rowPerm of permutations(rowChoices).map(p => p.slice(0, windows.length))) {
    // Dedup: permutations() over all rows repeats the first-W slice; cheap guard.
    const colOptions = windows.map(w => {
      const len = windowTiles(w).length
      const opts: number[] = []
      for (let cs = 0; cs + len <= cols; cs++) opts.push(cs)
      return opts
    })

    // Enumerate colStart combinations (product). Kept modest by small `cols`.
    const idx = new Array(windows.length).fill(0)
    for (;;) {
      const goal = new Map<string, [number, number]>()
      let ok = true
      for (let wi = 0; wi < windows.length && ok; wi++) {
        const w = windows[wi]
        const row = rowPerm[wi]
        const cs = colOptions[wi][idx[wi]]
        windowTiles(w).forEach((t, i) => {
          const cell: [number, number] = [row, cs + i]
          goal.set(tileKey(t), cell)
        })
      }
      if (ok) {
        const res = mixedLayoutMoves(currentGrid, rack, goal)
        if (res && res.reachedGoal && (!best || res.moves < best.moves)) {
          best = { moves: res.moves, goal, layout: windows.map((w, wi) => ({ spec: w, row: rowPerm[wi], col: colOptions[wi][idx[wi]] })) }
        }
      }
      // advance colStart odometer
      let k = windows.length - 1
      while (k >= 0) { idx[k]++; if (idx[k] < colOptions[k].length) break; idx[k] = 0; k-- }
      if (k < 0) break
    }
  }

  if (!best) return null
  const final = mixedLayoutMoves(currentGrid, rack, best.goal)!
  return { ...final, layout: best.layout, goal: best.goal }
}
