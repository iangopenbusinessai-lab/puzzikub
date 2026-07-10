import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'
import { validateGrid, getInvalidCells } from './validator'
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
const showSet = (s: Set<string>) => s.size === 0 ? '{}' : `{ ${[...s].join('  ')} }`

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
// The rule change itself: only horizontal contiguous segments confer validity.
// ---------------------------------------------------------------------------
console.log('')
console.log('=== VALIDATOR RULE: HORIZONTAL-ONLY COVERAGE ===')

const hRun: Grid = Array.from({ length: 4 }, () => Array(4).fill(null))
;[4,5,6].forEach((n, i) => { hRun[1][i] = { n, c: 'r' } })
check('horizontal run of 3 is valid', validateGrid(hRun) === true)

const hGroup: Grid = Array.from({ length: 4 }, () => Array(4).fill(null))
;(['r','b','a'] as const).forEach((c, i) => { hGroup[1][i] = { n: 7, c } })
check('horizontal group of 3 is valid', validateGrid(hGroup) === true)

const vRun: Grid = Array.from({ length: 4 }, () => Array(4).fill(null))
;[4,5,6].forEach((n, i) => { vRun[i][1] = { n, c: 'r' } })
check('the SAME run arranged vertically is now INVALID', validateGrid(vRun) === false)

const vGroup: Grid = Array.from({ length: 4 }, () => Array(4).fill(null))
;(['r','b','a'] as const).forEach((c, i) => { vGroup[i][1] = { n: 7, c } })
check('the SAME group arranged vertically is now INVALID', validateGrid(vGroup) === false)

// ---------------------------------------------------------------------------
// Regression: fill-in-the-blank boards must be rejected. Both shapes are now
// stated horizontally, because that is the only orientation that can win.
// ---------------------------------------------------------------------------
console.log('')
console.log('=== REGRESSION: known fill-in-the-blank boards must be rejected ===')

// Horizontal run extension: row 2 is 7r 8r 9r; 10r appends and the grid is won.
const fitbRun: Grid = Array.from({ length: 5 }, () => Array(10).fill(null))
;(['k','b','r'] as const).forEach((c, r) => { for (let i = 0; i < 3; i++) fitbRun[r][i] = { n: 7 + i, c } })
check('board is valid before the rack is placed', validateGrid(fitbRun) === true)
check('horizontal run-extension win is detected (existsNoRelocationWin)',
  existsNoRelocationWin(fitbRun, [{ n: 10, c: 'r' }]).win === true)
check('horizontal run-extension win is detected (isTrivial)',
  isTrivial(fitbRun, [{ n: 10, c: 'r' }]) === true)

// Horizontal group completion: row 0 is 5r 5b 5a; 5k appends into a group of 4.
const fitbGroup: Grid = Array.from({ length: 5 }, () => Array(10).fill(null))
;(['r','b','a'] as const).forEach((c, i) => { fitbGroup[0][i] = { n: 5, c } })
;[7,8,9].forEach((n, i) => { fitbGroup[2][i] = { n, c: 'r' } })
;[2,3,4].forEach((n, i) => { fitbGroup[4][i] = { n, c: 'b' } })
check('group-completion board is valid before the rack is placed', validateGrid(fitbGroup) === true)
check('horizontal group-completion win is detected (existsNoRelocationWin)',
  existsNoRelocationWin(fitbGroup, [{ n: 5, c: 'k' }]).win === true)
check('horizontal group-completion win is detected (isTrivial)',
  isTrivial(fitbGroup, [{ n: 5, c: 'k' }]) === true)

// The old vertical trap: 8a beneath the 8-column used to complete a group of
// four eights. Under horizontal-only coverage it is just a lone tile in row 3.
check('the OLD vertical group-completion is no longer a win',
  existsNoRelocationWin(fitbRun, [{ n: 8, c: 'a' }]).win === false)

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

/** DEEP=1 also brute-forces rack-of-4 puzzles (minutes each). */
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
// Planted win on a REAL generated board. Unpruned brute force over a rack of 4
// on the real geometry (50-64 empty cells) is ~10^7 leaves, so it cannot serve
// as the cross-check there. Instead: hand the real board a rack that provably
// HAS a no-relocation win — four consecutive values in one colour, none of them
// on the board, which drop into the empty top row as a free-standing run — and
// demand the pruned search finds it. If the row-only prune ever discarded a
// reachable win at rack-of-4 depth, this is where it would show.
// ---------------------------------------------------------------------------
function plantedRunRack(grid: Grid): Tile[] | null {
  const used = new Set<number>()
  for (const t of grid.flat()) if (t) used.add(t.n)
  for (let v = 1; v + 3 <= 13; v++) {
    if ([v, v+1, v+2, v+3].every(x => !used.has(x)))
      return [v, v+1, v+2, v+3].map(n => ({ n, c: 'r' as const }))
  }
  return null
}

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
const samples: Partial<Record<Difficulty, { grid: Grid; rack: Tile[]; minMoves: number }[]>> = {}

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
  let plantChecked = 0, plantMissed = 0
  let coverChecked = 0, coverDirty = 0
  const rackSizes: number[] = []
  const moveCounts: number[] = []
  const t0 = Date.now()

  while (built < WANTED && attempts < MAX_ATTEMPTS) {
    attempts++
    const result = buildGroupsToRuns(diff)
    if (!result) { nulls++; continue }
    built++
    const { grid, rack, allTiles, minMoves } = result
    if (!samples[diff]) samples[diff] = []
    if (samples[diff]!.length < 3) samples[diff]!.push({ grid, rack, minMoves })

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

    // Starting board shows clean, fully-covered horizontal sets at move zero.
    coverChecked++
    if (getInvalidCells(grid).size !== 0) { coverDirty++; anyInvariantFailed = true }

    // Planted-win soundness on the real geometry, at full rack depth.
    if (plantChecked < 5) {
      const planted = plantedRunRack(grid)
      if (planted) {
        plantChecked++
        if (!existsNoRelocationWin(grid, planted).win) { plantMissed++; anyInvariantFailed = true }
      }
    }

    // Unpruned cross-check. Cheap for rack <= 3; for rack 4 the unpruned search
    // is ~10^7 leaves on this geometry, so it runs only under DEEP=1.
    const affordable = rack.length <= 3 ? bruteChecked < 10 : DEEP && bruteChecked < 1
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
  console.log(`  ${coverChecked - coverDirty} / ${coverChecked}  starting board has ZERO invalid cells`)
  console.log(`  planted-win cross-check (4-tile free-standing run on real boards): ${plantChecked} planted, ${plantMissed} missed by the pruned search`)
  console.log(`  (d) vs unpruned brute force: ${bruteChecked} cross-checked, ${bruteDisagree} disagreements${bruteChecked === 0 ? '  (rack of 4 — run with DEEP=1)' : ''}`)
  console.log(`  rack size: min ${Math.min(...rackSizes)}  max ${Math.max(...rackSizes)}  avg ${avg(rackSizes)}`)
  console.log(`  reference solution length (minMoves): avg ${avg(moveCounts)}`)
  console.log('')
}

// ---------------------------------------------------------------------------
// The board as the player first sees it: every tile must sit inside a valid
// horizontal set, so getInvalidCells must be literally empty. Printed, not
// summarised.
// ---------------------------------------------------------------------------
console.log('=== STARTING BOARDS AT MOVE ZERO (3 real puzzles per difficulty) ===')
for (const diff of difficulties) {
  for (const [i, s] of (samples[diff] ?? []).entries()) {
    const invalid = getInvalidCells(s.grid)
    console.log(`\n--- ${diff} #${i + 1} --- rack: ${showTiles(s.rack)}   minMoves: ${s.minMoves}`)
    console.log(showGrid(s.grid))
    console.log(`  validateGrid = ${validateGrid(s.grid)}`)
    console.log(`  getInvalidCells = ${showSet(invalid)}   size = ${invalid.size}`)
  }
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
