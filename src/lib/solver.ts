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

export function solveBag(tiles: Tile[]): SolveResult {
  // Index tiles by value → set of colors present
  const bagByValue = new Map<number, Set<Color>>()
  for (const t of tiles) {
    if (!bagByValue.has(t.n)) bagByValue.set(t.n, new Set())
    bagByValue.get(t.n)!.add(t.c as Color)
  }

  const memo = new Map<string, boolean>()

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
    if (cached !== undefined) return cached

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
        memo.set(key, true)
        return true
      }
    }

    memo.set(key, false)
    return false
  }

  return { solvable: dp(1, [0, 0, 0, 0]) }
}
