import type { Tile } from '../types'
import { solveBag } from './solver'
import { validateGrid } from './validator'
import { buildRunToGroup, isTrivial } from './archetypes'
import { generatePuzzle } from './generator'
import type { Difficulty } from '../types'

let pass = 0
let fail = 0

function check(label: string, condition: boolean) {
  if (condition) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}`)
  }
}

console.log('=== SOLVER SELF-TESTS ===')
check('empty bag is unsolvable',
  solveBag([]).solvable === false)
check('run of 3 same-color consecutive is solvable',
  solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}]).solvable === true)
check('run of 2 is unsolvable',
  solveBag([{n:3,c:'r'},{n:4,c:'r'}]).solvable === false)
check('group of 3 same-value diff-color is solvable',
  solveBag([{n:5,c:'r'},{n:5,c:'b'},{n:5,c:'k'}]).solvable === true)
check('2 same-value tiles alone is unsolvable',
  solveBag([{n:5,c:'r'},{n:5,c:'b'}]).solvable === false)

const dualBlock: Tile[] = []
for (const c of ['r','b','a'] as const)
  for (let v = 5; v <= 8; v++)
    dualBlock.push({ n: v, c })
check('3x4 dual block (runs or groups) is solvable',
  solveBag(dualBlock).solvable === true)

check('single unmatched tile is unsolvable',
  solveBag([{n:9,c:'k'}]).solvable === false)

const solvedResult = solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}])
check('assignment field is populated when solvable',
  solvedResult.assignment !== undefined && solvedResult.assignment.size === 3)

console.log('')
console.log('=== ARCHETYPE GENERATION — raw buildRunToGroup (no retry wrapper) ===')

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']
const ATTEMPTS_PER_DIFF = 30

for (const diff of difficulties) {
  let successCount = 0
  let nullCount = 0
  let failedValidateGrid = 0
  let failedSolveBag = 0
  let failedTrivial = 0
  let failedCollision = 0
  const rackSizes: number[] = []

  for (let i = 0; i < ATTEMPTS_PER_DIFF; i++) {
    const result = buildRunToGroup(diff)
    if (!result) { nullCount++; continue }

    const { grid, rack, allTiles } = result

    const boardValid = validateGrid(grid)
    if (!boardValid) failedValidateGrid++

    const solvable = solveBag(allTiles).solvable
    if (!solvable) failedSolveBag++

    const trivial = isTrivial(grid, rack)
    if (trivial) failedTrivial++

    const keys = allTiles.map(t => `${t.n}_${t.c}`)
    const hasCollision = new Set(keys).size !== keys.length
    if (hasCollision) failedCollision++

    if (boardValid && solvable && !trivial && !hasCollision) {
      successCount++
      rackSizes.push(rack.length)
    }
  }

  const avgRack = rackSizes.length
    ? (rackSizes.reduce((a,b)=>a+b,0) / rackSizes.length).toFixed(1)
    : 'n/a'

  console.log(`${diff}:`)
  console.log(`  ${successCount}/${ATTEMPTS_PER_DIFF} fully passed all gates`)
  console.log(`  ${nullCount} returned null (internal construction failure)`)
  console.log(`  ${failedValidateGrid} failed validateGrid (invalid starting board)`)
  console.log(`  ${failedSolveBag} failed solveBag (unsolvable combined bag)`)
  console.log(`  ${failedTrivial} failed isTrivial (puzzle was trivial)`)
  console.log(`  ${failedCollision} had tile collisions`)
  console.log(`  avg rack size on success: ${avgRack}`)
  console.log('')
}

console.log('=== PLAYER-FACING generatePuzzle() — with internal retry ===')

for (const diff of difficulties) {
  let successCount = 0
  const GENS_PER_DIFF = 10

  for (let i = 0; i < GENS_PER_DIFF; i++) {
    const puzzle = generatePuzzle(diff)
    if (!puzzle) continue

    const boardValid = validateGrid(puzzle.grid)
    const boardTiles = puzzle.grid.flat().filter((t): t is Tile => t !== null)
    const allTiles = [...boardTiles, ...puzzle.rack]
    const solvable = solveBag(allTiles).solvable
    const trivial = isTrivial(puzzle.grid, puzzle.rack)

    if (boardValid && solvable && !trivial) successCount++
  }

  console.log(`${diff}: ${successCount}/${GENS_PER_DIFF} generatePuzzle() calls produced a fully valid, non-trivial puzzle`)
}

console.log('')
console.log(`=== TOTAL: ${pass} passed, ${fail} failed (solver self-tests only) ===`)
