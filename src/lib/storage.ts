import type { Puzzle } from '../types'

const STORAGE_KEY = 'puzzikub_library'

const SEED_PUZZLES: Puzzle[] = [
  {
    id: 'seed-1',
    name: 'Starter Run',
    diff: 'easy',
    sets: [
      [{ n: 5, c: 'r' }, null, null],
    ],
    rack: [{ n: 5, c: 'r' }, { n: 6, c: 'r' }, { n: 7, c: 'r' }, { n: 9, c: 'b' }],
    hint: 'Complete the red run.',
    generated: false,
  },
  {
    id: 'seed-2',
    name: 'Triple Group',
    diff: 'easy',
    sets: [
      [null, null, null],
    ],
    rack: [{ n: 8, c: 'r' }, { n: 8, c: 'b' }, { n: 8, c: 'a' }, { n: 3, c: 'k' }],
    hint: 'Form a group of 8s.',
    generated: false,
  },
  {
    id: 'seed-3',
    name: 'Double Duty',
    diff: 'medium',
    sets: [
      [null, null, null, null],
      [null, null, null],
    ],
    rack: [
      { n: 1, c: 'r' }, { n: 2, c: 'r' }, { n: 3, c: 'r' }, { n: 4, c: 'r' },
      { n: 7, c: 'b' }, { n: 7, c: 'k' }, { n: 7, c: 'a' },
      { n: 11, c: 'r' },
    ],
    hint: 'Fill both sets.',
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
