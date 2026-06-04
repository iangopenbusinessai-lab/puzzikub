import type { Tile, SetRow, Puzzle } from '../types'

const COLORS: Tile['c'][] = ['r', 'b', 'a', 'k']

function rand(min: number, max: number): number {
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

function makeRun(color: Tile['c'], start: number, length: number): Tile[] {
  return Array.from({ length }, (_, i) => ({ n: start + i, c: color }))
}

function makeGroup(num: number, size: number): Tile[] {
  return shuffle(COLORS).slice(0, size).map(c => ({ n: num, c }))
}

function generateSets(count: number): { sets: SetRow[]; solutionTiles: Tile[] } {
  const sets: SetRow[] = []
  const solutionTiles: Tile[] = []

  for (let i = 0; i < count; i++) {
    const useRun = Math.random() > 0.4
    let tiles: Tile[]

    if (useRun) {
      const color = COLORS[rand(0, 3)]
      const length = rand(3, 5)
      const start = rand(1, 13 - length)
      tiles = makeRun(color, start, length)
    } else {
      const num = rand(1, 13)
      const size = rand(3, 4)
      tiles = makeGroup(num, size)
    }

    const slotCount = tiles.length + rand(0, 2)
    const row: SetRow = Array(slotCount).fill(null)
    tiles.forEach((t, idx) => { row[idx] = t })
    sets.push(row)
    solutionTiles.push(...tiles)
  }

  return { sets, solutionTiles }
}

export function generatePuzzle(diff: Puzzle['diff']): Puzzle {
  const setCounts: Record<Puzzle['diff'], number> = { easy: 2, medium: 3, hard: 5 }
  const rackSizes: Record<Puzzle['diff'], [number, number]> = {
    easy: [3, 5],
    medium: [5, 8],
    hard: [8, 12],
  }

  const setCount = setCounts[diff]
  const { sets, solutionTiles } = generateSets(setCount)

  const [minRack, maxRack] = rackSizes[diff]
  const rackSize = rand(minRack, maxRack)
  const extraTiles: Tile[] = Array.from({ length: rackSize }, () => ({
    n: rand(1, 13),
    c: COLORS[rand(0, 3)],
  }))

  const rack = shuffle([...solutionTiles, ...extraTiles])

  return {
    id: crypto.randomUUID(),
    name: `${diff.charAt(0).toUpperCase() + diff.slice(1)} Puzzle`,
    diff,
    sets,
    rack,
    hint: 'Place tiles from your rack onto the board to complete valid sets.',
    generated: true,
  }
}
