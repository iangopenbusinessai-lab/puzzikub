// Verification harness for the DECOY archetype (buildDecoy / buildDecoyAt in
// archetypes.ts). Run: `npx tsx src/lib/decoy.verify.ts`. Re-run after any change
// to the decoy construction or the mixed planner it depends on.
//
// Proves, with real executed output per CLAUDE.md's anti-illusion rule:
//   (a) validateGrid(board) true, zero invalid cells at move zero
//   (b) solveBag(all tiles).solvable — the decoy has a real home
//   (c) formsValidSetAlone(expanded rack) === false
//   (d) existsNoRelocationWin(board, rack): win=false AND not exhausted
//   (e) genuine-home: mixedLayoutMoves reaches a validateGrid win
//   TRAP: committing the decoy to its obvious run-extension leaves the remainder
//         UNSOLVABLE (solveBag === false) — the tempting move is a dead end
//   OBVIOUS: the decoy actually has a visible board placement (obviousSpots > 0)
// plus: witness simulated through the REAL reducer semantics == par and wins,
// construction timing, and that decoys never build on easy/medium.

import type { Tile, Grid } from '../types'
import { validateGrid, getInvalidCells } from './validator'
import { solveBag } from './solver'
import {
  buildDecoy, buildDecoyAt, type DecoyBuild,
  formsValidSetAlone, existsNoRelocationWin, obviousSpots,
} from './archetypes'
import { mixedLayoutMoves } from './mixedGoalPlanner'
import { generatePuzzle } from './generator'

let pass = 0, fail = 0
const check = (label: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`  FAIL  ${label}`) } }

// Faithful transcription of usePlayState's DROP reducer (same as verifyEngine.ts):
// GRID→GRID onto an occupied cell SWAPS; RACK→GRID sends the displaced tile → rack.
type Drop =
  | { from: 'grid'; r: number; c: number; tr: number; tc: number }
  | { from: 'rack'; idx: number; tr: number; tc: number }
function applyDrop(grid: Grid, rack: Tile[], d: Drop): void {
  if (d.from === 'rack') {
    const tile = rack[d.idx]
    rack.splice(d.idx, 1)
    const displaced = grid[d.tr][d.tc]
    grid[d.tr][d.tc] = tile
    if (displaced) rack.push(displaced)
  } else {
    const tile = grid[d.r][d.c]
    grid[d.r][d.c] = grid[d.tr][d.tc]
    grid[d.tr][d.tc] = tile
  }
}
interface SimResult { moves: number; won: boolean; note: string }
function simulateGoal(startGrid: Grid, startRack: Tile[], goal: Map<string, [number, number]>): SimResult {
  const grid = startGrid.map(r => [...r])
  const rack = [...startRack]
  const goalOf = (t: Tile) => goal.get(t.id)! // goal is id-keyed (m=2 Step 5)
  let moves = 0
  const misplaced = (): [number, number][] => {
    const out: [number, number][] = []
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[0].length; c++) {
        const t = grid[r][c]
        if (!t) continue
        const [gr, gc] = goalOf(t)
        if (gr !== r || gc !== c) out.push([r, c])
      }
    return out
  }
  const budget = grid.length * grid[0].length * 4
  for (let guard = 0; guard <= budget; guard++) {
    const bad = misplaced()
    if (bad.length === 0) break
    if (guard === budget) return { moves, won: false, note: 'board phase did not terminate' }
    const drain = bad.find(([r, c]) => { const [gr, gc] = goalOf(grid[r][c]!); return grid[gr][gc] === null })
    const [r, c] = drain ?? bad[0]
    const [tr, tc] = goalOf(grid[r][c]!)
    applyDrop(grid, rack, { from: 'grid', r, c, tr, tc })
    moves++
  }
  while (rack.length > 0) {
    const [tr, tc] = goalOf(rack[0])
    if (grid[tr][tc] !== null) return { moves, won: false, note: `rack goal (${tr},${tc}) occupied` }
    applyDrop(grid, rack, { from: 'rack', idx: 0, tr, tc })
    moves++
  }
  const won = rack.length === 0 && validateGrid(grid)
  return { moves, won, note: won ? 'validateGrid win' : 'final grid INVALID' }
}

// Independently re-check every invariant on one built decoy.
function checkInvariants(b: DecoyBuild): { ok: boolean; a: boolean; bInv: boolean; c: boolean; d: boolean; e: boolean; trap: boolean; obvious: boolean } {
  const a = validateGrid(b.grid) && getInvalidCells(b.grid).size === 0
  const bInv = solveBag(b.allTiles).solvable === true
  const c = formsValidSetAlone(b.rack) === false
  const dSearch = existsNoRelocationWin(b.grid, b.rack)
  const d = dSearch.win === false && dSearch.exhausted === false
  const home = mixedLayoutMoves(b.grid, b.rack, b.goal)
  const e = !!home && home.reachedGoal && home.validGoal
  const remainder = b.allTiles.filter(t => !b.runExtension.some(x => x.n === t.n && x.c === t.c))
  const trap = solveBag(remainder).solvable === false
  const obvious = obviousSpots(b.grid, b.decoy).length > 0
  return { ok: a && bInv && c && d && e && trap && obvious, a, bInv, c, d, e, trap, obvious }
}

console.log('=== DECOY archetype verification ===\n')

const DIFFS = ['hard', 'extreme'] as const

// ---------------------------------------------------------------------------
// 0. Decoys must NOT build on easy/medium.
// ---------------------------------------------------------------------------
console.log('0. Decoys restricted to hard/extreme')
check('buildDecoy(easy) === null', buildDecoy('easy') === null)
check('buildDecoy(medium) === null', buildDecoy('medium') === null)
console.log(`   buildDecoy(easy)=${buildDecoy('easy')} buildDecoy(medium)=${buildDecoy('medium')}\n`)

// ---------------------------------------------------------------------------
// 1. 20+ puzzles per difficulty: every invariant + trap + genuine-home.
// ---------------------------------------------------------------------------
console.log('1. Invariants over 25 puzzles/difficulty (a,b,c,d,e,TRAP,OBVIOUS)')
for (const diff of DIFFS) {
  const N = 25
  const tally = { a: 0, bInv: 0, c: 0, d: 0, e: 0, trap: 0, obvious: 0, all: 0 }
  let built = 0
  const pars = new Set<number>()
  let sample = ''
  for (let i = 0; i < N; i++) {
    const b = buildDecoy(diff)
    if (!b) continue
    built++
    pars.add(b.minMoves)
    const r = checkInvariants(b)
    if (r.a) tally.a++; if (r.bInv) tally.bInv++; if (r.c) tally.c++; if (r.d) tally.d++
    if (r.e) tally.e++; if (r.trap) tally.trap++; if (r.obvious) tally.obvious++
    if (r.ok) tally.all++
    if (!sample) sample = `decoy={${b.decoy.n}${b.decoy.c}} s=${b.s} L=${b.L} par=${b.minMoves} grid=${b.grid.length}x${b.grid[0].length}`
  }
  console.log(`  ${diff}: built ${built}/${N}  |  a=${tally.a} b=${tally.bInv} c=${tally.c} d=${tally.d} e=${tally.e} TRAP=${tally.trap} OBVIOUS=${tally.obvious}  ALL=${tally.all}  pars={${[...pars].sort((x, y) => x - y)}}`)
  console.log(`     e.g. ${sample}`)
  check(`${diff}: built at least 20`, built >= 20)
  check(`${diff}: all invariants hold on every build`, tally.all === built && built > 0)
}

// ---------------------------------------------------------------------------
// 2. Witness simulated through REAL reducer semantics == par, and wins.
// ---------------------------------------------------------------------------
console.log('\n2. Witness simulated through the real DROP reducer (simulated == par, win)')
for (const diff of DIFFS) {
  let simmed = 0, exact = 0, wonAll = 0
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const b = buildDecoy(diff)
    if (!b) { lines.push(`  #${i + 1} builder returned null`); continue }
    const sim = simulateGoal(b.grid, b.rack, b.goal)
    simmed++
    if (sim.moves === b.minMoves) exact++
    if (sim.won) wonAll++
    lines.push(`  #${i + 1}  par=${String(b.minMoves).padStart(2)}  simulated=${String(sim.moves).padStart(2)}  ${sim.moves === b.minMoves ? 'exact' : 'MISMATCH'}  ${sim.note}`)
  }
  console.log(`  ${diff}:`)
  for (const l of lines) console.log(l)
  check(`${diff}: >=5 simulated`, simmed >= 5)
  check(`${diff}: every simulated == par`, exact === simmed && simmed > 0)
  check(`${diff}: every simulation wins`, wonAll === simmed && simmed > 0)
}

// ---------------------------------------------------------------------------
// 3. Construction timing across 12 builds/difficulty (watch for a cliff).
// ---------------------------------------------------------------------------
console.log('\n3. Construction wall-clock (12 builds/difficulty)')
for (const diff of DIFFS) {
  const times: number[] = []
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now()
    const b = buildDecoy(diff)
    const t1 = performance.now()
    if (b) times.push(t1 - t0)
  }
  times.sort((a, b) => a - b)
  const avg = times.reduce((s, x) => s + x, 0) / times.length
  console.log(`  ${diff}: builds=${times.length}  avg=${avg.toFixed(1)}ms  min=${times[0].toFixed(1)}ms  max=${times[times.length - 1].toFixed(1)}ms`)
  check(`${diff}: construction stays under 1s/build`, times[times.length - 1] < 1000)
}

// ---------------------------------------------------------------------------
// 4. Integration: generatePuzzle actually emits decoys at hard/extreme, tagged
// internally, with a valid solvable puzzle and par == optimalMoves.
// ---------------------------------------------------------------------------
console.log('\n4. generatePuzzle integration (decoy layer wired, hidden tag)')
for (const diff of DIFFS) {
  let decoys = 0, total = 0, validAll = 0
  for (let i = 0; i < 120; i++) {
    const p = generatePuzzle(diff)
    if (!p) continue
    total++
    if (p.archetypeId === 'runs-to-groups-decoy') {
      decoys++
      const all = [...p.grid.flat().filter((t): t is Tile => t !== null), ...p.rack]
      if (validateGrid(p.grid) && solveBag(all).solvable && p.optimalMoves > 0) validAll++
    }
  }
  console.log(`  ${diff}: ${decoys}/${total} puzzles were decoys; ${validAll}/${decoys} valid+solvable+par>0`)
  check(`${diff}: at least one decoy emitted`, decoys > 0)
  check(`${diff}: every emitted decoy is valid`, validAll === decoys)
}

// Extreme should visibly out-produce hard (0.6 vs 0.35).
{
  const rate = (diff: 'hard' | 'extreme') => {
    let d = 0, n = 0
    for (let i = 0; i < 300; i++) { const p = generatePuzzle(diff); if (!p) continue; n++; if (p.archetypeId === 'runs-to-groups-decoy') d++ }
    return d / n
  }
  const rh = rate('hard'), re = rate('extreme')
  console.log(`  decoy rate: hard=${(rh * 100).toFixed(0)}%  extreme=${(re * 100).toFixed(0)}%`)
  check('extreme decoy rate > hard decoy rate', re > rh)
}

// buildDecoyAt sanity across the L range the difficulty table uses.
console.log('\n5. buildDecoyAt(L) across L=5..8')
for (const L of [5, 6, 7, 8]) {
  const b = buildDecoyAt(L)
  if (!b) { console.log(`  L=${L}: null`); check(`L=${L} builds`, false); continue }
  const r = checkInvariants(b)
  const sim = simulateGoal(b.grid, b.rack, b.goal)
  console.log(`  L=${L}: par=${b.minMoves} sim=${sim.moves} won=${sim.won} allInv=${r.ok} grid=${b.grid.length}x${b.grid[0].length}`)
  check(`L=${L}: invariants + simulated==par + win`, r.ok && sim.moves === b.minMoves && sim.won)
}

console.log(`\n=== SELF-CHECKS: ${pass} passed, ${fail} failed ===`)
