// Verification harness for the CUT-POINT archetype (m=2 Step 11) —
// buildCutPoint / buildCutPointAt in archetypes.ts.
// Run: `npx tsx src/lib/cutpoint.verify.ts`.
//
// This is the archetype the m=2 migration existed for: the FIRST construction
// that genuinely requires duplicate tiles. Per MIGRATION_M2.md Step 10, it
// CANNOT inherit decoy/red-herring/composed's trap arguments (those are m=1
// facts about different constructions), so the trap proof here is built from
// scratch and is deliberately EXHAUSTIVE rather than a handful of cases.
//
// Everything below is re-derived INDEPENDENTLY of the builder:
//   - its own brute-force run-partitioner (not the builder's countRunPartitions)
//   - its own enumeration of every candidate run a player could commit to
//   - its own par-over-ALL-layouts search (not the builder's DP choice)
//   - its own transcription of the real DROP reducer
//
// Proves, with real executed output per CLAUDE.md's anti-illusion rule:
//   (a) validateGrid(board) true, zero invalid cells at move zero
//   (b) solveBagM2(all tiles).solvable
//   (c) formsValidSetAlone(rack) === false
//   (d) existsNoRelocationWin: win=false AND not exhausted
//   (e) the goal materialises to a real validateGrid win
//   UNIQUE:  the bag admits EXACTLY ONE run-partition (independently counted)
//   TRAP:    every candidate run that is NOT one of the true parts strands the
//            remainder (solveBagM2 === false), and every true part survives
//   NODUP:   duplicates really are present and really are needed
//   PAIRING: Step 6b's copy-pairing minimisation does real work here
//   PAR:     builder par == min over EVERY layout, and == a simulated real win

import type { Tile, Grid } from '../types'
import { makeTile, TILE_COPIES } from '../types'
import { validateGrid, getInvalidCells, isValidRun, isValidGroup } from './validator'
// solveBag (m=1) is imported deliberately as an INDEPENDENT oracle: it rejects
// any duplicate outright, so it is what proves this archetype requires m=2.
import { solveBag, solveBagM2 } from './solver'
import {
  buildCutPoint, buildCutPointAt, type CutPointBuild,
  formsValidSetAlone, existsNoRelocationWin, obviousSpots,
} from './archetypes'
import { mixedLayoutMoves, bindMinCostGoal, MAX_ENUMERATED_DUPLICATES, type WindowSpec } from './mixedGoalPlanner'
import { generatePuzzle } from './generator'

let pass = 0, fail = 0
const check = (label: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`  FAIL  ${label}`) } }

// --- independent brute-force partitioner (single colour => runs only) --------
function allRunPartitions(values: number[]): number[][][] {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const out: number[][][] = []
  const recurse = (acc: number[][]) => {
    let lo = Infinity
    for (const [v, n] of counts) if (n > 0 && v < lo) lo = v
    if (lo === Infinity) { out.push(acc.map(r => [...r])); return }
    for (let len = 3; ; len++) {
      const run: number[] = []
      let ok = true
      for (let i = 0; i < len; i++) {
        const v = lo + i
        if ((counts.get(v) ?? 0) <= 0) { ok = false; break }
        run.push(v)
      }
      if (!ok) break
      for (const v of run) counts.set(v, counts.get(v)! - 1)
      recurse([...acc, run])
      for (const v of run) counts.set(v, counts.get(v)! + 1)
    }
  }
  recurse([])
  return out
}

/** every run (>=3 consecutive values) that is a sub-multiset of these values */
function candidateRuns(values: number[]): number[][] {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const out: number[][] = []
  const lo = Math.min(...values), hi = Math.max(...values)
  for (let a = lo; a <= hi; a++)
    for (let b = a + 2; b <= hi; b++) {
      let ok = true
      for (let v = a; v <= b; v++) if ((counts.get(v) ?? 0) < 1) { ok = false; break }
      if (ok) out.push(Array.from({ length: b - a + 1 }, (_, k) => a + k))
    }
  return out
}

// --- faithful DROP reducer transcription (same as the other harnesses) -------
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
function simulateGoal(startGrid: Grid, startRack: Tile[], goal: Map<string, [number, number]>) {
  const grid = startGrid.map(r => [...r])
  const rack = [...startRack]
  const goalOf = (t: Tile) => goal.get(t.id)!
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
    if (guard === budget) return { moves, won: false }
    const drain = bad.find(([r, c]) => { const [gr, gc] = goalOf(grid[r][c]!); return grid[gr][gc] === null })
    const [r, c] = drain ?? bad[0]
    const [tr, tc] = goalOf(grid[r][c]!)
    applyDrop(grid, rack, { from: 'grid', r, c, tr, tc })
    moves++
  }
  while (rack.length > 0) {
    const [tr, tc] = goalOf(rack[0])
    if (grid[tr][tc] !== null) return { moves, won: false }
    applyDrop(grid, rack, { from: 'rack', idx: 0, tr, tc })
    moves++
  }
  return { moves, won: rack.length === 0 && validateGrid(grid) }
}

/** Independent par: min over EVERY layout (any set of pieces keeping board
 *  cells), not just the builder's max-weight-independent-set DP choice. */
function parOverAllLayouts(b: CutPointBuild): number {
  const nb = b.blocks.length
  let best = Infinity
  const perBlockMasks = b.blocks.map((_, bi) => {
    const np = b.pieces[bi].length
    const masks: number[] = []
    for (let m = 0; m < (1 << np); m++) if (!(m & (m >> 1))) masks.push(m)
    return masks
  })
  const combos: number[][] = []
  const rec = (bi: number, acc: number[]) => {
    if (bi === nb) { combos.push([...acc]); return }
    for (const m of perBlockMasks[bi]) rec(bi + 1, [...acc, m])
  }
  rec(0, [])
  for (const combo of combos) {
    // rebuild the grid + windows for this layout choice
    const rebuilt = b.blocks.reduce((n, _, bi) => n + b.pieces[bi].length - combo[bi].toString(2).split('1').length + 1, 0)
    const rows = 1 + nb + rebuilt + 1
    const cols = b.blocks[0].L + 2
    const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
    b.blocks.forEach((blk, bi) => { for (let o = 0; o < blk.L; o++) grid[1 + bi][1 + o] = makeTile(blk.s + o, blk.color, 0) })
    const rack: Tile[] = []
    for (const blk of b.blocks) for (const c of blk.cuts) rack.push(makeTile(c, blk.color, 1))
    const windows: WindowSpec[] = []
    const cells: [number, number][][] = []
    let fresh = 1 + nb
    let okLayout = true
    b.blocks.forEach((blk, bi) => {
      b.pieces[bi].forEach(([a, z], pi) => {
        windows.push({ type: 'run', color: blk.color, start: a, length: z - a + 1 })
        if (combo[bi] & (1 << pi)) cells.push(Array.from({ length: z - a + 1 }, (_, i): [number, number] => [1 + bi, 1 + (a - blk.s) + i]))
        else {
          if (fresh >= rows) { okLayout = false; return }
          const r = fresh++
          cells.push(Array.from({ length: z - a + 1 }, (_, i): [number, number] => [r, 1 + i]))
        }
      })
    })
    if (!okLayout) continue
    const res = bindMinCostGoal(windows, grid, rack, (wi, i) => cells[wi][i])
    if (res && res.reachedGoal && res.validGoal && res.moves < best) best = res.moves
  }
  return best
}

console.log('=== CUT-POINT archetype verification (m=2 Step 11) ===\n')

// ---------------------------------------------------------------------------
// 0. Tier gating
// ---------------------------------------------------------------------------
console.log('0. Cut-point puzzles ship at MEDIUM only')
check('buildCutPoint(easy) === null', buildCutPoint('easy') === null)
check('buildCutPoint(hard) === null', buildCutPoint('hard') === null)
check('buildCutPoint(extreme) === null', buildCutPoint('extreme') === null)
check('buildCutPoint(medium) builds', buildCutPoint('medium') !== null)
console.log(`   easy=${buildCutPoint('easy')} hard=${buildCutPoint('hard')} extreme=${buildCutPoint('extreme')}`)
console.log(`   blockCount>2 REFUSED (would enable groups): ${buildCutPointAt(10, 3)}\n`)

// ---------------------------------------------------------------------------
// 1. Full invariant suite over real builds
// ---------------------------------------------------------------------------
const N = 25
console.log(`1. Invariants over ${N} medium puzzles (a,b,c,d,e + UNIQUE, TRAP, NODUP, PAIRING)`)
{
  const t = { a: 0, b: 0, c: 0, d: 0, e: 0, uniq: 0, trap: 0, nodup: 0, all: 0 }
  const pars = new Set<number>()
  const dims = new Set<string>()
  let built = 0, example = ''
  let trapWrongTotal = 0, trapWrongFatal = 0, trapTrueSurvived = 0, trapTrueTotal = 0
  for (let i = 0; i < N; i++) {
    const b = buildCutPoint('medium')
    if (!b) continue
    built++
    const a = validateGrid(b.grid) && getInvalidCells(b.grid).size === 0
    const bInv = solveBagM2(b.allTiles).solvable === true
    const c = formsValidSetAlone(b.rack) === false
    const ds = existsNoRelocationWin(b.grid, b.rack)
    const d = ds.win === false && ds.exhausted === false
    const home = mixedLayoutMoves(b.grid, b.rack, b.goal)
    const e = !!home && home.reachedGoal && home.validGoal

    // UNIQUE — independently counted, per colour, then multiplied
    let solutions = 1
    for (const blk of b.blocks) {
      const vals = [...Array.from({ length: blk.L }, (_, k) => blk.s + k), ...blk.cuts]
      solutions *= allRunPartitions(vals).length
    }
    const uniq = solutions === 1

    // TRAP — exhaustive over every candidate run, per colour
    let trapOk = true
    for (const blk of b.blocks) {
      const vals = [...Array.from({ length: blk.L }, (_, k) => blk.s + k), ...blk.cuts]
      const truth = allRunPartitions(vals)[0].map(r => r.join(','))
      const colourTiles = b.allTiles.filter(x => x.c === blk.color)
      for (const run of candidateRuns(vals)) {
        const rest = [...colourTiles]
        for (const v of run) {
          const idx = rest.findIndex(x => x.n === v)
          if (idx >= 0) rest.splice(idx, 1)
        }
        // the OTHER colour is untouched and independently solvable, so the
        // whole-bag verdict is decided by this colour alone
        const solvable = solveBagM2(rest).solvable
        if (truth.includes(run.join(','))) {
          trapTrueTotal++
          if (solvable) trapTrueSurvived++; else trapOk = false
        } else {
          trapWrongTotal++
          if (!solvable) trapWrongFatal++; else trapOk = false
        }
      }
    }

    // NODUP — this puzzle genuinely REQUIRES m=2. The strongest possible form
    // of that claim: the m=1 solver rejects this bag outright (it refuses any
    // duplicate), while solveBagM2 solves it. So this archetype could not have
    // existed before the migration — which is the whole point of Step 11.
    const labels = new Map<string, number>()
    for (const x of b.allTiles) labels.set(`${x.n}_${x.c}`, (labels.get(`${x.n}_${x.c}`) ?? 0) + 1)
    const dupLabels = [...labels.values()].filter(v => v > 1).length
    const withinCap = [...labels.values()].every(v => v <= TILE_COPIES)
    const ids = new Set(b.allTiles.map(x => x.id))
    const nodup = dupLabels === b.blocks.length * b.blocks[0].cuts.length
      && withinCap && ids.size === b.allTiles.length
      && solveBag(b.allTiles).solvable === false
      && solveBagM2(b.allTiles).solvable === true

    // (pairing is measured explicitly in section 2, not asserted here)
    if (a) t.a++; if (bInv) t.b++; if (c) t.c++; if (d) t.d++; if (e) t.e++
    if (uniq) t.uniq++; if (trapOk) t.trap++; if (nodup) t.nodup++
    if (a && bInv && c && d && e && uniq && trapOk && nodup) t.all++
    pars.add(b.minMoves)
    dims.add(`${b.grid.length}x${b.grid[0].length}`)
    if (!example) example = `blocks=${b.blocks.map(x => `${x.color}[${x.s}..${x.s + x.L - 1}]cuts(${x.cuts.join(',')})`).join(' ')} par=${b.minMoves}`
  }
  console.log(`  built ${built}/${N}  |  a=${t.a} b=${t.b} c=${t.c} d=${t.d} e=${t.e} UNIQUE=${t.uniq} TRAP=${t.trap} NODUP=${t.nodup}  ALL=${t.all}`)
  console.log(`  pars={${[...pars].join(',')}}  grids={${[...dims].join(',')}}`)
  console.log(`  e.g. ${example}`)
  console.log(`  TRAP detail: wrong commitments tested=${trapWrongTotal}, ALL fatal=${trapWrongFatal === trapWrongTotal} | true parts tested=${trapTrueTotal}, ALL survive=${trapTrueSurvived === trapTrueTotal}`)
  check('all builds succeeded', built === N)
  check('(a) board valid, zero invalid cells', t.a === built)
  check('(b) solvable under solveBagM2', t.b === built)
  check('(c) rack forms no valid set alone', t.c === built)
  check('(d) no no-relocation win', t.d === built)
  check('(e) goal materialises to a validateGrid win', t.e === built)
  check('UNIQUE: exactly one run-partition (independently counted)', t.uniq === built)
  check('TRAP: every wrong cut strands, every true part survives', t.trap === built)
  check('TRAP: zero wrong commitments were survivable', trapWrongFatal === trapWrongTotal && trapWrongTotal > 0)
  check('TRAP: zero true parts were fatal', trapTrueSurvived === trapTrueTotal && trapTrueTotal > 0)
  check('NODUP: m=1 solveBag REJECTS this bag while solveBagM2 solves it (requires m=2)', t.nodup === built)
  check('par is deterministic', pars.size === 1)
  check('par === 12', [...pars][0] === 12)
}

// ---------------------------------------------------------------------------
// 2. The duplicate-specific machinery: Step 6b pairing minimisation
// ---------------------------------------------------------------------------
console.log('\n2. Step 6b copy-pairing minimisation — first SHIPPED archetype to exercise it')
{
  let enumeratedOk = 0, spreadPositive = 0, n = 0
  let sample = ''
  for (let i = 0; i < 12; i++) {
    const b = buildCutPointAt(10, 2)
    if (!b) continue
    n++
    // rebuild the same call the builder makes, to read its pairing diagnostics
    const nb = b.blocks.length
    const rebuilt = b.blocks.reduce((acc, _, bi) => acc + b.pieces[bi].length - 2, 0)
    const rows = 1 + nb + rebuilt + 1, cols = b.blocks[0].L + 2
    const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
    b.blocks.forEach((blk, bi) => { for (let o = 0; o < blk.L; o++) grid[1 + bi][1 + o] = makeTile(blk.s + o, blk.color, 0) })
    const rack: Tile[] = []
    for (const blk of b.blocks) for (const c of blk.cuts) rack.push(makeTile(c, blk.color, 1))
    const windows: WindowSpec[] = []
    const cells: [number, number][][] = []
    let fresh = 1 + nb
    b.blocks.forEach((blk, bi) => {
      const lens = b.pieces[bi].map(([a, z]) => z - a + 1)
      const dp = new Array<number>(lens.length + 2).fill(0)
      for (let k = lens.length - 1; k >= 0; k--) dp[k] = Math.max(dp[k + 1], lens[k] + dp[k + 2])
      const keep: number[] = []
      for (let k = 0; k < lens.length;) { if (lens[k] + dp[k + 2] >= dp[k + 1]) { keep.push(k); k += 2 } else k++ }
      b.pieces[bi].forEach(([a, z], pi) => {
        windows.push({ type: 'run', color: blk.color, start: a, length: z - a + 1 })
        if (keep.includes(pi)) cells.push(Array.from({ length: z - a + 1 }, (_, k): [number, number] => [1 + bi, 1 + (a - blk.s) + k]))
        else { const r = fresh++; cells.push(Array.from({ length: z - a + 1 }, (_, k): [number, number] => [r, 1 + k])) }
      })
    })
    const res = bindMinCostGoal(windows, grid, rack, (wi, k) => cells[wi][k])
    if (!res) continue
    if (res.enumerated.length === 6) enumeratedOk++
    if (res.spread > 0) spreadPositive++
    if (!sample) sample = `candidates=${res.candidates} enumerated=[${res.enumerated.join(', ')}] skippedRackOnly=[${res.skippedRackOnly.join(', ')}] spread=${res.spread} par=${res.moves} fixed=${res.fixed} cycles=${res.cycles}`
  }
  console.log(`   ${sample}`)
  console.log(`   builds=${n}  all-6-labels-enumerated=${enumeratedOk}  pairing-mattered(spread>0)=${spreadPositive}`)
  check('all 6 duplicate labels are board-touching and enumerated', enumeratedOk === n && n > 0)
  check('the copy-pairing genuinely matters (spread > 0) on every build', spreadPositive === n)
  // Not a decorative check: this construction sits EXACTLY on the Step 6 guard,
  // so if MAX_ENUMERATED_DUPLICATES is ever lowered, buildCutPoint starts
  // throwing PairingBlowupError instead of building. Pin it explicitly.
  check('6 duplicate labels is exactly at the Step 6 guard (MAX_ENUMERATED_DUPLICATES=6)',
    MAX_ENUMERATED_DUPLICATES === 6)
}

// ---------------------------------------------------------------------------
// 3. par is honest: builder par == min over EVERY layout == a real simulated win
// ---------------------------------------------------------------------------
console.log('\n3. par honesty: builder par vs min over ALL layouts, and a real move simulation')
{
  let exhaustiveMatch = 0, simExact = 0, simWon = 0, n = 0
  for (let i = 0; i < 6; i++) {
    const b = buildCutPoint('medium')
    if (!b) continue
    n++
    const exhaustive = parOverAllLayouts(b)
    const sim = simulateGoal(b.grid, b.rack, b.goal)
    if (exhaustive === b.minMoves) exhaustiveMatch++
    if (sim.moves === b.minMoves) simExact++
    if (sim.won) simWon++
    console.log(`  #${n}  par=${b.minMoves}  minOverAllLayouts=${exhaustive}  simulated=${sim.moves}  ${sim.won ? 'validateGrid win' : 'NO WIN'}`)
  }
  check('builder par equals the minimum over every layout', exhaustiveMatch === n && n > 0)
  check('simulated move count equals par', simExact === n)
  check('simulation ends in a real validateGrid win', simWon === n)
}

// ---------------------------------------------------------------------------
// 4. The distinguishing property: the board LOOKS finished
// ---------------------------------------------------------------------------
console.log('\n4. The board already validates and no rack tile has a tempting placement')
{
  let noObvious = 0, boardValid = 0, n = 0
  for (let i = 0; i < 10; i++) {
    const b = buildCutPoint('medium')
    if (!b) continue
    n++
    if (validateGrid(b.grid)) boardValid++
    if (b.rack.every(t => obviousSpots(b.grid, t).length === 0)) noObvious++
  }
  console.log(`   builds=${n}  starting board already valid=${boardValid}  rack tiles with ZERO obvious spots=${noObvious}`)
  check('the starting board is a complete, already-valid set of runs', boardValid === n && n > 0)
  check('no rack tile has any obvious board placement (a duplicate cannot extend its own run)', noObvious === n)
}

// ---------------------------------------------------------------------------
// 5. Design decision evidence: SPREAD ships, ADJACENT does not
// ---------------------------------------------------------------------------
console.log('\n5. Why only the SPREAD shape ships (the migration doc\'s open design question)')
for (const L of [8, 10, 11, 12, 13]) {
  const base = Array.from({ length: L }, (_, i) => i + 1)
  let sT = 0, sU = 0, aT = 0, aU = 0
  for (let d1 = 1; d1 <= L; d1++)
    for (let d2 = d1 + 1; d2 <= L; d2++) {
      const p = allRunPartitions([...base, d1, d2])
      if (!p.length) continue
      if (d2 === d1 + 1) { aT++; if (p.length === 1) aU++ } else { sT++; if (p.length === 1) sU++ }
    }
  console.log(`   L=${String(L).padStart(2)}:  SPREAD solvable=${String(sT).padStart(2)} unique=${String(sU).padStart(2)}   ADJACENT solvable=${String(aT).padStart(2)} unique=${aU}`)
}
check('adjacent duplicates are never uniquely solvable at L>=10 (so they do not ship)',
  [10, 11, 12, 13].every(L => {
    const base = Array.from({ length: L }, (_, i) => i + 1)
    for (let d = 1; d < L; d++) {
      const p = allRunPartitions([...base, d, d + 1])
      if (p.length === 1) return false
    }
    return true
  }))
// the doc's own worked example must reproduce
{
  const base8 = Array.from({ length: 8 }, (_, i) => i + 1)
  const p36 = allRunPartitions([...base8, 3, 6])
  console.log(`   doc's example red 1..8 + dup 3 and 6: solutions=${p36.length} -> ${p36[0].map(r => `[${r[0]}..${r[r.length - 1]}]`).join('')}`)
  check("the doc's (3,6) example is a uniquely-solvable THREE-run split", p36.length === 1 && p36[0].length === 3)
  const solvablePairs: string[] = []
  for (let d1 = 1; d1 <= 8; d1++)
    for (let d2 = d1 + 1; d2 <= 8; d2++)
      if (solveBagM2([...base8.map(v => makeTile(v, 'r', 0)), makeTile(d1, 'r', 1), makeTile(d2, 'r', 1)]).solvable)
        solvablePairs.push(`(${d1},${d2})`)
  console.log(`   solveBagM2 over all 28 pairs: ${solvablePairs.join(' ')}`)
  check('solveBagM2 reproduces the documented 8 solvable pairs exactly',
    solvablePairs.join(' ') === '(1,2) (1,3)'.slice(0, 0) + '(2,3) (3,4) (3,5) (3,6) (4,5) (4,6) (5,6) (6,7)')
}

// ---------------------------------------------------------------------------
// 6. Sanity: 2 colours can never form a group (what keeps the bag runs-only)
// ---------------------------------------------------------------------------
console.log('\n6. Two colours can never form a group — the fact uniqueness rests on')
check('isValidGroup rejects a 2-tile same-value pair', !isValidGroup([makeTile(5, 'r'), makeTile(5, 'b')]))
check('isValidGroup rejects two copies + one other colour', !isValidGroup([makeTile(5, 'r', 0), makeTile(5, 'r', 1), makeTile(5, 'b')]))
check('isValidRun rejects a duplicated value', !isValidRun([makeTile(3, 'r', 0), makeTile(3, 'r', 1), makeTile(4, 'r')]))

// ---------------------------------------------------------------------------
// 7. Construction timing
// ---------------------------------------------------------------------------
console.log('\n7. Construction wall-clock')
{
  const runs = 12
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    buildCutPoint('medium')
    times.push(performance.now() - t0)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  console.log(`   medium: builds=${runs}  avg=${avg.toFixed(2)}ms  min=${Math.min(...times).toFixed(2)}ms  max=${Math.max(...times).toFixed(2)}ms`)
  check('construction stays well under budget (<50ms)', avg < 50)
}

// ---------------------------------------------------------------------------
// 8. generatePuzzle integration
// ---------------------------------------------------------------------------
console.log('\n8. generatePuzzle integration (own band, hidden tag, other tiers untouched)')
{
  const M = 200
  let cut = 0, valid = 0
  const others = new Map<string, number>()
  for (let i = 0; i < M; i++) {
    const p = generatePuzzle('medium')
    if (!p) continue
    if (p.archetypeId === 'cut-point') {
      cut++
      if (validateGrid(p.grid) && solveBagM2([...p.grid.flat().filter((t): t is Tile => t !== null), ...p.rack]).solvable && p.optimalMoves > 0) valid++
    } else others.set(p.archetypeId ?? '?', (others.get(p.archetypeId ?? '?') ?? 0) + 1)
  }
  console.log(`   medium: cut-point=${cut}/${M} (${Math.round(cut / M * 100)}%), valid=${valid}/${cut}; others=${[...others].map(([k, v]) => `${k}:${v}`).join(' ')}`)
  check('cut-point puzzles are emitted at medium', cut > 0)
  check('every emitted cut-point puzzle is valid+solvable', valid === cut)
  check('the base archetypes still appear at medium', others.size >= 2)
  // and never at the other tiers
  let leaked = 0
  for (const d of ['easy', 'hard', 'extreme'] as const)
    for (let i = 0; i < 60; i++) if (generatePuzzle(d)?.archetypeId === 'cut-point') leaked++
  console.log(`   cut-point puzzles leaked into easy/hard/extreme: ${leaked}`)
  check('cut-point never appears outside medium', leaked === 0)
}

console.log(`\n=== SELF-CHECKS: ${pass} passed, ${fail} failed ===`)
