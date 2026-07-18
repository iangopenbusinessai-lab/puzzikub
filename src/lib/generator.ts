import type { Difficulty, Puzzle } from '../types'
import { buildDecoy, buildRedHerring, buildGroupsToRuns, buildRunsToGroups, type ArchetypeType } from './archetypes'

const BUILDERS: Record<ArchetypeType, (diff: Difficulty) => ReturnType<typeof buildGroupsToRuns>> = {
  'groups-to-runs': buildGroupsToRuns,
  'runs-to-groups': buildRunsToGroups,
}

/**
 * Optional trap layers, hard/extreme only. Both are runs-to-groups boards with
 * tempting-but-dead-end tiles whose par flows through the normal `optimalMoves`
 * field: decoy = ONE tempting tile (DECOY_DESIGN.md); red herring = TWO tempting
 * extenders at opposite ends of one run, coupled through a single hybrid
 * reorganization (RED_HERRING_DESIGN.md).
 *
 * The two are MUTUALLY EXCLUSIVE on a given puzzle: a single random roll picks
 * at most one via DISJOINT probability bands ([0,decoy) → decoy,
 * [decoy,decoy+herring) → red herring). Composing both on one puzzle is a
 * deliberately deferred question for a later session. Both bands are visibly
 * larger at extreme than hard.
 */
const DECOY_PROB: Partial<Record<Difficulty, number>> = { hard: 0.30, extreme: 0.45 }
const REDHERRING_PROB: Partial<Record<Difficulty, number>> = { hard: 0.20, extreme: 0.30 }

/**
 * Direction is chosen ~50/50 per puzzle so players meet both across a session.
 * It is recorded on archetypeId for internal use only — nothing player-facing
 * reveals it, since naming the mechanic gives away the solution.
 *
 * If the chosen direction cannot build a puzzle, the other one is tried rather
 * than failing outright.
 */
export function generatePuzzle(diff: Difficulty): Puzzle | null {
  const roll = Math.random()
  const decoyP = DECOY_PROB[diff] ?? 0
  const herringP = REDHERRING_PROB[diff] ?? 0
  if (roll < decoyP) {
    const decoy = generateDecoy(diff)
    if (decoy) return decoy // else fall through to the ordinary archetypes
  } else if (roll < decoyP + herringP) {
    const herring = generateRedHerring(diff)
    if (herring) return herring
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

/** Red-herring puzzles, same hidden-tag convention as decoy. */
function generateRedHerring(diff: Difficulty): Puzzle | null {
  for (let i = 0; i < 40; i++) {
    const result = buildRedHerring(diff)
    if (!result) continue
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${diff} puzzle`,
      diff,
      grid: result.grid,
      rack: result.rack,
      optimalMoves: result.minMoves,
      generated: true,
      archetypeId: 'runs-to-groups-redherring',
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
