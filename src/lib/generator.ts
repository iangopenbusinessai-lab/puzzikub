import type { Difficulty, Puzzle } from '../types'
import { buildGroupsToRuns, buildRunsToGroups, type ArchetypeType } from './archetypes'

const BUILDERS: Record<ArchetypeType, (diff: Difficulty) => ReturnType<typeof buildGroupsToRuns>> = {
  'groups-to-runs': buildGroupsToRuns,
  'runs-to-groups': buildRunsToGroups,
}

/**
 * Direction is chosen ~50/50 per puzzle so players meet both across a session.
 * It is recorded on archetypeId for internal use only — nothing player-facing
 * reveals it, since naming the mechanic gives away the solution.
 *
 * If the chosen direction cannot build a puzzle, the other one is tried rather
 * than failing outright.
 */
export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const first: ArchetypeType = Math.random() < 0.5 ? 'groups-to-runs' : 'runs-to-groups'
  const second: ArchetypeType = first === 'groups-to-runs' ? 'runs-to-groups' : 'groups-to-runs'
  return generateArchetype(first, diff) ?? generateArchetype(second, diff)
}

export function generateArchetype(type: ArchetypeType, diff: Difficulty): Puzzle | null {
  const build = BUILDERS[type]
  for (let i = 0; i < 40; i++) {
    const result = build(diff)
    if (!result) continue

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.minMoves,
      generated: true,
      archetypeId: type,
    }
  }
  return null
}
