import type { Tile, Grid, Difficulty, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'
import { solve } from './solver'

const COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

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

function tileKey(t: Tile): string {
  return `${t.n}_${t.c}`
}

// ── Stage 1: build valid solution sets ──────────────────────────────────────

function makeRun(diff: Difficulty): Tile[] {
  // Hard mode targets longer runs so splits are possible (need ≥ 7 for split)
  const len =
    diff === 'easy'   ? randomInt(3, 4) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(5, 8)
  const c = COLORS[randomInt(0, 3)]
  const start = randomInt(1, 14 - len)
  return Array.from({ length: len }, (_, i) => ({ n: start + i, c }))
}

function makeGroup(): Tile[] {
  const n = randomInt(1, 13)
  const size = randomInt(3, 4)
  const cols = shuffle([...COLORS]).slice(0, size)
  return cols.map(c => ({ n, c }))
}

function buildSolutionSets(numSets: number, diff: Difficulty): Tile[][] | null {
  const used = new Set<string>()
  const sets: Tile[][] = []
  for (let i = 0; i < numSets; i++) {
    let placed = false
    for (let attempt = 0; attempt < 60; attempt++) {
      // Hard mode: bias toward runs so splits are available
      const wantRun = diff === 'hard' ? Math.random() < 0.7 : Math.random() < 0.5
      const tiles = wantRun ? makeRun(diff) : makeGroup()
      if (tiles.some(t => used.has(tileKey(t)))) continue
      if (!isValidRun(tiles) && !isValidGroup(tiles)) continue
      tiles.forEach(t => used.add(tileKey(t)))
      sets.push(tiles)
      placed = true
      break
    }
    if (!placed) return null
  }
  return sets
}

// ── Stage 2: select rack tiles, keeping board sets valid ─────────────────────

interface RackBoard { rack: Tile[]; boardSets: Tile[][] }

function selectRackAndBoard(sets: Tile[][], diff: Difficulty): RackBoard | null {
  const rack: Tile[] = []
  const boardSets: Tile[][] = []
  const targetMin = diff === 'easy' ? 2 : diff === 'medium' ? 4 : 6
  const targetMax = diff === 'easy' ? 4 : diff === 'medium' ? 7 : 12

  for (const set of sets) {
    const sorted = isValidRun(set) ? [...set].sort((a, b) => a.n - b.n) : set

    // Hard: split long runs by removing middle bridge tile(s)
    if (diff === 'hard' && isValidRun(sorted) && sorted.length >= 7) {
      const maxRemove = Math.min(3, sorted.length - 6, targetMax - rack.length)
      if (maxRemove >= 1) {
        const removeCount = randomInt(1, maxRemove)
        const mid = Math.floor(sorted.length / 2)
        const bridgeStart = mid - Math.floor(removeCount / 2)
        const left = sorted.slice(0, bridgeStart)
        const right = sorted.slice(bridgeStart + removeCount)
        if (left.length >= 3 && right.length >= 3) {
          rack.push(...sorted.slice(bridgeStart, bridgeStart + removeCount))
          boardSets.push(left, right)
          continue
        }
      }
    }

    // Group of 4: remove one tile (any position)
    if (isValidGroup(set) && set.length === 4 && rack.length < targetMax && Math.random() < 0.75) {
      const idx = randomInt(0, 3)
      rack.push(set[idx])
      boardSets.push(set.filter((_, i) => i !== idx))
      continue
    }

    // Run of ≥ 4: remove one endpoint
    if (isValidRun(sorted) && sorted.length >= 4 && rack.length < targetMax) {
      // Medium/hard: allow removing both endpoints for longer runs
      const removeTwo = (diff !== 'easy') && sorted.length >= 5 && rack.length + 2 <= targetMax && Math.random() < 0.4
      if (removeTwo) {
        rack.push(sorted[0], sorted[sorted.length - 1])
        boardSets.push(sorted.slice(1, -1))
      } else {
        const fromEnd = Math.random() < 0.5
        rack.push(fromEnd ? sorted[sorted.length - 1] : sorted[0])
        boardSets.push(fromEnd ? sorted.slice(0, -1) : sorted.slice(1))
      }
      continue
    }

    // Keep set whole on board
    boardSets.push(set)
  }

  // Safety: ensure every board set is still valid
  if (!boardSets.every(s => isValidRun(s) || isValidGroup(s))) return null
  if (rack.length < targetMin) return null

  return { rack, boardSets }
}

// ── Stage 3: lay board sets out in valid rows ────────────────────────────────

function layoutGrid(boardSets: Tile[][]): Grid {
  const grid: Grid = Array.from({ length: 6 }, () => Array(10).fill(null))
  for (let r = 0; r < boardSets.length && r < 6; r++) {
    for (let c = 0; c < boardSets[r].length && c + 1 < 10; c++) {
      grid[r][c + 1] = boardSets[r][c]
    }
  }
  return grid
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 6)

  for (let attempt = 0; attempt < 20; attempt++) {
    const sets = buildSolutionSets(numSets, diff)
    if (!sets) continue

    const rb = selectRackAndBoard(sets, diff)
    if (!rb) continue
    const { rack, boardSets } = rb

    // boardSets may exceed 6 rows — skip if so
    if (boardSets.length > 6) continue

    const grid = layoutGrid(boardSets)
    const solveResult = solve(grid, rack, 600)
    if (!solveResult.solvable) continue

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid,
      rack: shuffle(rack),
      optimalMoves: rack.length,
      generated: true,
    }
  }

  return null
}
