import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'
import { isValidRun, isValidGroup, validateGrid } from './validator'

// 'run-to-group' is the legacy id still passed by generator.ts.
export type ArchetypeType = 'groups-to-runs' | 'run-to-group'

const ALL_COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (size > arr.length) return []
  if (size === arr.length) return [arr]
  const [first, ...rest] = arr
  return [
    ...combinations(rest, size - 1).map(c => [first, ...c]),
    ...combinations(rest, size),
  ]
}

export interface ArchetypeResult {
  grid: Grid
  rack: Tile[]
  allTiles: Tile[]
  /** Length of the reference solution the builder knows: an upper bound on optimal. */
  minMoves: number
}

// ---------------------------------------------------------------------------
// Invariant (c): the rack must not be a puzzle on its own.
// ---------------------------------------------------------------------------

/** True if the rack, or any 3+ subset of it, is already a valid run or group. */
export function formsValidSetAlone(tiles: Tile[]): boolean {
  for (let size = 3; size <= tiles.length; size++) {
    for (const combo of combinations(tiles, size)) {
      if (isValidRun(combo) || isValidGroup(combo)) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Invariant (d): no way to empty the rack into free cells without relocating a
// board tile. This is the gate that decides whether a puzzle is fill-in-the-
// blank, so it is searched exhaustively rather than guessed at.
//
// Completeness of the frontier-restricted search: given (c), a rack tile's
// covering segment in a winning grid can never be all-rack (that segment would
// be a valid run/group made of rack tiles alone). So every placed rack tile is
// joined, through occupied cells, to a board tile. Ordering the placements by
// distance from the board therefore always yields an order in which each tile
// lands orthogonally adjacent to an already-occupied cell — which is exactly
// the frontier the search explores. Nothing is missed.
// ---------------------------------------------------------------------------

const NODE_BUDGET = 200_000

type Line = (Tile | null)[]

function row(grid: Grid, r: number): Line { return grid[r] }
function column(grid: Grid, c: number): Line { return grid.map(rw => rw[c]) }

/**
 * Could the tile at `idx` ever sit in a valid segment along this line, given we
 * may still place any of `remaining` into the line's empty cells?
 *
 * A final segment is a window [lo..hi] whose every empty cell gets filled and
 * whose two outside neighbours stay empty (or are walls). Over-approximates —
 * it lets the same spare tile serve several windows — which only ever makes the
 * prune weaker, never wrong.
 */
function lineCanCover(line: Line, idx: number, remaining: Tile[]): boolean {
  const n = line.length
  const spare = remaining.length

  for (let lo = idx; lo >= 0; lo--) {
    if (lo > 0 && line[lo - 1] !== null) continue // window would swallow that tile
    for (let hi = idx; hi < n; hi++) {
      if (hi < n - 1 && line[hi + 1] !== null) continue
      const len = hi - lo + 1
      if (len < 3 || len > 13) continue

      const fixed: Tile[] = []
      let holes = 0
      for (let i = lo; i <= hi; i++) {
        const t = line[i]
        if (t) fixed.push(t)
        else holes++
      }
      if (holes > spare) continue
      if (holes === 0) {
        if (isValidRun(fixed) || isValidGroup(fixed)) return true
        continue
      }
      for (const fill of combinations(remaining, holes)) {
        const merged = [...fixed, ...fill]
        if (isValidRun(merged) || isValidGroup(merged)) return true
      }
    }
  }
  return false
}

function canEverBeCovered(grid: Grid, r: number, c: number, remaining: Tile[]): boolean {
  return lineCanCover(row(grid, r), c, remaining) || lineCanCover(column(grid, c), r, remaining)
}

/** The maximal contiguous occupied cells through (r,c), horizontally and vertically. */
function segmentCells(grid: Grid, r: number, c: number): [number, number][] {
  const rows = grid.length
  const cols = grid[0].length
  const out: [number, number][] = []

  let lo = c
  while (lo > 0 && grid[r][lo - 1]) lo--
  let hi = c
  while (hi < cols - 1 && grid[r][hi + 1]) hi++
  for (let i = lo; i <= hi; i++) out.push([r, i])

  let top = r
  while (top > 0 && grid[top - 1][c]) top--
  let bot = r
  while (bot < rows - 1 && grid[bot + 1][c]) bot++
  for (let i = top; i <= bot; i++) if (i !== r) out.push([i, c])

  return out
}

function frontier(grid: Grid): [number, number][] {
  const rows = grid.length
  const cols = grid[0].length
  const out: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) continue
      const touches =
        (r > 0 && grid[r - 1][c]) || (r < rows - 1 && grid[r + 1][c]) ||
        (c > 0 && grid[r][c - 1]) || (c < cols - 1 && grid[r][c + 1])
      if (touches) out.push([r, c])
    }
  }
  return out
}

export interface RelocationSearch {
  /** A no-relocation win exists: the rack can be dumped into free cells and the grid is valid. */
  win: boolean
  /** Search hit the node budget, so `win: false` is not proven. Callers must treat this as unsafe. */
  exhausted: boolean
  /** Cells the rack tiles landed on, in rack order, when `win`. */
  placement?: [number, number][]
}

export function existsNoRelocationWin(board: Grid, rack: Tile[]): RelocationSearch {
  const grid = board.map(rw => [...rw])
  const seen = new Set<string>()
  const placed: [number, number][] = []
  let nodes = 0
  let exhausted = false

  const search = (remaining: Tile[]): boolean => {
    if (++nodes > NODE_BUDGET) { exhausted = true; return false }
    if (remaining.length === 0) return validateGrid(grid)

    for (const [r, c] of frontier(grid)) {
      for (let i = 0; i < remaining.length; i++) {
        const tile = remaining[i]
        const rest = [...remaining.slice(0, i), ...remaining.slice(i + 1)]

        grid[r][c] = tile
        const key = `${r},${c},${tile.n}${tile.c}|${rest.map(t => `${t.n}${t.c}`).sort().join(',')}`
        if (!seen.has(key)) {
          seen.add(key)
          // The placed tile, and every tile whose segment it just joined, must
          // still have some route to being covered.
          let alive = canEverBeCovered(grid, r, c, rest)
          if (alive) {
            for (const [tr, tc] of segmentCells(grid, r, c)) {
              if (!canEverBeCovered(grid, tr, tc, rest)) { alive = false; break }
            }
          }
          if (alive) {
            placed.push([r, c])
            if (search(rest)) return true
            placed.pop()
          }
        }
        grid[r][c] = null
        if (exhausted) return false
      }
    }
    return false
  }

  const win = search(rack)
  return win
    ? { win: true, exhausted: false, placement: [...placed] }
    : { win: false, exhausted }
}

/**
 * Invariant (d), stated literally: send every rack tile to an "obvious" home —
 * an open run endpoint of matching colour and adjacent value, or a group of 3
 * missing exactly this tile — in either direction, and see whether that wins.
 * Strictly weaker than existsNoRelocationWin; kept because it is the property
 * the spec names, and it names the failure when one occurs.
 */
export function obviousSpots(grid: Grid, tile: Tile): [number, number][] {
  const rows = grid.length
  const cols = grid[0].length
  const spots: [number, number][] = []

  const consider = (r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c]) return
    const lines: [Line, number][] = [[row(grid, r), c], [column(grid, c), r]]
    for (const [line, idx] of lines) {
      let lo = idx - 1
      while (lo >= 0 && line[lo]) lo--
      let hi = idx + 1
      while (hi < line.length && line[hi]) hi++
      const seg = line.slice(lo + 1, hi).filter((t): t is Tile => t !== null)
      if (seg.length < 2) continue
      if (isValidRun(seg) && isValidRun([...seg, tile])) { spots.push([r, c]); return }
      if (seg.length === 3 && isValidGroup(seg) && isValidGroup([...seg, tile])) { spots.push([r, c]); return }
    }
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c]) { consider(r - 1, c); consider(r + 1, c); consider(r, c - 1); consider(r, c + 1) }

  return spots
}

export function obviousPlacementWins(board: Grid, rack: Tile[]): boolean {
  const grid = board.map(rw => [...rw])
  const rec = (i: number): boolean => {
    if (i === rack.length) return validateGrid(grid)
    for (const [r, c] of obviousSpots(grid, rack[i])) {
      if (grid[r][c]) continue
      grid[r][c] = rack[i]
      if (rec(i + 1)) return true
      grid[r][c] = null
    }
    return false
  }
  return rec(0)
}

/**
 * A puzzle is trivial if the rack solves itself (failure mode 2) or if it can be
 * emptied into free cells without moving a board tile (failure mode 1). A search
 * that ran out of budget counts as trivial: we never ship what we cannot prove.
 */
export function isTrivial(board: Grid, rack: Tile[]): boolean {
  if (formsValidSetAlone(rack)) return true
  const search = existsNoRelocationWin(board, rack)
  return search.win || search.exhausted
}

// ---------------------------------------------------------------------------
// Construction: "groups to runs".
//
// The board shows the dual block D(4, L) — four colours over L consecutive
// values — laid out as its L GROUPS: each value is one vertical column of four
// colours. Columns are spaced two apart so no two of them ever touch, and
// adjacent columns are colour-deranged (no colour shares a row with its
// neighbour), which is what stops a rack tile dropped in the gap column from
// bridging two board tiles into a run.
//
// The rack holds the block's run extensions: tiles at value s-1 and s+L, at
// most one per colour and at most two per value. Those tiles cannot join a
// column (wrong value: a column is a group of 4 and is already full) and cannot
// extend a row (rows are single tiles, not runs). Every rack tile is homeless.
//
// The only way out is to see the block the other way round: break the L groups
// apart and rebuild the same tiles as 4 runs, which the rack tiles then extend.
// Same tiles, two structures — Latin-rectangle duality, used as the trap rather
// than as the scaffold.
// ---------------------------------------------------------------------------

interface Params { L: number; rackSize: number }

function paramsFor(diff: Difficulty): Params {
  switch (diff) {
    case 'easy': return { L: 3, rackSize: 2 }
    case 'medium': return { L: 4, rackSize: 3 }
    case 'hard': return { L: 5, rackSize: 4 }
    case 'extreme': return { L: 6, rackSize: 4 }
  }
}

/** A permutation of the 4 colours sharing no position with `prev`. */
function derangedFrom(prev: Tile['c'][] | null): Tile['c'][] | null {
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = shuffle(ALL_COLORS)
    if (!prev || p.every((c, i) => c !== prev[i])) return p
  }
  return null
}

export function buildGroupsToRuns(diff: Difficulty): ArchetypeResult | null {
  const { L, rackSize } = paramsFor(diff)

  // Need s-1 and s+L to exist inside 1..13.
  const s = randomInt(2, 13 - L)

  const perms: Tile['c'][][] = []
  for (let i = 0; i < L; i++) {
    const p = derangedFrom(i === 0 ? null : perms[i - 1])
    if (!p) return null
    perms.push(p)
  }

  const rows = 6
  const cols = 2 * L + 2
  const rowStart = 1
  const colStart = 1

  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (let i = 0; i < L; i++)
    for (let r = 0; r < 4; r++)
      grid[rowStart + r][colStart + 2 * i] = { n: s + i, c: perms[i][r] }

  // (a) the board the player is shown is already fully valid.
  if (!validateGrid(grid)) return null

  // Rack: run extensions, <=1 per colour (no run inside the rack) and <=2 per
  // value (no group inside the rack).
  const lowCount = rackSize === 2 ? 1 : rackSize === 3 ? (Math.random() < 0.5 ? 1 : 2) : 2
  const highCount = rackSize - lowCount
  if (lowCount > 2 || highCount > 2) return null
  const pick = shuffle(ALL_COLORS)
  const rack: Tile[] = [
    ...pick.slice(0, lowCount).map(c => ({ n: s - 1, c })),
    ...pick.slice(lowCount, lowCount + highCount).map(c => ({ n: s + L, c })),
  ]

  // (c) the rack is not already a puzzle on its own.
  if (formsValidSetAlone(rack)) return null

  // (b) board + rack really is partitionable.
  const boardTiles = grid.flat().filter((t): t is Tile => t !== null)
  const allTiles = [...boardTiles, ...rack]
  if (!solveBag(allTiles).solvable) return null

  // (d) the obvious move must fail — exhaustively, not heuristically.
  const search = existsNoRelocationWin(grid, rack)
  if (search.win || search.exhausted) return null

  // Reference solution: the same tiles rebuilt as 4 runs, one colour per row,
  // each spanning its own value range. Tiles already sitting on their target
  // cell cost nothing; everything else is one move, as is every rack tile.
  let settled = 0
  for (const t of boardTiles) {
    const goalR = rowStart + ALL_COLORS.indexOf(t.c)
    const goalC = colStart + (t.n - (s - 1))
    if (grid[goalR]?.[goalC] === t) settled++
  }
  const minMoves = rack.length + (boardTiles.length - settled)

  return { grid, rack: shuffle(rack), allTiles, minMoves }
}

/** Legacy alias — generator.ts still calls this name. */
export const buildRunToGroup = buildGroupsToRuns
