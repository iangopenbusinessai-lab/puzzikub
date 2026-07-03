import type { Tile } from '../types'

export interface SolveResult {
  solvable: boolean
  assignment?: Map<string, 'run' | 'group'>
}

// Verification (manual traces — see CLAUDE.md Session 1):
// solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}]) → {solvable:true}   // run of 3 reds
// solveBag([{n:3,c:'r'},{n:4,c:'r'}])              → {solvable:false}  // run too short
// solveBag([{n:5,c:'r'},{n:5,c:'b'},{n:5,c:'k'}])  → {solvable:true}   // group of 3
// solveBag([{n:5,c:'r'},{n:5,c:'b'}])              → {solvable:false}  // only 2 same value

const COLORS = ['r', 'b', 'a', 'k'] as const
type Color = typeof COLORS[number]
type RunState = [number, number, number, number]

interface MemoEntry {
  result: boolean
  group?: Color[]
}

export function solveBag(tiles: Tile[]): SolveResult {
  // An empty tile universe is never a valid puzzle.
  if (tiles.length === 0) return { solvable: false }

  // Index tiles by value → set of colors present
  const bagByValue = new Map<number, Set<Color>>()
  for (const t of tiles) {
    if (!bagByValue.has(t.n)) bagByValue.set(t.n, new Set())
    bagByValue.get(t.n)!.add(t.c as Color)
  }

  const memo = new Map<string, MemoEntry>()

  function dp(v: number, runs: RunState): boolean {
    if (v > 13) {
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
    for (let v = 1; v <= 13; v++) {
      const key = `${v}|${runs[0]}|${runs[1]}|${runs[2]}|${runs[3]}`
      const entry = memo.get(key)
      if (!entry || !entry.result) break // shouldn't happen if solvable
      const group = entry.group ?? []
      const groupSet = new Set(group)
      const present = bagByValue.get(v) ?? new Set<Color>()
      const newRuns: RunState = [0, 0, 0, 0]
      for (let i = 0; i < 4; i++) {
        const c = COLORS[i]
        if (present.has(c)) {
          const tileKey = `${v}_${c}`
          if (groupSet.has(c)) {
            assignment.set(tileKey, 'group')
            newRuns[i] = 0
          } else {
            assignment.set(tileKey, 'run')
            newRuns[i] = runs[i] < 3 ? runs[i] + 1 : 3
          }
        }
      }
      runs = newRuns
    }
    return assignment
  }

  const solvable = dp(1, [0, 0, 0, 0])
  if (!solvable) return { solvable: false }
  return { solvable: true, assignment: reconstructAssignment() }
}

// Dev-only assertions (verified by tracing the DP):
//   solveBag([]) → {solvable:false}
//   solveBag([{n:3,c:'r'},{n:4,c:'r'},{n:5,c:'r'}]) → solvable:true,
//     assignment: {'3_r'→'run','4_r'→'run','5_r'→'run'}
//   solveBag([{n:5,c:'r'},{n:5,c:'b'},{n:5,c:'k'}]) → solvable:true,
//     assignment: {'5_r'→'group','5_b'→'group','5_k'→'group'}
