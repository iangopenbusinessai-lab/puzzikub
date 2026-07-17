import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'
import { isValidRun, isValidGroup, validateGrid } from './validator'

/** The two directions of the same Latin-rectangle duality. */
export type ArchetypeType = 'groups-to-runs' | 'runs-to-groups'

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
// Coverage is HORIZONTAL-ONLY (see validator.ts): a tile is valid iff its
// maximal contiguous run of occupied cells *within its own row* is a valid run
// or group. Two consequences drive everything below:
//
//   - Rows are independent. Placing a tile at (r,c) can only change the
//     coverage of tiles in row r. Nothing above or below is affected.
//   - A tile's only hope of being covered is its own row, so a row that cannot
//     ever cover it — even given every unplaced tile — is a dead end.
//
// Completeness of the frontier-restricted search: given (c), a rack tile's
// covering segment in a winning grid can never be all-rack (that segment would
// be a valid run/group made of rack tiles alone). So every placed rack tile
// shares a row-segment with a board tile. Ordering the placements by horizontal
// distance from the nearest board tile in that segment always yields an order in
// which each tile lands adjacent to an already-occupied cell. The frontier below
// is the orthogonal neighbourhood, a superset of that horizontal one, so nothing
// is missed.
// ---------------------------------------------------------------------------

const NODE_BUDGET = 200_000

type Line = (Tile | null)[]

function row(grid: Grid, r: number): Line { return grid[r] }

/**
 * Could the tile at `idx` ever sit in a valid segment along this row, given we
 * may still place any of `remaining` into the row's empty cells?
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

/** Horizontal-only: a column can no longer cover anything. */
function canEverBeCovered(grid: Grid, r: number, c: number, remaining: Tile[]): boolean {
  return lineCanCover(row(grid, r), c, remaining)
}

/** The maximal contiguous occupied cells through (r,c) in its row. */
function segmentCells(grid: Grid, r: number, c: number): [number, number][] {
  const cols = grid[0].length
  const out: [number, number][] = []

  let lo = c
  while (lo > 0 && grid[r][lo - 1]) lo--
  let hi = c
  while (hi < cols - 1 && grid[r][hi + 1]) hi++
  for (let i = lo; i <= hi; i++) out.push([r, i])

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
          // The placed tile, and every tile whose row-segment it just joined,
          // must still have some route to being covered.
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
 * missing exactly this tile — and see whether that wins. Horizontal only, since
 * a vertical arrangement is no longer a set. Strictly weaker than
 * existsNoRelocationWin; kept because it is the property the spec names, and it
 * names the failure when one occurs.
 */
export function obviousSpots(grid: Grid, tile: Tile): [number, number][] {
  const rows = grid.length
  const cols = grid[0].length
  const spots: [number, number][] = []

  const consider = (r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c]) return
    const line = row(grid, r)
    let lo = c - 1
    while (lo >= 0 && line[lo]) lo--
    let hi = c + 1
    while (hi < line.length && line[hi]) hi++
    const seg = line.slice(lo + 1, hi).filter((t): t is Tile => t !== null)
    if (seg.length < 2) return
    if (isValidRun(seg) && isValidRun([...seg, tile])) { spots.push([r, c]); return }
    if (seg.length === 3 && isValidGroup(seg) && isValidGroup([...seg, tile])) { spots.push([r, c]); return }
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c]) { consider(r, c - 1); consider(r, c + 1) }

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
// Construction: "groups to runs", horizontal-only edition.
//
// The board shows the dual block D(4, L) — four colours over L consecutive
// values — laid out as its L GROUPS. Under the horizontal-only rule a group has
// to BE a horizontal strip, so each value gets its own row: four tiles of the
// same value in four different colours, side by side. That is what the player
// sees at move zero, and validateGrid accepts every one of them.
//
// WHY THE RACK IS HOMELESS — the replacement for the old spacing/derangement
// argument, which reasoned about vertical column adjacency and does not survive
// the transpose. Two structural facts do all the work now:
//
//   1. ONE MAXIMAL SEGMENT PER ROW. Each board row holds exactly one contiguous
//      strip and nothing else, so there is no interior gap between two board
//      tiles in a row. The old failure — a rack tile bridging two flanking board
//      tiles into a run — cannot even be expressed here. (Rows are separated
//      vertically only for looks; vertical adjacency has no meaning any more.)
//
//   2. EVERY STRIP IS A *FULL* FOUR-COLOUR GROUP. isValidGroup caps at 4, so the
//      strip cannot grow into a bigger group; and it holds four distinct colours,
//      so it can never be part of a run. Appending ANY tile to either end of any
//      board row therefore makes that row's segment invalid — whatever the tile
//      is. This is stronger than the old guarantee, which depended on the rack's
//      values; this one holds for every conceivable rack.
//
// So the only segment a rack tile can be covered by is one built entirely out of
// rack tiles — and invariant (c) forbids exactly that. Hence (d) follows from
// (c) on these boards. That implication is asserted, not assumed: the builder
// still runs the full exhaustive existsNoRelocationWin gate below, and
// verifyEngine.ts cross-checks the gate against a planted win and an unpruned
// brute force.
//
// The rack holds the block's run extensions: tiles at value s-1 and s+L, at most
// one per colour and at most two per value — so the rack contains no run (needs
// three consecutive values in one colour; it has two non-adjacent values) and no
// group (needs three colours at one value; it has at most two).
//
// The only way out is to see the block the other way round: break the L groups
// apart and rebuild the same tiles as 4 runs, one colour per row, which the rack
// tiles then extend. Same tiles, two structures — Latin-rectangle duality, used
// as the trap rather than as the scaffold.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// minMoves — the length of the reference solution under the REAL move model.
//
// usePlayState's DROP reducer, GRID→GRID branch:
//     grid[src.row][src.col] = grid[row][col]
//     grid[row][col]         = tile
// Dropping a grid tile on an OCCUPIED cell SWAPS the two, in one move (and
// Board.tsx fires onCellEnter on occupied cells, so the player can reach it).
// A move therefore relocates one tile (target empty) or two (target occupied).
//
// Fix a goal layout: an injective map tile → cell. Draw one edge per misplaced
// board tile, from the cell it sits on to the cell it belongs on. Goal cells are
// distinct, so every cell has in-degree ≤ 1; a cell holds one tile, so
// out-degree ≤ 1. The misplaced subgraph is therefore a disjoint union of simple
// paths and simple cycles, and:
//
//   - A path of k tiles ends at an empty cell (a cell with an outgoing edge
//     holds a tile; the last one does not). Walk it backwards — tail tile into
//     the empty cell, then each tile into the cell just vacated. k moves.
//   - A cycle of k tiles never touches an empty cell. Swap c1's tile with the
//     occupant of its goal: c1's tile is now home, and the displaced tile sits
//     at c1. Repeat. After k−1 swaps the last tile has landed on c1, its own
//     goal. k−1 moves — one fewer than the k the tiles would cost apart.
//   - Rack tiles have no cell, so they have out-degree 1 and in-degree 0: each
//     heads a path and can never lie on a cycle. One move each.
//
//   cost(goal) = boardTiles + rack − fixed(goal) − cycles(goal)
//
// So minimising cost means maximising fixed + cycles, and a cycle decomposition
// gets both in one O(tiles) pass. The goal family is "one colour's run per row";
// its free parameters are which colour owns which row (a permutation of the ≤ 4
// colours) plus where the block sits, so the whole minimisation is a few hundred
// linear passes. Measured at 0.02 ms on a real extreme puzzle.
//
// This is exact for that family, which is what `optimalMoves` has always meant
// here: the length of the solution the builder can prove, an upper bound on the
// true optimum over every conceivable winning layout.
// ---------------------------------------------------------------------------

const tileKey = (t: Tile): string => `${t.n}_${t.c}`

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  const out: T[][] = []
  for (let i = 0; i < xs.length; i++) {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)]
    for (const p of permutations(rest)) out.push([xs[i], ...p])
  }
  return out
}

export interface GoalPlan {
  /** Reference-solution length: exactly the moves `goal` costs to reach. */
  moves: number
  /** tileKey → [row, col] it occupies in the goal layout. Covers board + rack. */
  goal: Map<string, [number, number]>
}

/**
 * The cost core, shared by every goal shape. Write each board tile's goal cell
 * into `goals`, call `cost()`, repeat — nothing is reallocated per candidate,
 * which is what keeps a few hundred thousand candidate layouts affordable.
 *
 * `goals` must stay injective and in-bounds; the enumerators guarantee both.
 */
interface CostCtx {
  rows: number
  cols: number
  board: { tile: Tile; cell: number }[]
  all: Tile[]
  goals: Int32Array
  cost(): number
}

function makeCostCtx(grid: Grid, rack: Tile[]): CostCtx | null {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null

  const board: { tile: Tile; cell: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c]
      if (t) board.push({ tile: t, cell: r * cols + c })
    }

  const all = [...board.map(b => b.tile), ...rack]
  if (all.length === 0) return null

  const n = board.length
  const rackCount = rack.length

  // cell → index of the board tile sitting on it, or -1.
  const occupant = new Int32Array(rows * cols).fill(-1)
  for (let i = 0; i < n; i++) occupant[board[i].cell] = i

  const goals = new Int32Array(n)
  const mark = new Uint8Array(n) // 0 unseen, 1 on the current walk, 2 retired, 3 fixed
  const walk = new Int32Array(n)

  return {
    rows, cols, board, all, goals,
    cost() {
      mark.fill(0)
      let fixed = 0
      for (let i = 0; i < n; i++) {
        if (board[i].cell === goals[i]) { fixed++; mark[i] = 3 }
      }

      let cycles = 0
      for (let i = 0; i < n; i++) {
        if (mark[i] !== 0) continue
        let len = 0
        let cur = i
        while (cur !== -1 && mark[cur] === 0) {
          mark[cur] = 1
          walk[len++] = cur
          cur = occupant[goals[cur]]
        }
        // Stopped on a node of this very walk ⇒ we closed a cycle. Stopping on
        // a retired node is impossible (in-degree ≤ 1), and stopping on a fixed
        // tile is impossible (it would share that tile's goal cell).
        if (cur !== -1 && mark[cur] === 1) cycles++
        for (let w = 0; w < len; w++) mark[walk[w]] = 2
      }

      return n + rackCount - fixed - cycles
    },
  }
}

function materialize(ctx: CostCtx, moves: number, cellOf: (t: Tile) => number): GoalPlan {
  const goal = new Map<string, [number, number]>()
  for (const t of ctx.all) {
    const cell = cellOf(t)
    goal.set(tileKey(t), [Math.floor(cell / ctx.cols), cell % ctx.cols])
  }
  return { moves, goal }
}

/**
 * Cheapest "one colour's run per row" layout — the goal of `groups-to-runs`.
 * A window is a colour-row needing L consecutive values, so the free parameters
 * are which colour owns which row and where the block sits.
 *
 * Returns null when the tiles cannot form that shape at all (a colour whose
 * values are not contiguous, fewer than 3 of a colour, or no room on the grid).
 * That null is exactly invariant (e) failing, and it is why the mirrored
 * archetype's tiles cannot be scored with this function by accident.
 */
export function planColorRunGoal(grid: Grid, rack: Tile[]): GoalPlan | null {
  const ctx = makeCostCtx(grid, rack)
  if (!ctx) return null
  const { rows, cols, board, all, goals } = ctx

  const vmin = Math.min(...all.map(t => t.n))
  const vmax = Math.max(...all.map(t => t.n))
  const width = vmax - vmin // column offset of the highest value

  const byColor = new Map<Tile['c'], number[]>()
  for (const t of all) byColor.set(t.c, [...(byColor.get(t.c) ?? []), t.n])
  for (const vals of byColor.values()) {
    const sorted = [...vals].sort((a, b) => a - b)
    if (sorted.length < 3) return null
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return null
  }

  const colors = [...byColor.keys()]
  if (colors.length > rows || width >= cols) return null

  const n = board.length
  let best = Infinity
  let bestCellOf: ((t: Tile) => number) | null = null

  for (const perm of permutations(colors)) {
    for (let rowStart = 0; rowStart + colors.length <= rows; rowStart++) {
      const rowOf = new Map<Tile['c'], number>()
      perm.forEach((c, i) => rowOf.set(c, rowStart + i))
      const boardRow = board.map(b => rowOf.get(b.tile.c)!)
      for (let colStart = 0; colStart + width < cols; colStart++) {
        for (let i = 0; i < n; i++)
          goals[i] = boardRow[i] * cols + colStart + (board[i].tile.n - vmin)
        const cost = ctx.cost()
        if (cost < best) {
          best = cost
          const rowSnap = new Map(rowOf)
          const cs = colStart
          bestCellOf = (t: Tile) => rowSnap.get(t.c)! * cols + cs + (t.n - vmin)
        }
      }
    }
  }

  return bestCellOf ? materialize(ctx, best, bestCellOf) : null
}

/**
 * Cheapest "one value's group per row" layout — the goal of `runs-to-groups`,
 * and the exact mirror of the above. A window is now a value-row needing 3 or 4
 * distinct colours, so the free parameters are which value owns which row, the
 * left-to-right colour order inside the groups, and where the block sits.
 *
 * Ranking each row's colours *within the colours that value actually has* keeps
 * every group contiguous automatically, so a 3-colour row never leaves a hole
 * where the missing colour's column would have been.
 *
 * Returns null unless every value has 3 or 4 distinct colours — which is
 * invariant (e) for this shape, and is why `groups-to-runs` tiles (whose
 * boundary values carry only 1-2 colours) can never be scored here by accident.
 */
export function planValueGroupGoal(grid: Grid, rack: Tile[]): GoalPlan | null {
  const ctx = makeCostCtx(grid, rack)
  if (!ctx) return null
  const { rows, cols, board, all, goals } = ctx

  const byValue = new Map<number, Tile['c'][]>()
  for (const t of all) byValue.set(t.n, [...(byValue.get(t.n) ?? []), t.c])
  for (const cs of byValue.values()) {
    if (cs.length < 3 || cs.length > 4) return null
    if (new Set(cs).size !== cs.length) return null
  }

  const values = [...byValue.keys()].sort((a, b) => a - b)
  const vmin = values[0]
  const vmax = values[values.length - 1]
  const maxWidth = Math.max(...[...byValue.values()].map(cs => cs.length))
  if (values.length > rows || maxWidth > cols) return null

  const colors = [...new Set(all.map(t => t.c))]
  const valuePerms = permutations(values)
  const n = board.length
  const vOff = board.map(b => b.tile.n - vmin)
  const rowIdx = new Int32Array(vmax - vmin + 1)
  const boardRank = new Int32Array(n)
  const base = new Int32Array(n)

  let best = Infinity
  let bestCellOf: ((t: Tile) => number) | null = null

  for (const pi of permutations(colors)) {
    const piIndex = new Map(pi.map((c, i) => [c, i]))
    const rank = new Map<string, number>()
    for (const [v, cs] of byValue) {
      const ordered = [...cs].sort((a, b) => piIndex.get(a)! - piIndex.get(b)!)
      ordered.forEach((c, i) => rank.set(tileKey({ n: v, c }), i))
    }
    for (let i = 0; i < n; i++) boardRank[i] = rank.get(tileKey(board[i].tile))!

    for (const vp of valuePerms) {
      for (let i = 0; i < vp.length; i++) rowIdx[vp[i] - vmin] = i
      // Everything that does not depend on where the block sits, hoisted out of
      // the two innermost loops: goal = base + rowStart * cols + colStart.
      for (let i = 0; i < n; i++) base[i] = rowIdx[vOff[i]] * cols + boardRank[i]

      for (let rowStart = 0; rowStart + values.length <= rows; rowStart++) {
        const rowShift = rowStart * cols
        for (let colStart = 0; colStart + maxWidth <= cols; colStart++) {
          const shift = rowShift + colStart
          for (let i = 0; i < n; i++) goals[i] = base[i] + shift
          const cost = ctx.cost()
          if (cost < best) {
            best = cost
            const rowOf = new Map(vp.map((v, i) => [v, rowStart + i]))
            const rankSnap = new Map(rank)
            const cs = colStart
            bestCellOf = (t: Tile) => rowOf.get(t.n)! * cols + cs + rankSnap.get(tileKey(t))!
          }
        }
      }
    }
  }

  return bestCellOf ? materialize(ctx, best, bestCellOf) : null
}

interface Params { L: number; rackSize: number }

function paramsFor(diff: Difficulty): Params {
  switch (diff) {
    case 'easy': return { L: 3, rackSize: 2 }
    case 'medium': return { L: 4, rackSize: 3 }
    case 'hard': return { L: 5, rackSize: 4 }
    case 'extreme': return { L: 6, rackSize: 4 }
  }
}

/**
 * A permutation of the 4 colours sharing no position with `prev`. Purely
 * cosmetic now — it keeps vertically adjacent rows from lining up a colour into
 * a visible column, which would read as a meaningful structure when it is not.
 * Correctness no longer depends on it.
 */
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

  // Board needs L rows; the goal layout needs 4 (one run per colour).
  const rows = Math.max(L, 4) + 2
  // Board strips are 4 wide, all starting at the same colStart; the goal runs
  // span L+2 values from colStart. cols = L + 5 clears both with a margin.
  const cols = L + 5
  const rowStart = 1
  const colStart = 1

  // Which value lands on which row, and the colour order inside each strip.
  const values = shuffle(Array.from({ length: L }, (_, i) => s + i))
  const perms: Tile['c'][][] = []
  for (let i = 0; i < L; i++) {
    const p = derangedFrom(i === 0 ? null : perms[i - 1])
    if (!p) return null
    perms.push(p)
  }

  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (let i = 0; i < L; i++) {
    for (let k = 0; k < 4; k++) grid[rowStart + i][colStart + k] = { n: values[i], c: perms[i][k] }
  }

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

  // Reference solution: the same tiles rebuilt as 4 runs, one colour per row.
  // Which colour takes which row, and where the block sits, are free — so pick
  // the layout the player can reach in the fewest moves. See planColorRunGoal.
  const plan = planColorRunGoal(grid, rack)
  if (!plan) return null

  return { grid, rack: shuffle(rack), allTiles, minMoves: plan.moves }
}

// ---------------------------------------------------------------------------
// Construction: "runs to groups" — the mirror image of the above.
//
// The board shows N=3 colours over L consecutive values, laid out as its 3 RUNS:
// one colour per row, values ascending. The hidden goal is the same tiles as L
// GROUPS: one value per row, distinct colours side by side. Same duality, walked
// the other way, so recognising one direction does not hand you the other.
//
// WHY N IS FORCED TO 3. The goal is groups, and isValidGroup caps a group at 4
// tiles of distinct colours. Every value on the board already carries N colours,
// so the rack can only add a colour a value does not have yet. With N=4 there is
// no such colour, and boundary-value rack tiles (at s-1 or s+L) could only ever
// group with each other — which invariant (c) forbids. So the board takes 3 of
// the 4 colours, and the rack is made entirely of the 4th.
//
// WHY THE RACK IS HOMELESS — the mirror of the group-board argument:
//
//   1. ONE MAXIMAL SEGMENT PER ROW. Each board row is one gapless run and
//      nothing else, so no rack tile can bridge two flanking board tiles.
//
//   2. EVERY STRIP IS A RUN IN A COLOUR THE RACK DOES NOT HAVE. Append a rack
//      tile to either end of any board row and that row's segment holds two
//      colours — so it is not a run — while its values stay distinct — so it is
//      not a group. Whatever the tile is, the row breaks. Note this is why the
//      rack's colour must be off-board: a rack tile at s-1 or s+L in a board
//      colour would simply extend that run, which is failure mode 1 exactly.
//
// So a rack tile can only be covered by an all-rack segment. The rack is one
// colour, so such a segment is never a group, and it is a run only if it holds
// 3 consecutive values — which the value picker below refuses to produce. Hence
// (d) follows from (c) here too, and as before the implication is asserted, not
// assumed: the exhaustive existsNoRelocationWin gate still runs on every board.
//
// The only way out is to break the 3 runs apart and rebuild the same tiles as L
// groups, one value per row, which the rack's 4th colour then completes.
// ---------------------------------------------------------------------------

/**
 * `k` distinct offsets in [0, L) with no 3 consecutive — so the rack, which is
 * all one colour, can never be a run on its own. (It can never be a group
 * either: a group needs distinct colours.)
 */
function pickRackOffsets(L: number, k: number): number[] | null {
  const hasThreeConsecutive = (xs: number[]) => {
    for (let i = 0; i + 2 < xs.length; i++)
      if (xs[i + 1] === xs[i] + 1 && xs[i + 2] === xs[i] + 2) return true
    return false
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked = shuffle(Array.from({ length: L }, (_, i) => i)).slice(0, k).sort((a, b) => a - b)
    if (!hasThreeConsecutive(picked)) return picked
  }
  return null
}

/**
 * L/rackSize-per-difficulty for `runs-to-groups`. Deliberately separate from
 * `paramsFor` (which still governs `groups-to-runs` only): par for this
 * direction is a deterministic function of (L, rackSize) alone — measured as
 * exactly `3L + rackSize - 6`, since every 3×L block's transpose has identical
 * cycle structure regardless of which colours/values are drawn — so it needs
 * its own table to land in the same par range as the other direction at each
 * difficulty label.
 *
 * PERFORMANCE WALL, measured directly (buildRunsToGroupsAt, real wall-clock):
 *   L=5    10.7ms   L=6    63.7ms   L=7   503.3ms   L=8  5335.0ms
 * planValueGroupGoal enumerates L! value-permutations, so cost is O(L!) and
 * L=8 already costs 5+ seconds per build. rackSize barely moves the needle
 * (it only adds O(1) work per cost() call) — L is what must stay small.
 *
 * Consequence: L=8 (~5s/build) was tried for extreme to chase a higher par
 * but reverted — the 10x generation-time cost wasn't worth the calibration
 * gain over L=7 (~0.5s/build, same as hard). Every tier now stays at L<=7.
 * This trade was an explicit, discussed choice — see CLAUDE.md session notes
 * — not an oversight. rackSize is chosen at each L to land par as close to
 * (and, per that choice, slightly above rather than below) the measured
 * groups-to-runs average at the same label; ceiling is bounded by
 * pickRackOffsets' no-3-consecutive constraint, roughly ceil(2L/3).
 */
function runsToGroupsParamsFor(diff: Difficulty): Params {
  switch (diff) {
    case 'easy': return { L: 5, rackSize: 2 }   // par 11  (target avg 10.6, range 10-11)
    case 'medium': return { L: 6, rackSize: 4 } // par 16  (target avg 13.4, range 12-15)
    case 'hard': return { L: 7, rackSize: 5 }   // par 20  (target avg 20.0, range 18-21)
    case 'extreme': return { L: 7, rackSize: 5 } // par 20  (reverted from L=8/par24: ~5s/build wasn't worth it, see CLAUDE.md)
  }
}

export function buildRunsToGroups(diff: Difficulty): ArchetypeResult | null {
  const { L, rackSize } = runsToGroupsParamsFor(diff)
  return buildRunsToGroupsAt(L, rackSize)
}

/** L-parameterized core, exported for tuning/verification — see buildRunsToGroups. */
export function buildRunsToGroupsAt(L: number, rackSize: number): ArchetypeResult | null {
  if (rackSize > L) return null

  // Board values s..s+L-1 all sit inside 1..13; no boundary values are needed.
  const s = randomInt(1, 14 - L)

  // Board needs 3 rows; the goal layout needs L (one group per value).
  const rows = Math.max(3, L) + 2
  // Board runs are L wide; goal groups are at most 4 wide. Both start at
  // colStart, so max(L, 4) + 2 clears either with a margin on each side.
  const cols = Math.max(L, 4) + 2
  const rowStart = 1
  const colStart = 1

  // Three colours go on the board, one run each; the fourth is the whole rack.
  const picked = shuffle(ALL_COLORS)
  const boardColors = picked.slice(0, 3)
  const rackColor = picked[3]

  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
  boardColors.forEach((c, i) => {
    for (let k = 0; k < L; k++) grid[rowStart + i][colStart + k] = { n: s + k, c }
  })

  // (a) the board the player is shown is already fully valid.
  if (!validateGrid(grid)) return null

  // Rack: the off-board colour, at values inside the block, never 3 in a row.
  const offsets = pickRackOffsets(L, rackSize)
  if (!offsets) return null
  const rack: Tile[] = offsets.map(o => ({ n: s + o, c: rackColor }))

  // (c) the rack is not already a puzzle on its own.
  if (formsValidSetAlone(rack)) return null

  // (b) board + rack really is partitionable.
  const boardTiles = grid.flat().filter((t): t is Tile => t !== null)
  const allTiles = [...boardTiles, ...rack]
  if (!solveBag(allTiles).solvable) return null

  // (d) the obvious move must fail — exhaustively, not heuristically.
  const search = existsNoRelocationWin(grid, rack)
  if (search.win || search.exhausted) return null

  // Reference solution: the same tiles rebuilt as L groups, one value per row.
  const plan = planValueGroupGoal(grid, rack)
  if (!plan) return null

  return { grid, rack: shuffle(rack), allTiles, minMoves: plan.moves }
}
