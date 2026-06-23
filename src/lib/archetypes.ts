import type { Tile, Grid, Difficulty } from '../types'
import { solveBag } from './solver'

export type ArchetypeType = 'run-to-group' | 'domino-chain' | 'false-extension'

const ALL_COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface ArchetypeResult {
  grid: Grid
  rack: Tile[]
  allTiles: Tile[]
}

// Type 1: N colors × L values tile universe.
// Board A = N full runs (one per row). Disrupt by removing K tiles into rack.
// Solution B = L groups of size N — same tiles, different structure.
// Rack tiles are mixed colors so the run-to-group transformation is non-obvious.
export function buildRunToGroup(diff: Difficulty): ArchetypeResult | null {
  const N = diff === 'hard' ? 3 : 4
  const L = diff === 'extreme' ? randomInt(4, 5) : randomInt(3, 4)
  const K = diff === 'extreme' ? randomInt(4, 6) : randomInt(2, 3)

  // Need enough removable slots: each run can lose at most L-2 tiles
  // Total removable = N × (L-2). Need K ≤ N×(L-2).
  if (K > N * (L - 2)) return null

  const start = randomInt(1, 14 - L)
  const colors = shuffle([...ALL_COLORS]).slice(0, N) as Tile['c'][]

  const allTiles: Tile[] = []
  for (const c of colors)
    for (let v = start; v < start + L; v++)
      allTiles.push({ n: v, c })

  if (!solveBag(allTiles).solvable) return null

  // Build full grid: N rows of runs
  const numCols = Math.max(10, L + 2)
  const numRows = N + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  for (let i = 0; i < N; i++)
    for (let col = 0; col < L; col++)
      grid[i][col] = { n: start + col, c: colors[i] }

  // Disruption: pick K positions to remove, each run retains ≥ 2 tiles
  const runRemaining = Array(N).fill(L)
  const positions = shuffle(
    Array.from({ length: N * L }, (_, idx) => ({ row: Math.floor(idx / L), col: idx % L }))
  )

  const removed: { row: number; col: number }[] = []
  for (const pos of positions) {
    if (removed.length >= K) break
    if (runRemaining[pos.row] > 2) {
      removed.push(pos)
      runRemaining[pos.row]--
    }
  }
  if (removed.length < K) return null

  // Apply disruptions
  const rack: Tile[] = []
  for (const { row, col } of removed) {
    rack.push(grid[row][col] as Tile)
    grid[row][col] = null
  }

  return { grid, rack: shuffle(rack), allTiles }
}

// TYPE 2 — domino-chain
// Board contains valid runs. A chain-starter rack tile fits run A as extension,
// but run A would then be length 4 (max valid run), so one tile must vacate to run B,
// which vacates a tile for run C, etc. Chain length ≥ 2.
export function buildDominoChain(diff: Difficulty): ArchetypeResult | null {
  const chainLen = diff === 'extreme' ? randomInt(3, 4) : 2

  // Build (chainLen + 1) runs sharing values at their boundaries
  // Run i: values [start_i .. end_i], color colors[i]
  // The "push" tile from run i becomes the "pull" starter for run i+1
  const colors = shuffle([...ALL_COLORS])
  if (colors.length < chainLen + 1) return null

  const runs: Tile[][] = []
  const startVal = randomInt(2, 13 - (chainLen * 2 + 2))

  // Build runs so consecutive runs share a boundary value
  // Run 0: length 3, values v..v+2
  // Chain tile from run 0 is v+2 (high end pushed out)
  // Run 1 starts at v+3, length 3: v+3..v+5, etc.
  let cursor = startVal
  for (let i = 0; i <= chainLen; i++) {
    const len = 3
    if (cursor + len - 1 > 13) return null
    const run: Tile[] = Array.from({ length: len }, (_, j) => ({ n: cursor + j, c: colors[i] }))
    runs.push(run)
    cursor += len
  }

  // Verify all runs are individually valid and no tile collisions
  const usedKeys = new Set<string>()
  for (const run of runs) {
    for (const t of run) {
      const k = `${t.n}_${t.c}`
      if (usedKeys.has(k)) return null
      usedKeys.add(k)
    }
  }

  const allTiles = runs.flat()
  if (!solveBag(allTiles).solvable) return null

  // Chain starter: a tile one step BELOW run[0]'s min value, same color
  // Placing it extends run[0] to length 4 (still valid), but we remove
  // run[0]'s HIGH tile into rack (simulating chain displacement)
  const run0 = runs[0]
  const minN = Math.min(...run0.map(t => t.n))
  if (minN <= 1) return null
  const chainStarter: Tile = { n: minN - 1, c: colors[0] }
  if (usedKeys.has(`${chainStarter.n}_${chainStarter.c}`)) return null

  // Rack = chain starter + displaced tiles from runs (all but run[chainLen])
  // We remove the HIGH tile from each run 0..chainLen-1 into rack
  const rack: Tile[] = [chainStarter]
  const gridTiles: Tile[] = []
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    if (i < chainLen) {
      const maxN = Math.max(...run.map(t => t.n))
      rack.push(run.find(t => t.n === maxN)!)
      gridTiles.push(...run.filter(t => t.n !== maxN))
    } else {
      gridTiles.push(...run)
    }
  }

  // allTiles for solvability = gridTiles + rack (without duplicate chainStarter)
  const bagForSolve = [...gridTiles, ...rack]
  if (!solveBag(bagForSolve).solvable) return null

  // Lay grid
  const numCols = Math.max(10, 5)
  const numRows = runs.length + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  for (let i = 0; i < runs.length; i++) {
    let col = 0
    for (const t of gridTiles.filter(x => x.c === colors[i])) {
      grid[i][col++] = t
    }
  }

  return { grid, rack: shuffle(rack), allTiles: bagForSolve }
}

// TYPE 3 — false-extension
// A rack tile looks like it extends a run (same color, adjacent value).
// Placing it in the run is the "obvious" move but leaves another rack tile
// unplaceable. Correct move: tile goes into a group.
export function buildFalseExtension(diff: Difficulty): ArchetypeResult | null {
  // Step 1: build a run of length 3-4
  const runLen = randomInt(3, 4)
  const runColor = ALL_COLORS[randomInt(0, 3)]
  const runStart = randomInt(2, 13 - runLen - 1) // leave room for extension value
  const run: Tile[] = Array.from({ length: runLen }, (_, i) => ({ n: runStart + i, c: runColor }))

  // The "extension" value is one beyond the run (high end)
  const extVal = runStart + runLen  // e.g. run is 5r6r7r, extVal=8
  if (extVal > 13) return null

  // Step 2: build a group at extVal using the 3 OTHER colors
  const otherColors = ALL_COLORS.filter(c => c !== runColor)
  const groupColors = shuffle(otherColors).slice(0, 3) as Tile['c'][]
  const group: Tile[] = groupColors.map(c => ({ n: extVal, c }))

  // Step 3: rack tile is extVal in runColor — looks like run extension
  const rackTile: Tile = { n: extVal, c: runColor }

  // Verify no collisions
  const allUsed = [...run, ...group, rackTile]
  const keys = allUsed.map(t => `${t.n}_${t.c}`)
  if (new Set(keys).size !== keys.length) return null

  // The "wrong" placement: extend the run with rackTile, group stays as-is (size 3, valid)
  // BUT then rackTile consumed into run, group of 3 at extVal is already valid (3 colors)
  // We need the WRONG placement to fail: so we must ensure group needs the rackTile
  // Approach: remove one group tile into rack (group now size 2 = invalid without rackTile)
  const displaced = group[randomInt(0, group.length - 1)]
  const boardGroup = group.filter(t => t !== displaced)
  // boardGroup now has 2 tiles (invalid alone) — needs rackTile to complete to 3

  // Add an optional decoy tile
  const decoyColors = ALL_COLORS.filter(c => c !== runColor && !boardGroup.map(t => t.c).includes(c))
  const decoyVal = runStart - 1  // one before run (another "obvious" extension on low end)
  let decoy: Tile | null = null
  if (decoyVal >= 1 && decoyColors.length > 0 && diff !== 'easy') {
    const dc = decoyColors[randomInt(0, decoyColors.length - 1)]
    const dk: string = `${decoyVal}_${dc}`
    if (!keys.includes(dk)) {
      decoy = { n: decoyVal, c: runColor }
      // decoy extends run on the LOW end — obvious but also wrong
    }
  }

  const rack: Tile[] = [rackTile, displaced]
  if (decoy) rack.push(decoy)

  const allTiles = [...run, ...boardGroup, ...rack]
  if (!solveBag(allTiles).solvable) return null

  // The false extension is structural: boardGroup of 2 is never valid without rackTile,
  // so solveBag on the wrong arrangement (run+rackTile, boardGroup+displaced) would
  // still pass since solveBag operates on bags not positions. The deception is
  // positional: the player must realize extending the run leaves the group incomplete.

  // Lay grid
  const numCols = Math.max(10, runLen + 3)
  const numRows = 4
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  for (let i = 0; i < run.length; i++) grid[0][i] = run[i]
  for (let i = 0; i < boardGroup.length; i++) grid[1][i] = boardGroup[i]

  return { grid, rack: shuffle(rack), allTiles }
}
