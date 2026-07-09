import type { Tile } from '../types'

export interface SolveResult {
  solvable: boolean
  assignment?: Map<string, 'run' | 'group'>
}

// Tile universe this DP is defined over: values MIN_VALUE..MAX_VALUE, four
// colors, exactly one copy of each (value, color) pair. The state space below
// only visits values in that range, so a bag containing anything else must be
// rejected up front rather than silently skipped — skipping a tile would let
// an unusable tile vanish and report a bag as solvable when it is not.
const MIN_VALUE = 1
const MAX_VALUE = 13

const COLORS = ['r', 'b', 'a', 'k'] as const
type Color = typeof COLORS[number]
type RunState = [number, number, number, number]

interface MemoEntry {
  result: boolean
  group?: Color[]
}

/** Key used in the returned assignment map. Unique because m = 1 copy. */
export const tileKey = (t: Tile): string => `${t.n}_${t.c}`

export function solveBag(tiles: Tile[]): SolveResult {
  // An empty tile universe is never a valid puzzle.
  if (tiles.length === 0) return { solvable: false }

  // Index tiles by value → set of colors present.
  const bagByValue = new Map<number, Set<Color>>()
  for (const t of tiles) {
    if (!Number.isInteger(t.n) || t.n < MIN_VALUE || t.n > MAX_VALUE) return { solvable: false }
    if (!COLORS.includes(t.c as Color)) return { solvable: false }
    if (!bagByValue.has(t.n)) bagByValue.set(t.n, new Set())
    const colors = bagByValue.get(t.n)!
    // A duplicate (value, color) can never be consumed: a run cannot contain
    // the same value twice, nor a group the same color twice. So any duplicate
    // makes the whole bag unpartitionable.
    if (colors.has(t.c as Color)) return { solvable: false }
    colors.add(t.c as Color)
  }

  const memo = new Map<string, MemoEntry>()

  function dp(v: number, runs: RunState): boolean {
    if (v > MAX_VALUE) {
      // Valid only if no incomplete runs (length 1 or 2)
      return runs[0] !== 1 && runs[0] !== 2
          && runs[1] !== 1 && runs[1] !== 2
          && runs[2] !== 1 && runs[2] !== 2
          && runs[3] !== 1 && runs[3] !== 2
    }

    const key = `${v}|${runs[0]}|${runs[1]}|${runs[2]}|${runs[3]}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached.result

    const present = bagByValue.get(v) ?? new Set<Color>()
    const presentArr = COLORS.filter(c => present.has(c))

    // Enumerate all valid group formations (no group, groups of 3, group of 4)
    const groupOptions: Color[][] = [[]] // no group
    if (presentArr.length >= 3) {
      const n = presentArr.length
      for (let i = 0; i < n - 2; i++)
        for (let j = i + 1; j < n - 1; j++)
          for (let k = j + 1; k < n; k++)
            groupOptions.push([presentArr[i], presentArr[j], presentArr[k]])
      if (n === 4)
        groupOptions.push([...presentArr])
    }

    for (const group of groupOptions) {
      const groupSet = new Set(group)
      const newRuns: RunState = [0, 0, 0, 0]
      let valid = true

      for (let i = 0; i < 4; i++) {
        const c = COLORS[i]
        const extendsRun = present.has(c) && !groupSet.has(c)

        if (extendsRun) {
          newRuns[i] = runs[i] < 3 ? runs[i] + 1 : 3
        } else {
          // run terminates here
          if (runs[i] === 1 || runs[i] === 2) { valid = false; break }
          newRuns[i] = 0
        }
      }

      if (valid && dp(v + 1, newRuns)) {
        // Record the winning group choice for assignment reconstruction.
        memo.set(key, { result: true, group })
        return true
      }
    }

    memo.set(key, { result: false })
    return false
  }

  // Reconstruct which structure (run vs group) each tile belongs to by
  // walking the winning path recorded in memo.
  function reconstructAssignment(): Map<string, 'run' | 'group'> {
    const assignment = new Map<string, 'run' | 'group'>()
    let runs: RunState = [0, 0, 0, 0]
    for (let v = MIN_VALUE; v <= MAX_VALUE; v++) {
      const key = `${v}|${runs[0]}|${runs[1]}|${runs[2]}|${runs[3]}`
      // Every state along the winning path was memoized true by dp(), so a
      // miss here means the memo and the replayed transitions disagree.
      const entry = memo.get(key)
      if (!entry?.result) throw new Error(`solveBag: unreachable state ${key} on winning path`)
      const groupSet = new Set(entry.group ?? [])
      const present = bagByValue.get(v) ?? new Set<Color>()
      const newRuns: RunState = [0, 0, 0, 0]
      for (let i = 0; i < 4; i++) {
        const c = COLORS[i]
        if (!present.has(c)) continue
        if (groupSet.has(c)) {
          assignment.set(tileKey({ n: v, c }), 'group')
          newRuns[i] = 0
        } else {
          assignment.set(tileKey({ n: v, c }), 'run')
          newRuns[i] = runs[i] < 3 ? runs[i] + 1 : 3
        }
      }
      runs = newRuns
    }
    return assignment
  }

  if (!dp(MIN_VALUE, [0, 0, 0, 0])) return { solvable: false }
  return { solvable: true, assignment: reconstructAssignment() }
}
