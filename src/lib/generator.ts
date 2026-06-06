import type { Tile, Grid, Difficulty, Puzzle } from '../types'

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

// ── Stage 1: build solution sets ─────────────────────────────────────────────

function makeRun(): Tile[] {
  const len = randomInt(3, 5)
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

function tileKey(t: Tile): string {
  return `${t.n}_${t.c}`
}

function buildSets(numSets: number): Tile[][] | null {
  const used = new Set<string>()
  const sets: Tile[][] = []

  for (let i = 0; i < numSets; i++) {
    let placed = false
    for (let attempt = 0; attempt < 50; attempt++) {
      const tiles = Math.random() < 0.5 ? makeRun() : makeGroup()
      if (tiles.some(t => used.has(tileKey(t)))) continue
      tiles.forEach(t => used.add(tileKey(t)))
      sets.push(tiles)
      placed = true
      break
    }
    if (!placed) return null
  }

  return sets
}

// ── Stage 2: place sets onto grid, size grid to fit ──────────────────────────

function buildGrid(sets: Tile[][]): Grid {
  const maxLen = Math.max(...sets.map(s => s.length))
  const cols = maxLen + 2
  const rows = sets.length + 1   // extra empty row for player manoeuvring
  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (let r = 0; r < sets.length; r++) {
    for (let c = 0; c < sets[r].length; c++) {
      grid[r][c + 1] = sets[r][c]  // col offset 1 for left padding
    }
  }
  return grid
}

// ── Stage 3: disrupt N tiles into rack ───────────────────────────────────────

function disrupt(grid: Grid, sets: Tile[][], n: number): { grid: Grid; rack: Tile[] } {
  const g = grid.map(row => [...row])
  const rowCount = sets.map(s => s.length)

  // Collect all filled positions in set rows only
  const candidates: { row: number; col: number }[] = []
  for (let r = 0; r < sets.length; r++) {
    for (let c = 0; c < g[r].length; c++) {
      if (g[r][c] !== null) candidates.push({ row: r, col: c })
    }
  }

  const rack: Tile[] = []
  for (const { row, col } of shuffle(candidates)) {
    if (rack.length >= n) break
    // Safety: each set must keep at least 2 tiles after all removals
    if (rowCount[row] - 1 < 2) continue
    rack.push(g[row][col]!)
    g[row][col] = null
    rowCount[row]--
  }

  return { grid: g, rack: shuffle(rack) }
}

// ── Stage 4: assemble and return ─────────────────────────────────────────────

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 5)
  const numDisrupt =
    diff === 'easy' ? randomInt(2, 3) :
    diff === 'medium' ? randomInt(4, 6) :
    randomInt(7, 10)

  for (let attempt = 0; attempt < 10; attempt++) {
    const sets = buildSets(numSets)
    if (!sets) continue

    const grid = buildGrid(sets)
    const { grid: puzzleGrid, rack } = disrupt(grid, sets, numDisrupt)

    if (rack.length === 0) continue

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: puzzleGrid,
      rack,
      optimalMoves: rack.length,
      generated: true,
    }
  }

  return null
}
