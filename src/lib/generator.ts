import type { Tile, Grid, Difficulty, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'

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

// ── Stage 2: place sets onto grid ────────────────────────────────────────────

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

// ── Stage 3: single-step legal extensions ────────────────────────────────────
// Only immediate neighbours — no 2-hop candidates that require a bridge tile
// that may not exist in the rack.

function singleStepExtensions(set: Tile[], used: Set<string>): Tile[] {
  const candidates: Tile[] = []

  const color = set[0].c
  const nums = set.map(t => t.n).sort((a, b) => a - b)
  const isRun =
    set.every(t => t.c === color) &&
    nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)

  const num = set[0].n
  const isGroup =
    set.every(t => t.n === num) &&
    new Set(set.map(t => t.c)).size === set.length

  if (isRun) {
    const minN = nums[0]
    const maxN = nums[nums.length - 1]
    if (minN - 1 >= 1) {
      const t: Tile = { n: minN - 1, c: color }
      if (!used.has(tileKey(t))) candidates.push(t)
    }
    if (maxN + 1 <= 13) {
      const t: Tile = { n: maxN + 1, c: color }
      if (!used.has(tileKey(t))) candidates.push(t)
    }
  }

  if (isGroup && set.length < 4) {
    const existingColors = set.map(t => t.c)
    for (const c of COLORS) {
      if (!existingColors.includes(c)) {
        const t: Tile = { n: num, c }
        if (!used.has(tileKey(t))) candidates.push(t)
      }
    }
  }

  return candidates
}

// ── Stage 4: assemble and return ─────────────────────────────────────────────

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 6)
  const numExtra =
    diff === 'easy' ? randomInt(2, 3) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(5, 8)

  for (let attempt = 0; attempt < 10; attempt++) {
    // Stage 1: build core valid sets
    const coreSets = buildSets(numSets)
    if (!coreSets) continue

    // Stage 2: for each set, append single-step extension tiles directly into
    // that set's tile array. Tracking `used` across sets prevents cross-set
    // collisions. The puzzle rack = these appended tiles pulled back out.
    const used = new Set(coreSets.flat().map(tileKey))
    const extSets: Tile[][] = coreSets.map(s => [...s])
    const rackTiles: Tile[] = []

    const indices = shuffle(Array.from({ length: numSets }, (_, i) => i))
    for (const si of indices) {
      if (rackTiles.length >= numExtra) break
      // Always compute candidates against the ORIGINAL core set endpoints so
      // extensions added to one end don't shift the target for the other.
      const candidates = singleStepExtensions(coreSets[si], used)
      if (candidates.length === 0) continue
      const want = Math.min(2, numExtra - rackTiles.length, candidates.length)
      for (const t of shuffle(candidates).slice(0, want)) {
        extSets[si].push(t)
        used.add(tileKey(t))
        rackTiles.push(t)
      }
    }

    if (rackTiles.length === 0) continue
    if (rackTiles.length < numExtra * 0.75) continue

    // Stage 3: confirm every extended set is still a valid Rummikub set.
    // Single-step extensions always preserve validity, so this should never
    // fail — it's a safety net against future logic changes.
    if (!extSets.every(s => isValidRun(s) || isValidGroup(s))) continue

    // Stage 4: build puzzle.
    // grid  = core sets only (extensions removed) — always a fully valid board.
    // rack  = the extension tiles; each has exactly one valid home with no
    //         cross-set conflicts possible, guaranteeing solvability.
    const grid = buildGrid(coreSets)
    const extraRows = 2
    const extraGrid = [
      ...grid,
      ...Array.from({ length: extraRows }, () => Array(grid[0].length).fill(null)),
    ]

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: extraGrid,
      rack: shuffle(rackTiles),
      optimalMoves: rackTiles.length,
      generated: true,
    }
  }

  return null
}
