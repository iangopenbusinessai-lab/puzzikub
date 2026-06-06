import type { Puzzle } from '../types'

const STORAGE_KEY = 'puzzikub_library'

const SEED_PUZZLES: Puzzle[] = [
  {
    id: 'seed1',
    name: 'First steps',
    diff: 'easy',
    grid: [],
    rack: [{ n: 6, c: 'r' }, { n: 9, c: 'k' }, { n: 4, c: 'r' }, { n: 5, c: 'r' }, { n: 9, c: 'b' }, { n: 9, c: 'r' }],
    optimalMoves: 6,
    generated: false,
  },
  {
    id: 'seed2',
    name: 'Two fronts',
    diff: 'medium',
    grid: [],
    rack: [{ n: 6, c: 'b' }, { n: 11, c: 'k' }, { n: 5, c: 'b' }, { n: 7, c: 'b' }, { n: 11, c: 'r' }, { n: 11, c: 'a' }],
    optimalMoves: 6,
    generated: false,
  },
  {
    id: 'seed3',
    name: 'Triple threat',
    diff: 'hard',
    grid: [],
    rack: [{ n: 4, c: 'r' }, { n: 10, c: 'k' }, { n: 8, c: 'k' }, { n: 3, c: 'r' }, { n: 5, c: 'r' }, { n: 10, c: 'b' }, { n: 10, c: 'a' }, { n: 7, c: 'k' }, { n: 9, c: 'k' }],
    optimalMoves: 9,
    generated: false,
  },
]

export function loadLibrary(): Puzzle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedLibrary()
    return JSON.parse(raw) as Puzzle[]
  } catch {
    return seedLibrary()
  }
}

export function saveLibrary(puzzles: Puzzle[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(puzzles))
}

function seedLibrary(): Puzzle[] {
  saveLibrary(SEED_PUZZLES)
  return SEED_PUZZLES
}
