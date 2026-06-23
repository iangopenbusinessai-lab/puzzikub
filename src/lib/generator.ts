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

function legalExtensions(sets: Tile[][], used: Set<string>): Tile[] {
  const extensions: Tile[] = []
  for (const set of sets) {
    if (isValidRun(set)) {
      const minN = Math.min(...set.map(t => t.n))
      const maxN = Math.max(...set.map(t => t.n))
      const c = set[0].c
      if (minN > 1) {
        const t: Tile = { n: minN - 1, c }
        if (!used.has(tileKey(t))) extensions.push(t)
      }
      if (maxN < 13) {
        const t: Tile = { n: maxN + 1, c }
        if (!used.has(tileKey(t))) extensions.push(t)
      }
    } else if (isValidGroup(set)) {
      const n = set[0].n
      const usedColors = new Set(set.map(t => t.c))
      for (const c of COLORS) {
        if (!usedColors.has(c)) {
          const t: Tile = { n, c }
          if (!used.has(tileKey(t))) extensions.push(t)
        }
      }
    }
  }
  return extensions
}

// Returns ambiguity and false-ambiguity scores for a rack against a board's sets.
function computeScores(
  rack: Tile[],
  boardSets: Tile[][],
  allTiles: Tile[]
): { ambiguity: number; falseAmbiguity: number } {
  let ambiguity = 0
  let falseAmbiguity = 0

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

    // Can t start a new group with other rack tiles of same value?
    const sameNumDiffColor = rack.filter(r => r !== t && r.n === t.n && r.c !== t.c)
    const newGroupPossible = sameNumDiffColor.length >= 2 ? 1 : 0

    ambiguity += runCount + groupCount + newGroupPossible

    // False ambiguity: t has obvious run extension but removing it breaks solvability
    if (runCount > 0) {
      let removed = false
      const remaining = allTiles.filter(x => {
        if (!removed && x.n === t.n && x.c === t.c) { removed = true; return false }
        return true
      })
      if (!solveBag(remaining).solvable) falseAmbiguity++
    }
  }

  return { ambiguity, falseAmbiguity }
}

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  if (diff === 'extreme') {
    const archetypes: ArchetypeType[] = ['run-to-group', 'domino-chain', 'false-extension']
    const type = archetypes[randomInt(0, archetypes.length - 1)]
    return generateArchetype(type, diff)
  }

  const numSets = diff === 'easy' ? 2 : diff === 'medium' ? 3 : randomInt(4, 6)
  const numExtra =
    diff === 'easy'   ? randomInt(2, 3) :
    diff === 'medium' ? randomInt(3, 5) :
    randomInt(5, 8)

  for (let attempt = 0; attempt < 20; attempt++) {
    const sets = buildSolutionSets(numSets, diff)
    if (!sets) continue

    const used = new Set<string>(sets.flat().map(tileKey))
    const extensions = legalExtensions(sets, used)
    if (extensions.length < numExtra) continue

    const rack = shuffle(extensions).slice(0, numExtra)
    const allTiles = [...sets.flat(), ...rack]
    if (!solveBag(allTiles).solvable) continue

    const { ambiguity, falseAmbiguity } = computeScores(rack, sets, allTiles)

    const meetsThreshold =
      diff === 'easy'   ? ambiguity <= 3 && falseAmbiguity === 0 :
      diff === 'medium' ? ambiguity >= 4 && ambiguity <= 7 && falseAmbiguity <= 1 :
      /* hard */          ambiguity >= 8 && ambiguity <= 13 && falseAmbiguity >= 1 && falseAmbiguity <= 2

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

export function generateArchetype(type: ArchetypeType, diff: Difficulty): Puzzle | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result =
      type === 'run-to-group'    ? buildRunToGroup(diff) :
      type === 'domino-chain'    ? buildDominoChain(diff) :
      /* false-extension */        buildFalseExtension(diff)
    if (!result) continue
    if (!solveBag(result.allTiles).solvable) continue

    return {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.rack.length,
      generated: true,
      archetypeId: type,
    }
  }
  return null
}
