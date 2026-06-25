import type { Tile, Grid, Difficulty, Puzzle } from '../types'
import { isValidRun, isValidGroup } from './validator'
import { solveBag } from './solver'
import { buildRunToGroup, buildDominoChain, buildFalseExtension, type ArchetypeType } from './archetypes'

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

function makeRun(diff: Difficulty): Tile[] {
  const len =
    diff === 'easy'   ? randomInt(3, 4) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(4, 6)
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
      const wantRun = Math.random() < 0.5
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

function layOnGrid(sets: Tile[][]): Grid {
  const maxLen = Math.max(...sets.map(s => s.length))
  const numCols = Math.max(10, maxLen + 2)
  const numRows = sets.length + 2
  const grid: Grid = Array.from({ length: numRows }, () => Array(numCols).fill(null))
  sets.forEach((set, r) => {
    set.forEach((tile, c) => { grid[r][c] = tile })
  })
  return grid
}

function generateExtraRack(sets: Tile[][], used: Set<string>, count: number): Tile[] | null {
  const candidates: Tile[] = []
  for (const set of sets) {
    if (isValidRun(set)) {
      const minN = Math.min(...set.map(t => t.n))
      const maxN = Math.max(...set.map(t => t.n))
      const c = set[0].c
      if (minN > 1) candidates.push({ n: minN - 1, c })
      if (maxN < 13) candidates.push({ n: maxN + 1, c })
    } else if (isValidGroup(set)) {
      const n = set[0].n
      const existingColors = new Set(set.map(t => t.c))
      for (const c of COLORS) {
        if (!existingColors.has(c)) candidates.push({ n, c })
      }
    }
  }

  const result: Tile[] = []
  const usedCopy = new Set(used)
  for (const t of shuffle(candidates)) {
    if (result.length >= count) break
    const k = tileKey(t)
    if (!usedCopy.has(k)) {
      result.push(t)
      usedCopy.add(k)
    }
  }
  return result.length >= count ? result : null
}

function computeAmbiguity(rack: Tile[], boardSets: Tile[][]): number {
  let ambiguity = 0

  for (const t of rack) {
    let runCount = 0
    let groupCount = 0

    for (const set of boardSets) {
      if (isValidRun(set)) {
        const c = set[0].c
        const minN = Math.min(...set.map(s => s.n))
        const maxN = Math.max(...set.map(s => s.n))
        if (t.c === c && (t.n === minN - 1 || t.n === maxN + 1)) runCount++
      } else if (isValidGroup(set)) {
        const n = set[0].n
        const groupColors = new Set(set.map(s => s.c))
        if (t.n === n && !groupColors.has(t.c) && set.length < 4) groupCount++
      }
    }

    const sameNumDiffColor = rack.filter(r => r !== t && r.n === t.n && r.c !== t.c)
    const newGroupPossible = sameNumDiffColor.length >= 2 ? 1 : 0

    ambiguity += runCount + groupCount + newGroupPossible
  }

  return ambiguity
}

// Kept for future use but not called during generation (too slow — N solveBag calls per rack tile).
export function computeFalseAmbiguity(rack: Tile[], boardSets: Tile[][], allTiles: Tile[]): number {
  let falseAmbiguity = 0
  for (const t of rack) {
    let runCount = 0
    for (const set of boardSets) {
      if (isValidRun(set)) {
        const c = set[0].c
        const minN = Math.min(...set.map(s => s.n))
        const maxN = Math.max(...set.map(s => s.n))
        if (t.c === c && (t.n === minN - 1 || t.n === maxN + 1)) runCount++
      }
    }
    if (runCount > 0) {
      let removed = false
      const remaining = allTiles.filter(x => {
        if (!removed && x.n === t.n && x.c === t.c) { removed = true; return false }
        return true
      })
      if (!solveBag(remaining).solvable) falseAmbiguity++
    }
  }
  return falseAmbiguity
}

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  if (diff === 'extreme') {
    const archetypes: ArchetypeType[] = ['run-to-group', 'run-to-group', 'domino-chain']
    const type = shuffle(archetypes)[0]
    return generateArchetype(type, diff)
  }

  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(3, 5)
  const numExtra =
    diff === 'easy'   ? randomInt(1, 2) :
    diff === 'medium' ? randomInt(2, 3) :
    randomInt(3, 5)

  for (let attempt = 0; attempt < 50; attempt++) {
    const sets = buildSolutionSets(numSets, diff)
    if (!sets) continue

    const used = new Set<string>(sets.flat().map(tileKey))
    const rack = generateExtraRack(sets, used, numExtra)
    if (!rack) continue

    const allTiles = [...sets.flat(), ...rack]
    if (!solveBag(allTiles).solvable) continue

    const ambiguity = computeAmbiguity(rack, sets)

    const meetsThreshold =
      diff === 'easy'   ? ambiguity >= 1 :
      diff === 'medium' ? ambiguity >= 2 :
      /* hard */          ambiguity >= 3

    if (!meetsThreshold) continue

    const grid = layOnGrid(sets)

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid,
      rack,
      optimalMoves: numExtra,
      generated: true,
    }
  }

  return null
}

function tryBuildArchetype(type: ArchetypeType, diff: Difficulty, attempts: number): { grid: Grid; rack: Tile[]; allTiles: Tile[] } | null {
  for (let i = 0; i < attempts; i++) {
    const result =
      type === 'run-to-group'  ? buildRunToGroup(diff) :
      type === 'domino-chain'  ? buildDominoChain(diff) :
      buildFalseExtension(diff)
    if (!result) continue
    if (!solveBag(result.allTiles).solvable) continue
    return result
  }
  return null
}

export function generateArchetype(type: ArchetypeType, diff: Difficulty): Puzzle | null {
  const allTypes: ArchetypeType[] = ['run-to-group', 'domino-chain', 'false-extension']
  const order: ArchetypeType[] = [type, ...shuffle(allTypes.filter(t => t !== type))]

  for (const t of order) {
    const maxAttempts = t === type ? 5 : 3
    const result = tryBuildArchetype(t, diff, maxAttempts)
    if (!result) continue

    return {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.rack.length,
      generated: true,
      archetypeId: t,
    }
  }

  // Safety net: buildRunToGroup is guaranteed to succeed
  const fallback = buildRunToGroup(diff)
  if (fallback) {
    return {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: fallback.grid,
      rack: fallback.rack,
      optimalMoves: fallback.rack.length,
      generated: true,
      archetypeId: 'run-to-group',
    }
  }
  return null
}
