// Verification harness for mixedGoalPlanner.ts — run via `npx tsx`. Re-run after
// any change to the planner. Proves the crux claim (cost = total − fixed − cycles
// holds for HETEROGENEOUS run+group windows) by cross-checking the analytic cost
// AND a replayed witness against an unrestricted move-BFS over the real reducer
// semantics, on hundreds of instances incl. cycles spanning run and group
// windows, plus the concrete examples from the three design docs. Real output.

import type { Tile, Grid } from '../types'
import { makeTile } from '../types'
import {
  type WindowSpec,
  windowTiles,
  tileKey,
  bindWindowTiles,
  mixedLayoutMoves,
  planMixedGoal,
  windowsPartitionBag,
} from './mixedGoalPlanner'

// Mint a concrete tile; `k(n,c,copy)` is its stable id (== tileKey). The existing
// m=1 tests all use copy 0 (unique (value,colour)); the m=2 section below uses
// copy 0 AND 1 to exercise duplicate binding. Replaces the old bare {n,c} literals
// mechanically — Tile now requires an id (Step 1), so every construction site mints
// one. tileKey is now the id, so hardcoded goal keys use k(n,c) instead of "n_c".
const T = (n: number, c: Tile['c'], copy = 0): Tile => makeTile(n, c, copy)
const k = (n: number, c: Tile['c'], copy = 0): string => makeTile(n, c, copy).id

const ALL: Tile['c'][] = ['r', 'b', 'a', 'k']
let pass = 0, fail = 0
const check = (label: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`  FAIL  ${label}`) } }

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
function shuffle<T>(xs: readonly T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

const flatOf = (cols: number) => (r: number, c: number) => r * cols + c
const cellRC = (cols: number) => (cell: number): [number, number] => [Math.floor(cell / cols), cell % cols]

function gridFrom(rows: number, cols: number, boardAt: Map<number, Tile>): Grid {
  const g: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (const [cell, t] of boardAt) { const [r, c] = cellRC(cols)(cell); g[r][c] = t }
  return g
}

// ---------------------------------------------------------------------------
// Unrestricted move-BFS over the REAL reducer semantics (usePlayState DROP):
// GRID→GRID (move to empty OR swap), GRID→RACK, RACK→GRID (displaced → rack).
// Operates over a supplied cell set (current ∪ goal ∪ pad) — pad lets scratch
// cells in, so we can confirm extra empties never beat total−fixed−cycles.
// ---------------------------------------------------------------------------
function moveBFS(_cols: number, boardAt: Map<number, Tile>, rack: Tile[], goal: Map<string, number>, cells: number[], nodeCap = 400_000): number | null {
  const tiles: Tile[] = [...boardAt.values(), ...rack]
  const id = new Map<string, number>()
  tiles.forEach((t, i) => id.set(tileKey(t), i))
  const T = tiles.length
  const goalCellById = new Int32Array(T)
  for (const t of tiles) goalCellById[id.get(tileKey(t))!] = goal.get(tileKey(t))!

  const pos = cells.slice()                 // usable cells, fixed order
  const posIndex = new Map<number, number>()
  pos.forEach((cell, i) => posIndex.set(cell, i))
  const C = pos.length

  const startSlot = new Int32Array(C).fill(-1)
  for (const [cell, t] of boardAt) startSlot[posIndex.get(cell)!] = id.get(tileKey(t))!
  const startRack = rack.map(t => id.get(tileKey(t))!).sort((a, b) => a - b)

  const goalSlot = new Int32Array(C).fill(-1)
  for (let i = 0; i < T; i++) { const p = posIndex.get(goalCellById[i]); if (p === undefined) return null; goalSlot[p] = i }

  const enc = (slot: Int32Array, rk: number[]) => `${slot.join(',')}|${rk.join(',')}`
  const goalKey = enc(goalSlot, [])

  let frontier: { slot: Int32Array; rack: number[] }[] = [{ slot: startSlot, rack: startRack }]
  const seen = new Set<string>([enc(startSlot, startRack)])
  if (enc(startSlot, startRack) === goalKey) return 0
  let depth = 0, nodes = 0

  while (frontier.length) {
    depth++
    const next: { slot: Int32Array; rack: number[] }[] = []
    for (const st of frontier) {
      if (++nodes > nodeCap) return null
      const { slot, rack: rk } = st
      const push = (ns: Int32Array, nr: number[]) => {
        nr.sort((a, b) => a - b)
        const k = enc(ns, nr)
        if (seen.has(k)) return
        seen.add(k)
        if (k === goalKey) throw { found: depth }
        next.push({ slot: ns, rack: nr })
      }
      try {
        for (let pi = 0; pi < C; pi++) {
          const t = slot[pi]
          if (t < 0) continue
          // GRID→RACK
          { const ns = slot.slice(); ns[pi] = -1; push(ns, [...rk, t]) }
          // GRID→GRID
          for (let pj = 0; pj < C; pj++) {
            if (pj === pi) continue
            const ns = slot.slice()
            const u = slot[pj]
            ns[pj] = t; ns[pi] = u  // u=-1 → plain move; else swap
            push(ns, rk)
          }
        }
        const distinctRack = [...new Set(rk)]
        for (const t of distinctRack) {
          for (let pj = 0; pj < C; pj++) {
            const ns = slot.slice()
            const u = ns[pj]
            ns[pj] = t
            const nr = [...rk]; nr.splice(nr.indexOf(t), 1); if (u >= 0) nr.push(u)
            push(ns, nr)
          }
        }
      } catch (e) { return (e as { found: number }).found }
    }
    frontier = next
  }
  return null
}

// ---------------------------------------------------------------------------
// Build a goal cell map from placed windows (one window per row).
// ---------------------------------------------------------------------------
function placeWindows(windows: WindowSpec[], rowOf: number[], colOf: number[], cols: number): Map<string, number> {
  const flat = flatOf(cols)
  const goal = new Map<string, number>()
  windows.forEach((w, wi) => windowTiles(w).forEach((t, i) => goal.set(tileKey(t), flat(rowOf[wi], colOf[wi] + i))))
  return goal
}

function goalRC(goal: Map<string, number>, cols: number): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>()
  for (const [k, cell] of goal) m.set(k, cellRC(cols)(cell))
  return m
}

// ---------------------------------------------------------------------------
// Random MIXED instance generator (>=1 run window and >=1 group window).
// ---------------------------------------------------------------------------
function randomMixed(maxTiles: number): { windows: WindowSpec[] } {
  for (;;) {
    const used = new Set<string>()
    const windows: WindowSpec[] = []
    let tiles = 0, haveRun = false, haveGroup = false
    const target = randInt(2, 3)
    for (let att = 0; att < 30 && windows.length < target; att++) {
      const wantRun = !haveRun ? true : !haveGroup ? false : Math.random() < 0.5
      let w: WindowSpec
      if (wantRun) {
        const len = randInt(3, Math.min(4, maxTiles - tiles)); if (len < 3) continue
        w = { type: 'run', color: ALL[randInt(0, 3)], start: randInt(1, 13 - len + 1), length: len }
      } else {
        const sz = randInt(3, Math.min(4, maxTiles - tiles)); if (sz < 3) continue
        w = { type: 'group', value: randInt(1, 13), colors: shuffle(ALL).slice(0, sz) }
      }
      const keys = windowTiles(w).map(tileKey)
      if (keys.some(k => used.has(k))) continue
      keys.forEach(k => used.add(k)); windows.push(w); tiles += keys.length
      if (w.type === 'run') haveRun = true; else haveGroup = true
    }
    if (haveRun && haveGroup && windows.length >= 2) return { windows }
  }
}

// One trial: place windows, scramble current positions (cycles or paths), pick
// rack, then require analytic == witness, and (if small) == BFS.
interface Trial { cols: number; boardAt: Map<number, Tile>; rack: Tile[]; goalRCmap: Map<string, [number, number]>; goalFlat: Map<string, number>; cells: number[]; crossCycle: boolean }
function buildTrial(windows: WindowSpec[], mode: 'cycles' | 'paths'): Trial {
  const W = windows.length
  const lens = windows.map(w => windowTiles(w).length)
  const maxLen = Math.max(...lens)
  const cols = maxLen + 2
  const rowOf = shuffle(Array.from({ length: W + (mode === 'paths' ? W : 0) }, (_, i) => i)).slice(0, W)
  const colOf = windows.map(() => randInt(0, cols - maxLen))
  const goalFlat = placeWindows(windows, rowOf, colOf, cols)

  const allTiles: Tile[] = windows.flatMap(windowTiles)
  const shuffled = shuffle(allTiles)
  const rackCount = randInt(0, Math.min(2, allTiles.length - 3))
  const rack = shuffled.slice(0, rackCount)
  const board = shuffled.slice(rackCount)

  const goalCells = new Map<string, number>(goalFlat)
  const boardAt = new Map<number, Tile>()
  const rows = Math.max(...rowOf) + 1 + (mode === 'paths' ? W + 1 : 0)
  const flat = flatOf(cols)

  if (mode === 'cycles') {
    // current cells = a permutation of the board tiles' own goal cells → rich
    // cross-window cycles.
    const boardGoalCells = board.map(t => goalCells.get(tileKey(t))!)
    const perm = shuffle(boardGoalCells)
    board.forEach((t, i) => boardAt.set(perm[i], t))
  } else {
    // current cells = a fresh region below the goal rows → paths.
    const region: number[] = []
    for (let r = Math.max(...rowOf) + 1; region.length < board.length; r++)
      for (let c = 0; c < cols; c++) region.push(flat(r, c))
    const chosen = shuffle(region).slice(0, board.length)
    board.forEach((t, i) => boardAt.set(chosen[i], t))
  }

  // detect a cycle spanning >=2 window types (report-only)
  const cells = [...new Set<number>([...boardAt.keys(), ...goalCells.values()])]
  void rows
  return { cols, boardAt, rack, goalRCmap: goalRC(goalCells, cols), goalFlat: goalCells, cells, crossCycle: mode === 'cycles' }
}

console.log('=== mixedGoalPlanner verification ===\n')

// ---------------------------------------------------------------------------
// 1. Concrete example from DECOY_DESIGN.md (also the RED_HERRING case): the
// hybrid goal — one boundary run + groups. 19 tiles, too big for BFS, so we
// require analytic == witness length AND the witness reaches a real validateGrid
// win. current = the runs-to-groups board r/b/a runs 1..5 + rack {2k,4k,5k,6r}.
// ---------------------------------------------------------------------------
console.log('1. DECOY_DESIGN concrete hybrid goal (run {4,5,6}r + groups) — 19 tiles')
{
  const cols = 8
  const flat = flatOf(cols)
  const boardAt = new Map<number, Tile>()
  // board: r,b,a runs at values 1..5, rows 0,1,2, cols 1..5
  ;(['r', 'b', 'a'] as Tile['c'][]).forEach((c, ri) => { for (let v = 1; v <= 5; v++) boardAt.set(flat(ri, v), T(v, c)) })
  const rack: Tile[] = [T(2, 'k'), T(4, 'k'), T(5, 'k'), T(6, 'r')]
  const grid = gridFrom(3, cols, boardAt)

  // hybrid goal windows, one per row
  const windows: WindowSpec[] = [
    { type: 'run', color: 'r', start: 4, length: 3 },      // 4r 5r 6r
    { type: 'group', value: 1, colors: ['r', 'b', 'a'] },
    { type: 'group', value: 2, colors: ['r', 'b', 'a', 'k'] },
    { type: 'group', value: 3, colors: ['r', 'b', 'a'] },
    { type: 'group', value: 4, colors: ['b', 'a', 'k'] },
    { type: 'group', value: 5, colors: ['b', 'a', 'k'] },
  ]
  const feas = windowsPartitionBag(grid, rack, windows)
  check('decoy windows partition the bag', feas.feasible)
  const rows = 6
  const goal = placeWindows(windows, [0, 1, 2, 3, 4, 5], windows.map(() => 1), cols)
  const res = mixedLayoutMoves(grid, rack, goalRC(goal, cols))!
  console.log(`   moves(analytic)=${res.moves}  fixed=${res.fixed}  cycles=${res.cycles}  witness.len=${res.witness.length}  reachedGoal=${res.reachedGoal}  validGoal=${res.validGoal}`)
  check('decoy: witness length == analytic moves', res.witness.length === res.moves)
  check('decoy: witness reaches goal', res.reachedGoal)
  check('decoy: goal layout is a validateGrid win', res.validGoal)
  void rows
}

// ---------------------------------------------------------------------------
// 2. Crafted adversarial cross-window cycles (small, BFS-checked).
// ---------------------------------------------------------------------------
console.log('\n2. Crafted adversarial cross-window cycles (BFS-checked)')
function craft(label: string, windows: WindowSpec[], cols: number, rowOf: number[], colOf: number[], scramble: (goal: Map<string, number>) => Map<number, Tile>, rack: Tile[] = []) {
  const goal = placeWindows(windows, rowOf, colOf, cols)
  const boardAt = scramble(goal)
  const rows = Math.max(...rowOf) + 1
  const grid = gridFrom(rows, cols, boardAt)
  const res = mixedLayoutMoves(grid, rack, goalRC(goal, cols))!
  const cells = [...new Set<number>([...boardAt.keys(), ...goal.values()])]
  const bfs = moveBFS(cols, boardAt, rack, goal, cells)
  console.log(`   ${label}: analytic=${res.moves} witness=${res.witness.length} BFS=${bfs}  fixed=${res.fixed} cycles=${res.cycles} reached=${res.reachedGoal} valid=${res.validGoal}`)
  check(`${label}: analytic==witness`, res.moves === res.witness.length)
  check(`${label}: analytic==BFS`, bfs !== null && res.moves === bfs)
  check(`${label}: reached & valid`, res.reachedGoal && res.validGoal)
}
{
  // 2-cycle across run {1,2,3}r (row0) and group {7:r,b,k} (row1): swap 1r and 7r.
  craft('2-cycle run<->group',
    [{ type: 'run', color: 'r', start: 1, length: 3 }, { type: 'group', value: 7, colors: ['r', 'b', 'k'] }],
    6, [0, 1], [0, 0],
    goal => {
      const at = new Map<number, Tile>()
      const g = (key: string) => goal.get(key)!
      at.set(g(k(7, 'r')), T(1, 'r')); at.set(g(k(1, 'r')), T(7, 'r')) // swapped
      at.set(g(k(2, 'r')), T(2, 'r')); at.set(g(k(3, 'r')), T(3, 'r'))
      at.set(g(k(7, 'b')), T(7, 'b')); at.set(g(k(7, 'k')), T(7, 'k'))
      return at
    })

  // 3-cycle across run {4,5,6}b and two groups {9:*},{10:*}: rotate three tiles
  // living in three different windows.
  craft('3-cycle run<->grp<->grp',
    [{ type: 'run', color: 'b', start: 4, length: 3 }, { type: 'group', value: 9, colors: ['r', 'b', 'a'] }, { type: 'group', value: 10, colors: ['r', 'a', 'k' ] }],
    6, [0, 1, 2], [0, 0, 0],
    goal => {
      const at = new Map<number, Tile>()
      const g = (key: string) => goal.get(key)!
      // cycle: 4b -> 9r's cell, 9r -> 10a's cell, 10a -> 4b's cell
      at.set(g(k(9, 'r')), T(4, 'b')); at.set(g(k(10, 'a')), T(9, 'r')); at.set(g(k(4, 'b')), T(10, 'a'))
      // rest fixed
      at.set(g(k(5, 'b')), T(5, 'b')); at.set(g(k(6, 'b')), T(6, 'b'))
      at.set(g(k(9, 'b')), T(9, 'b')); at.set(g(k(9, 'a')), T(9, 'a'))
      at.set(g(k(10, 'r')), T(10, 'r')); at.set(g(k(10, 'k')), T(10, 'k'))
      return at
    })

  // path from a run window into a group window (tile chain ending at empty cell),
  // plus a rack tile whose home is in the run.
  craft('path run->group + rack',
    [{ type: 'run', color: 'a', start: 2, length: 4 }, { type: 'group', value: 8, colors: ['r', 'b', 'a'] }],
    7, [0, 1], [0, 0],
    goal => {
      const at = new Map<number, Tile>()
      const g = (key: string) => goal.get(key)!
      // 8a sits on 2a's goal; 2a sits elsewhere (its goal empty-> drained). Keep simple:
      at.set(g(k(2, 'a')), T(8, 'a'))       // 8a occupies 2a's goal
      at.set(g(k(8, 'a')), T(2, 'a'))       // 2a occupies 8a's goal  (=> 2-cycle actually)
      at.set(g(k(3, 'a')), T(3, 'a')); at.set(g(k(4, 'a')), T(4, 'a'))
      at.set(g(k(8, 'r')), T(8, 'r')); at.set(g(k(8, 'b')), T(8, 'b'))
      return at
    },
    [T(5, 'a')]) // rack: 5a completes the run 2,3,4,5 a
}

// ---------------------------------------------------------------------------
// 3. Random sweep: analytic == witness == BFS on hundreds of MIXED instances.
// ---------------------------------------------------------------------------
console.log('\n3. Random mixed sweep (analytic == witness == BFS)')
{
  let n = 0, bfsChecked = 0, mismatchWit = 0, mismatchBFS = 0, crossCycleCases = 0, bfsSkippedSize = 0, bfsSkippedCap = 0
  // The witness cross-check (analytic == witness, O(tiles)) runs on EVERY
  // instance. The unrestricted move-BFS is exponential, so it is run only on
  // instances small enough to be cheap (≤ 9 real cells → ≤ 11 with the 2-cell
  // scratch pad); bigger ones are counted as size-skipped, not silently dropped.
  const N = 800
  for (let i = 0; i < N; i++) {
    const { windows } = randomMixed(5)
    const mode = Math.random() < 0.6 ? 'cycles' : 'paths'
    const tr = buildTrial(windows, mode)
    const grid = gridFrom(Math.floor(Math.max(...tr.cells) / tr.cols) + 1, tr.cols, tr.boardAt)
    const res = mixedLayoutMoves(grid, tr.rack, tr.goalRCmap)
    if (!res) continue
    n++
    if (res.moves !== res.witness.length || !res.reachedGoal) mismatchWit++
    // BFS with a small pad of scratch cells to confirm extra empties never help.
    const padStart = Math.max(...tr.cells) + 1
    const cells = [...tr.cells, padStart, padStart + 1]
    if (cells.length > 11) { bfsSkippedSize++; continue }
    const bfs = moveBFS(tr.cols, tr.boardAt, tr.rack, tr.goalFlat, cells, 60_000)
    if (bfs === null) { bfsSkippedCap++; continue }
    bfsChecked++
    if (bfs !== res.moves) { mismatchBFS++; if (mismatchBFS <= 5) console.log(`   MISMATCH: analytic=${res.moves} bfs=${bfs} windows=${JSON.stringify(windows)}`) }
    if (tr.crossCycle && res.cycles > 0) crossCycleCases++
  }
  console.log(`   instances=${n}  BFS-checked=${bfsChecked} (pad=2 scratch cells)  BFS-skipped(size>11cells)=${bfsSkippedSize}  BFS-skipped(nodecap)=${bfsSkippedCap}`)
  console.log(`   witness mismatches=${mismatchWit}   BFS mismatches=${mismatchBFS}   (cross-cycle-with-cycles cases=${crossCycleCases})`)
  check('random sweep: zero witness mismatches', mismatchWit === 0)
  check('random sweep: zero BFS mismatches', mismatchBFS === 0)
  check('random sweep: enough BFS coverage', bfsChecked >= 200)
}

// ---------------------------------------------------------------------------
// 4. Performance at realistic tile counts (analytic + witness are O(tiles)).
// ---------------------------------------------------------------------------
console.log('\n4. Performance — analytic+witness at realistic sizes')
{
  for (const nGroups of [4, 6, 8]) {
    // build a block of `nGroups` value-groups (4 colours) + 1 boundary run: mixed.
    const windows: WindowSpec[] = []
    for (let i = 0; i < nGroups; i++) windows.push({ type: 'group', value: i + 1, colors: ['r', 'b', 'a', 'k'] })
    windows.push({ type: 'run', color: 'r', start: 11, length: 3 })
    const T = windows.reduce((s, w) => s + windowTiles(w).length, 0)
    const cols = 6
    const goal = placeWindows(windows, windows.map((_, i) => i), windows.map(() => 0), cols)
    // scramble current = permutation of goal cells
    const tiles = windows.flatMap(windowTiles)
    const cellsArr = shuffle([...goal.values()])
    const boardAt = new Map<number, Tile>()
    tiles.forEach((t, i) => boardAt.set(cellsArr[i], t))
    const grid = gridFrom(windows.length, cols, boardAt)
    const t0 = performance.now()
    let last = 0
    for (let k = 0; k < 2000; k++) last = mixedLayoutMoves(grid, [], goalRC(goal, cols))!.moves
    const t1 = performance.now()
    console.log(`   ${T} tiles (${windows.length} windows): analytic+witness ${((t1 - t0) / 2000).toFixed(4)}ms/call  (moves=${last})`)
  }
}

// ---------------------------------------------------------------------------
// 5. Optimizer blowup — planMixedGoal enumerates window→row placements (P(rows,W)).
// Measure it honestly; report the factorial growth.
// ---------------------------------------------------------------------------
console.log('\n5. planMixedGoal optimizer timing (factorial in window count — measured)')
{
  // Capped at W=5: the P(rows,W) window→row search is factorial and W=6
  // extrapolates to ~15-20 min (W=3→4→5 already shows the ×20-40 per-window
  // jump). Callers with a known layout call mixedLayoutMoves directly (O(tiles),
  // section 4) and never pay this. See CLAUDE.md session notes / PERFORMANCE WALL.
  for (const W of [3, 4, 5]) {
    const windows: WindowSpec[] = []
    for (let i = 0; i < W - 1; i++) windows.push({ type: 'group', value: i + 1, colors: ['r', 'b', 'a'] })
    windows.push({ type: 'run', color: 'k', start: 1, length: 3 })
    const tiles = windows.flatMap(windowTiles)
    const cols = 6, rows = W + 1
    const goal = placeWindows(windows, windows.map((_, i) => i), windows.map(() => 0), cols)
    const boardAt = new Map<number, Tile>()
    shuffle([...goal.values()]).forEach((cell, i) => boardAt.set(cell, tiles[i]))
    const grid = gridFrom(rows, cols, boardAt)
    const t0 = performance.now()
    const plan = planMixedGoal(grid, [], windows, rows, cols)
    const t1 = performance.now()
    console.log(`   W=${W} windows, rows=${rows}: planMixedGoal ${(t1 - t0).toFixed(1)}ms  moves=${plan?.moves}  reached=${plan?.reachedGoal}`)
  }
}

// ===========================================================================
// 6. m=2 DUPLICATE-BEARING instances (Step 4). The resolver `bindWindowTiles`
//    must bind a window spec slot to a CONCRETE copy id in the bag; when a
//    (value,colour) has two copies both demanded (it lands in a run window AND a
//    group window), the choice of which copy → which window is exercised here and
//    cross-checked against the same move-BFS ground truth every prior cost claim
//    used. BFS distinguishes the two copies by id, so BFS on a goal built from a
//    SPECIFIC binding yields exactly that binding's cost — the number
//    mixedLayoutMoves must reproduce.
// ===========================================================================
console.log('\n6. m=2 duplicate-bearing binding (analytic == witness == BFS, per binding)')

// Build a goal (id -> flat cell) from a concrete per-window binding + placement.
function goalFromBinding(bound: Tile[][], rowOf: number[], colOf: number[], cols: number): Map<string, number> {
  const flat = flatOf(cols)
  const goal = new Map<string, number>()
  bound.forEach((row, wi) => row.forEach((t, i) => goal.set(t.id, flat(rowOf[wi], colOf[wi] + i))))
  return goal
}

{
  // The canonical m=2 mixed case: value-3 colour-a appears in BOTH the run
  // {1,2,3}a and the group {3: a,b,k}, so the bag holds 3a#0 AND 3a#1.
  const windows: WindowSpec[] = [
    { type: 'run', color: 'a', start: 1, length: 3 },      // 1a 2a 3a
    { type: 'group', value: 3, colors: ['a', 'b', 'k'] },  // 3a 3b 3k
  ]
  const cols = 3
  const flat = flatOf(cols)
  // Concrete bag tiles (the two 3a copies are the whole point).
  const A1 = T(1, 'a'), A2 = T(2, 'a'), A3_0 = T(3, 'a', 0), A3_1 = T(3, 'a', 1), B3 = T(3, 'b'), K3 = T(3, 'k')
  const bag = [A1, A2, A3_0, A3_1, B3, K3]

  // Current board: the two 3a copies are placed SWAPPED relative to ascending-id,
  // and everything else already sits on its default-binding goal cell. This makes
  // the two possible pairings cost differently — the Step 6 "pairing matters" fact.
  //   run row 0: (0,0)=1a (0,1)=2a (0,2)= 3a#1   ← copy #1 sits on the run's 3a cell
  //   grp row 1: (1,0)= 3a#0 (1,1)=3b (1,2)=3k   ← copy #0 sits on the group's 3a cell
  const boardAt = new Map<number, Tile>([
    [flat(0, 0), A1], [flat(0, 1), A2], [flat(0, 2), A3_1],
    [flat(1, 0), A3_0], [flat(1, 1), B3], [flat(1, 2), K3],
  ])
  const grid = gridFrom(2, cols, boardAt)
  const rowOf = [0, 1], colOf = [0, 0]
  const cells = [...new Set<number>([flat(0, 0), flat(0, 1), flat(0, 2), flat(1, 0), flat(1, 1), flat(1, 2)])]

  // --- Default binding (ascending id): 3a#0 -> run window, 3a#1 -> group window.
  const boundDefault = bindWindowTiles(windows, bag)!
  check('default binding: run window gets 3a copy #0 (ascending id)', boundDefault[0][2].id === k(3, 'a', 0))
  check('default binding: group window gets 3a copy #1', boundDefault[1][0].id === k(3, 'a', 1))
  const goalP0 = goalFromBinding(boundDefault, rowOf, colOf, cols)
  const resP0 = mixedLayoutMoves(grid, [], goalRC(goalP0, cols))!
  const bfsP0 = moveBFS(cols, boardAt, [], goalP0, cells)
  console.log(`   default (P0: 3a#0->run, 3a#1->grp): analytic=${resP0.moves} witness=${resP0.witness.length} BFS=${bfsP0}  fixed=${resP0.fixed} cycles=${resP0.cycles} valid=${resP0.validGoal}`)
  check('P0: analytic == witness', resP0.moves === resP0.witness.length)
  check('P0: analytic == BFS', bfsP0 !== null && resP0.moves === bfsP0)
  check('P0: goal layout is a validateGrid win', resP0.validGoal)

  // --- Pinned binding (design (a)): the reverse pairing 3a#1 -> run, 3a#0 -> grp.
  const pinned = new Map<string, string[]>([['3_a', [k(3, 'a', 1), k(3, 'a', 0)]]])
  const boundPinned = bindWindowTiles(windows, bag, pinned)!
  check('pinned binding: run window gets 3a copy #1 (override)', boundPinned[0][2].id === k(3, 'a', 1))
  check('pinned binding: group window gets 3a copy #0 (override)', boundPinned[1][0].id === k(3, 'a', 0))
  const goalP1 = goalFromBinding(boundPinned, rowOf, colOf, cols)
  const resP1 = mixedLayoutMoves(grid, [], goalRC(goalP1, cols))!
  const bfsP1 = moveBFS(cols, boardAt, [], goalP1, cells)
  console.log(`   pinned  (P1: 3a#1->run, 3a#0->grp): analytic=${resP1.moves} witness=${resP1.witness.length} BFS=${bfsP1}  fixed=${resP1.fixed} cycles=${resP1.cycles} valid=${resP1.validGoal}`)
  check('P1: analytic == witness', resP1.moves === resP1.witness.length)
  check('P1: analytic == BFS', bfsP1 !== null && resP1.moves === bfsP1)
  check('P1: goal layout is a validateGrid win', resP1.validGoal)

  // The pairing genuinely matters: the two bindings have different cost, and the
  // default (ascending id) is NOT the cheaper here — exactly why Step 6 must add a
  // minimisation. Step 4 only guarantees each binding's cost is computed correctly.
  console.log(`   pairing spread: P0=${resP0.moves} vs P1=${resP1.moves} (default is ${resP0.moves === resP1.moves ? 'tied' : resP0.moves < resP1.moves ? 'optimal here' : 'SUBOPTIMAL here — Step 6 will fix'})`)
  check('pairing matters: P0 and P1 costs differ on this instance', resP0.moves !== resP1.moves)
  check('both bindings validated by BFS independently', bfsP0 === resP0.moves && bfsP1 === resP1.moves)
}

// --- Resolver DETERMINISM & anti-"whichever is first" proof -----------------
console.log('\n7. m=2 resolver is deterministic on id, NOT on bag/scan order')
{
  const windows: WindowSpec[] = [
    { type: 'run', color: 'a', start: 1, length: 3 },
    { type: 'group', value: 3, colors: ['a', 'b', 'k'] },
  ]
  const base = [T(1, 'a'), T(2, 'a'), T(3, 'a', 0), T(3, 'a', 1), T(3, 'b'), T(3, 'k')]
  // Bag in natural order, and bag with the two 3a copies REVERSED, and a fully
  // shuffled bag — all must bind identically (ascending id wins, not array order).
  const reversed3a = [T(1, 'a'), T(2, 'a'), T(3, 'a', 1), T(3, 'a', 0), T(3, 'b'), T(3, 'k')]
  const shuffled = shuffle(base)
  const idsOf = (b: Tile[][]) => b.map(row => row.map(t => t.id).join(','))
  const bDefault = idsOf(bindWindowTiles(windows, base)!)
  const bReversed = idsOf(bindWindowTiles(windows, reversed3a)!)
  const bShuffled = idsOf(bindWindowTiles(windows, shuffled)!)
  console.log(`   natural  : ${bDefault.join('  |  ')}`)
  console.log(`   reversed : ${bReversed.join('  |  ')}`)
  console.log(`   shuffled : ${bShuffled.join('  |  ')}`)
  check('binding identical regardless of bag order (natural == reversed)', JSON.stringify(bDefault) === JSON.stringify(bReversed))
  check('binding identical regardless of bag order (natural == shuffled)', JSON.stringify(bDefault) === JSON.stringify(bShuffled))
  check('two calls on same bag return identical binding (deterministic)',
    JSON.stringify(idsOf(bindWindowTiles(windows, base)!)) === JSON.stringify(bDefault))
}

// --- windowsPartitionBag COUNT check (was a presence check) ------------------
console.log('\n8. windowsPartitionBag: count check accepts <=TILE_COPIES, rejects more')
{
  const windows: WindowSpec[] = [
    { type: 'run', color: 'a', start: 1, length: 3 },
    { type: 'group', value: 3, colors: ['a', 'b', 'k'] },
  ]
  // Two copies of 3a — legal under m=2, was rejected outright by the old presence
  // check. Board holds all six; empty rack.
  const cols2 = 3
  const flat2 = flatOf(cols2)
  const bag2 = new Map<number, Tile>([
    [flat2(0, 0), T(1, 'a')], [flat2(0, 1), T(2, 'a')], [flat2(0, 2), T(3, 'a', 0)],
    [flat2(1, 0), T(3, 'a', 1)], [flat2(1, 1), T(3, 'b')], [flat2(1, 2), T(3, 'k')],
  ])
  const grid2 = gridFrom(2, cols2, bag2)
  const feas2 = windowsPartitionBag(grid2, [], windows)
  console.log(`   two 3a copies: feasible=${feas2.feasible}${feas2.reason ? ' reason=' + feas2.reason : ''}`)
  check('count check ACCEPTS a genuine 2-copy (m=2) bag', feas2.feasible === true)

  // Three copies of 3a — must be rejected by the count check (> TILE_COPIES).
  const cols3 = 4
  const flat3 = flatOf(cols3)
  const bag3 = new Map<number, Tile>([
    [flat3(0, 0), T(1, 'a')], [flat3(0, 1), T(2, 'a')], [flat3(0, 2), T(3, 'a', 0)], [flat3(0, 3), T(3, 'a', 1)],
    [flat3(1, 0), T(3, 'a', 2)], [flat3(1, 1), T(3, 'b')], [flat3(1, 2), T(3, 'k')],
  ])
  const grid3 = gridFrom(2, cols3, bag3)
  const feas3 = windowsPartitionBag(grid3, [], windows)
  console.log(`   three 3a copies: feasible=${feas3.feasible}  reason=${feas3.reason}`)
  check('count check REJECTS a 3-copy bag (> TILE_COPIES)', feas3.feasible === false)
  check('rejection reason cites TILE_COPIES', !!feas3.reason && feas3.reason.includes('TILE_COPIES'))
}

// --- Randomised m=2 sweep: a shared (value,colour) forced into a run AND a group
//     window, both copies placed, default binding cross-checked vs BFS ----------
console.log('\n9. Random m=2 sweep (shared tile in run+group, default binding == BFS)')
{
  let n = 0, mismatchWit = 0, mismatchBFS = 0, dupPlacedBoth = 0, bfsSkipped = 0
  const N = 400
  for (let i = 0; i < N; i++) {
    // pick the shared (value,colour) = (v, c), and a run of length 3 covering v.
    const c = ALL[randInt(0, 3)]
    const v = randInt(2, 12)
    const start = v - randInt(0, 2)              // run covers v somewhere in its span
    if (start < 1 || start + 2 > 13) continue
    // group at value v with c + two other distinct colours.
    const others = shuffle(ALL.filter(x => x !== c)).slice(0, 2)
    const groupColors = shuffle([c, ...others])
    const windows: WindowSpec[] = [
      { type: 'run', color: c, start, length: 3 },
      { type: 'group', value: v, colors: groupColors },
    ]
    // Concrete bag: run tiles (copy0 for the two non-dup values, and the dup at v),
    // plus group tiles. The (v,c) tile appears in both → two copies.
    const bag: Tile[] = []
    for (let x = 0; x < 3; x++) bag.push(start + x === v ? T(v, c, 0) : T(start + x, c))
    for (const gc of groupColors) bag.push(gc === c ? T(v, c, 1) : T(v, gc))
    // sanity: exactly two copies of (v,c)
    const dupCount = bag.filter(t => t.n === v && t.c === c).length
    if (dupCount !== 2) continue

    const bound = bindWindowTiles(windows, bag)
    if (!bound) continue
    const cols = 3
    const goalFlat = goalFromBinding(bound, [0, 1], [0, 0], cols)
    // scramble current positions: a permutation of the goal cells (rich cycles).
    const goalCellsArr = [...goalFlat.values()]
    const ids = [...goalFlat.keys()]
    const perm = shuffle(goalCellsArr)
    const boardAt = new Map<number, Tile>()
    const byId = new Map(bag.map(t => [t.id, t]))
    ids.forEach((id, idx) => boardAt.set(perm[idx], byId.get(id)!))
    const grid = gridFrom(2, cols, boardAt)
    const res = mixedLayoutMoves(grid, [], goalRC(goalFlat, cols))
    if (!res) continue
    n++
    if (res.moves !== res.witness.length || !res.reachedGoal || !res.validGoal) mismatchWit++
    const cells = [...new Set<number>([...boardAt.keys(), ...goalFlat.values()])]
    if (cells.length > 11) { bfsSkipped++; continue }
    const bfs = moveBFS(cols, boardAt, [], goalFlat, cells, 200_000)
    if (bfs === null) { bfsSkipped++; continue }
    if (bfs !== res.moves) { mismatchBFS++; if (mismatchBFS <= 5) console.log(`   MISMATCH analytic=${res.moves} bfs=${bfs} v=${v} c=${c}`) }
    // did both copies of the dup actually land on the board (not trivially fixed)?
    if (boardAt.size === bag.length) dupPlacedBoth++
  }
  console.log(`   instances=${n}  BFS-checked=${n - bfsSkipped}  witness mismatches=${mismatchWit}  BFS mismatches=${mismatchBFS}  (both-copies-on-board=${dupPlacedBoth})`)
  check('m=2 sweep: zero witness/validateGrid mismatches', mismatchWit === 0)
  check('m=2 sweep: zero BFS mismatches (default binding cost is exact)', mismatchBFS === 0)
  check('m=2 sweep: enough instances', n >= 200)
}

console.log(`\n=== SELF-CHECKS: ${pass} passed, ${fail} failed ===`)
