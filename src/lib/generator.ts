import type { Difficulty, Puzzle } from '../types'
import { buildRunToGroup, type ArchetypeType } from './archetypes'

export function generatePuzzle(diff: Difficulty): Puzzle | null {
  return generateArchetype('run-to-group', diff)
}

export function generateArchetype(_type: ArchetypeType, diff: Difficulty): Puzzle | null {
  for (let i = 0; i < 40; i++) {
    const result = buildRunToGroup(diff)
    if (!result) continue

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.minMoves,
      generated: true,
      archetypeId: 'run-to-group',
    }
  }
  return null
}
