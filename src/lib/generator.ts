import type { Difficulty, Puzzle } from '../types'
import { buildDecoy, buildGroupsToRuns, buildRunsToGroups, type ArchetypeType } from './archetypes'

const BUILDERS: Record<ArchetypeType, (diff: Difficulty) => ReturnType<typeof buildGroupsToRuns>> = {
  'groups-to-runs': buildGroupsToRuns,
  'runs-to-groups': buildRunsToGroups,
}

/**
 * Probability the decoy layer is attempted, per difficulty. Hard/extreme only,
 * visibly more common at extreme. A decoy is a runs-to-groups board plus one
 * tempting-but-dead-end tile (see DECOY_DESIGN.md); its par flows through the
 * same `optimalMoves` field as every other archetype. If the decoy build fails,
 * we fall through to the ordinary 50/50 direction pick.
 */
const DECOY_PROB: Partial<Record<Difficulty, number>> = { hard: 0.35, extreme: 0.6 }

/**
 * Direction is chosen ~50/50 per puzzle so players meet both across a session.
 * It is recorded on archetypeId for internal use only — nothing player-facing
 * reveals it, since naming the mechanic gives away the solution.
 *
 * If the chosen direction cannot build a puzzle, the other one is tried rather
 * than failing outright.
 */
export function generatePuzzle(diff: Difficulty): Puzzle | null {
  if (Math.random() < (DECOY_PROB[diff] ?? 0)) {
    const decoy = generateDecoy(diff)
    if (decoy) return decoy // else fall through to the ordinary archetypes
  }
  const first: ArchetypeType = Math.random() < 0.5 ? 'groups-to-runs' : 'runs-to-groups'
  const second: ArchetypeType = first === 'groups-to-runs' ? 'runs-to-groups' : 'groups-to-runs'
  return generateArchetype(first, diff) ?? generateArchetype(second, diff)
}

/** Decoy puzzles reuse the shared Puzzle shape; the hidden `archetypeId` marks
 * them internally (nothing player-facing reads it), consistent with direction. */
function generateDecoy(diff: Difficulty): Puzzle | null {
  for (let i = 0; i < 40; i++) {
    const result = buildDecoy(diff)
    if (!result) continue
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.minMoves,
      generated: true,
      archetypeId: 'runs-to-groups-decoy',
    }
  }
  return null
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
