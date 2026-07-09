import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'
import { validateGrid } from './validator'
import {
  buildGroupsToRuns,
  formsValidSetAlone,
  existsNoRelocationWin,
  obviousPlacementWins,
  isTrivial,
} from './archetypes'
import { generatePuzzle } from './generator'

let pass = 0
let fail = 0

function check(label: string, condition: boolean) {
  if (condition) { pass++; console.log(`  PASS  ${label}`) }
  else { fail++; console.log(`  FAIL  ${label}`) }
}

const showGrid = (g: Grid) =>
  g.map(r => r.map(t => (t ? `${String(t.n).padStart(2)}${t.c}` : ' . ')).join(' ')).join('\n')
const showTiles = (ts: Tile[]) => ts.map(t => `${t.n}${t.c}`).join(' ')

console.log('=== SOLVER SELF-TESTS ===')
check('empty bag is unsolvable', solveBag([]).solvable === false)
check('run of 3 same-color consecutive is solvable',
  solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}]).solvable === true)
check('run of 2 is unsolvable', solveBag([{n:3,c:'r'},{n:4,c:'r'}]).solvable === false)
check('group of 3 same-value diff-color is solvable',
  solveBag([{n:5,c:'r'},{n:5,c:'b'},{n:5,c:'k'}]).solvable === true)
check('2 same-value tiles alone is unsolvable',
  solveBag([{n:5,c:'r'},{n:5,c:'b'}]).solvable === false)

const dualBlock: Tile[] = []
for (const c of ['r','b','a'] as const) for (let v = 5; v <= 8; v++) dualBlock.push({ n: v, c })
check('3x4 dual block (runs or groups) is solvable', solveBag(dualBlock).solvable === true)
check('single unmatched tile is unsolvable', solveBag([{n:9,c:'k'}]).solvable === false)
const solvedResult = solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}])
check('assignment field is populated when solvable',
  solvedResult.assignment !== undefined && solvedResult.assignment.size === 3)

// ---------------------------------------------------------------------------
// Regression: the exact production board that shipped as a one-drop win.
// Board = 3x3 block of k/b/r over 7..9; rack = 8a. Dropping 8a under the 8
// column completes a group of four and wins. The gate MUST call this trivial.
// ---------------------------------------------------------------------------
console.log('')
console.log('=== REGRESSION: known fill-in-the-blank boards must be rejected ===')

const fitbGrid: Grid = Array.from({ length: 5 }, () => Array(10).fill(null))
;(['k','b','r'] as const).forEach((c, r) => { for (let i = 0; i < 3; i++) fitbGrid[r][i] = { n: 7 + i, c } })
const fitbRack: Tile[] = [{ n: 8, c: 'a' }]
check('board is valid before the rack is placed', validateGrid(fitbGrid) === true)
check('vertical group-completion win is detected (existsNoRelocationWin)',
  existsNoRelocationWin(fitbGrid, fitbRack).win === true)
check('vertical group-completion win is detected (isTrivial)',
  isTrivial(fitbGrid, fitbRack) === true)

// Failure mode 2: rack is a complete run on its own.
const freeGrid: Grid = Array.from({ length: 5 }, () => Array(10).fill(null))
;(['k','b','r'] as const).forEach((c, r) => { for (let i = 0; i < 3; i++) freeGrid[r][i] = { n: 7 + i, c } })
const freeRack: Tile[] = [{n:4,c:'a'},{n:5,c:'a'},{n:6,c:'a'},{n:7,c:'a'},{n:8,c:'a'}]
check('free-standing rack run is detected (formsValidSetAlone)',
  formsValidSetAlone(freeRack) === true)
check('free-standing rack run is detected (isTrivial)', isTrivial(freeGrid, freeRack) === true)

// ---------------------------------------------------------------------------
// The (d) search is pruned. An unsound prune would hide real wins and bless
// trivial puzzles, so it is cross-checked two ways: against wins planted deeper
// than one move, and against an unpruned brute force over every empty cell.
// ---------------------------------------------------------------------------
console.log('')
console.log('=== (d) SEARCH SOUNDNESS ===')

// This file is a standalone script run via `npx tsx` under Node, but it lives
// under src/ and is typechecked against tsconfig.app.json (browser lib, no
// Node types) — so `process` needs a local declaration rather than @types/node.
declare const process: { env: Record<string, string | undefined> }

/** DEEP=1 also brute-forces rack-of-4 puzzles (~20-45s each). */
const DEEP = process.env.DEEP === '1'
console.log(`  deep unpruned cross-check on rack-of-4 puzzles: ${DEEP ? 'ON' : 'off (set DEEP=1)'}`)

function bruteNoRelocationWin(board: Grid, rack: Tile[]): boolean {
  const grid = board.map(r => [...r])
  const empties: [number, number][] = []
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++)
      if (!grid[r][c]) empties.push([r, c])
  const rec = (i: number): boolean => {
    if (i === rack.length) return validateGrid(grid)
    for (const [r, c] of empties) {
      if (grid[r][c]) continue
      grid[r][c] = rack[i]
      if (rec(i + 1)) return true
      grid[r][c] = null
    }
    return false
  }
  return rec(0)
}

// depth-2 win: a run of 3 on the board, rack extends it by two tiles at the end.
const deep1: Grid = Array.from({ length: 5 }, () => Array(9).fill(null))
;[5, 6, 7].forEach((n, i) => { deep1[1][1 + i] = { n, c: 'r' } })
;(['b','a','k'] as const).forEach((c, i) => { deep1[3][1 + i] = { n: 4, c } })
check('depth-2 run extension is found (planted win)',
  existsNoRelocationWin(deep1, [{n:8,c:'r'},{n:9,c:'r'}]).win === true)

// depth-2 win requiring a GAP to be filled, not just an endpoint extended.
const deep2: Grid = Array.from({ length: 5 }, () => Array(9).fill(null))
deep2[1][1] = { n: 5, c: 'r' }
deep2[1][3] = { n: 7, c: 'r' }
;(['b','a','k'] as const).forEach((c, i) => { deep2[3][1 + i] = { n: 4, c } })
check('depth-2 gap fill + endpoint extension is found (planted win)',
  existsNoRelocationWin(deep2, [{n:6,c:'r'},{n:8,c:'r'}]).win === true)

// a board where genuinely no no-relocation win exists must not be reported as one
const deep3: Grid = Array.from({ length: 5 }, () => Array(9).fill(null))
;(['b','a','k'] as const).forEach((c, i) => { deep3[1][1 + i] = { n: 4, c } })
check('no false positive on a board with no possible win',
  existsNoRelocationWin(deep3, [{n:11,c:'r'},{n:13,c:'b'}]).win === false)
check('  ...and brute force agrees', bruteNoRelocationWin(deep3, [{n:11,c:'r'},{n:13,c:'b'}]) === false)
check('planted wins agree with brute force (deep1)',
  bruteNoRelocationWin(deep1, [{n:8,c:'r'},{n:9,c:'r'}]) === true)
check('planted wins agree with brute force (deep2)',
  bruteNoRelocationWin(deep2, [{n:6,c:'r'},{n:8,c:'r'}]) === true)

// ---------------------------------------------------------------------------
// Invariants (a)-(d) against real generated puzzles.
// ---------------------------------------------------------------------------
console.log('')
console.log('=== INVARIANTS (a)-(d) ON REAL GENERATED PUZZLES ===')
console.log('  a: validateGrid(startBoard)          b: solveBag(board+rack).solvable')
console.log('  c: rack forms no valid set alone     d: no no-relocation win exists')
console.log('')

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']
const WANTED = 25
const MAX_ATTEMPTS = 400
let anyInvariantFailed = false
const samples: Partial<Record<Difficulty, { grid: Grid; rack: Tile[]; minMoves: number }>> = {}

/**
 * (e) The puzzle must actually be winnable ON THE GRID, not merely partitionable
 * as a bag. Rebuild every tile as one run per colour, one colour per row, and
 * demand that validateGrid accepts it and that it uses exactly the same tiles.
 */
function goalLayoutIsReachable(grid: Grid, allTiles: Tile[]): boolean {
  const byColor = new Map<Tile['c'], number[]>()
  for (const t of allTiles) byColor.set(t.c, [...(byColor.get(t.c) ?? []), t.n])
  const minVal = Math.min(...allTiles.map(t => t.n))

  const goal: Grid = Array.from({ length: grid.length }, () => Array(grid[0].length).fill(null))
  let r = 0
  for (const [c, valsRaw] of byColor) {
    const vals = [...valsRaw].sort((a, b) => a - b)
    if (vals.length < 3) return false
    for (let i = 1; i < vals.length; i++) if (vals[i] !== vals[i - 1] + 1) return false // not one run
    if (r >= goal.length) return false
    for (const v of vals) {
      const col = v - minVal
      if (col >= goal[0].length) return false
      goal[r][col] = { n: v, c }
    }
    r++
  }
  if (!validateGrid(goal)) return false
  const key = (ts: Tile[]) => ts.map(t => `${t.n}${t.c}`).sort().join(',')
  return key(goal.flat().filter((t): t is Tile => t !== null)) === key(allTiles)
}

for (const diff of difficulties) {
  let built = 0, attempts = 0, nulls = 0
  let failA = 0, failB = 0, failC = 0, failD = 0, failDobvious = 0, failCollision = 0, exhausted = 0
  let failE = 0, bruteChecked = 0, bruteDisagree = 0
  const rackSizes: number[] = []
  const moveCounts: number[] = []
  const t0 = Date.now()

  while (built < WANTED && attempts < MAX_ATTEMPTS) {
    attempts++
    const result = buildGroupsToRuns(diff)
    if (!result) { nulls++; continue }
    built++
    const { grid, rack, allTiles, minMoves } = result
    if (!samples[diff]) samples[diff] = { grid, rack, minMoves }

    if (!validateGrid(grid)) { failA++; anyInvariantFailed = true }
    if (!solveBag(allTiles).solvable) { failB++; anyInvariantFailed = true }
    if (formsValidSetAlone(rack)) { failC++; anyInvariantFailed = true }

    const search = existsNoRelocationWin(grid, rack)
    if (search.win) { failD++; anyInvariantFailed = true }
    if (search.exhausted) { exhausted++; anyInvariantFailed = true }
    if (obviousPlacementWins(grid, rack)) { failDobvious++; anyInvariantFailed = true }

    const keys = allTiles.map(t => `${t.n}_${t.c}`)
    if (new Set(keys).size !== keys.length) { failCollision++; anyInvariantFailed = true }

    if (!goalLayoutIsReachable(grid, allTiles)) { failE++; anyInvariantFailed = true }

    // Unpruned cross-check. Cheap for rack <= 3 (~ms); for rack 4 the unpruned
    // search costs 20-45s per puzzle, so it runs only under DEEP=1.
    const affordable = rack.length <= 3 ? bruteChecked < 10 : DEEP && bruteChecked < 2
    if (affordable) {
      bruteChecked++
      if (bruteNoRelocationWin(grid, rack) !== search.win) { bruteDisagree++; anyInvariantFailed = true }
    }

    rackSizes.push(rack.length)
    moveCounts.push(minMoves)
  }

  const avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : 'n/a'
  const ms = Date.now() - t0

  console.log(`${diff}:  (${built} puzzles built from ${attempts} attempts, ${nulls} rejected by builder, ${ms}ms)`)
  console.log(`  ${built - failA} / ${built}  pass (a) starting board valid`)
  console.log(`  ${built - failB} / ${built}  pass (b) board+rack solvable`)
  console.log(`  ${built - failC} / ${built}  pass (c) rack forms no valid set alone`)
  console.log(`  ${built - failD - exhausted} / ${built}  pass (d) no no-relocation win  (${failD} had a win, ${exhausted} unproven/budget)`)
  console.log(`  ${built - failDobvious} / ${built}  pass (d-literal) obvious placements do not win`)
  console.log(`  ${built - failE} / ${built}  pass (e) a valid goal layout exists on this grid`)
  console.log(`  ${built - failCollision} / ${built}  no duplicate tiles`)
  console.log(`  (d) vs unpruned brute force: ${bruteChecked} cross-checked, ${bruteDisagree} disagreements${bruteChecked === 0 ? '  (rack of 4 — run with DEEP=1)' : ''}`)
  console.log(`  rack size: min ${Math.min(...rackSizes)}  max ${Math.max(...rackSizes)}  avg ${avg(rackSizes)}`)
  console.log(`  reference solution length (minMoves): avg ${avg(moveCounts)}`)
  console.log('')
}

console.log('=== SAMPLE PUZZLES (one per difficulty) ===')
for (const diff of difficulties) {
  const s = samples[diff]
  if (!s) continue
  console.log(`\n--- ${diff} --- rack: ${showTiles(s.rack)}   minMoves: ${s.minMoves}`)
  console.log(showGrid(s.grid))
}

console.log('')
console.log('=== PLAYER-FACING generatePuzzle() — with internal retry ===')
for (const diff of difficulties) {
  let ok = 0
  const GENS = 10
  for (let i = 0; i < GENS; i++) {
    const puzzle = generatePuzzle(diff)
    if (!puzzle) continue
    const boardTiles = puzzle.grid.flat().filter((t): t is Tile => t !== null)
    const allTiles = [...boardTiles, ...puzzle.rack]
    if (validateGrid(puzzle.grid) && solveBag(allTiles).solvable && !isTrivial(puzzle.grid, puzzle.rack)) ok++
  }
  console.log(`${diff}: ${ok}/${GENS} generatePuzzle() calls produced a fully valid, non-trivial puzzle`)
}

console.log('')
console.log(`=== SELF-TESTS: ${pass} passed, ${fail} failed ===`)
console.log(`=== INVARIANTS (a)-(d): ${anyInvariantFailed ? 'AT LEAST ONE FAILED' : 'ALL PASSED on every generated puzzle'} ===`)
