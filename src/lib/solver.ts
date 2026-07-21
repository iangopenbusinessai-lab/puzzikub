import type { Tile } from '../types'
import { TILE_COPIES, makeTile } from '../types'

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

/**
 * The m=1 partition oracle. **RETIREMENT STATUS after m=2 migration Step 7: NOT
 * removed, and deliberately so.** No production code calls it any more — every
 * builder call site in `archetypes.ts` moved to `solveBagM2` in Step 7 — but it
 * is still imported by four VERIFICATION harnesses (`verifyEngine.ts`,
 * `decoy.verify.ts`, `redherring.verify.ts`, `composed.verify.ts`).
 *
 * That is the reason to keep it, not an oversight: the existing archetypes emit
 * m=1-shaped bags, a strict subset of what `solveBagM2` handles, so builders on
 * `solveBagM2` checked by harnesses on `solveBag` is a real differential test.
 * Retire this only when a harness no longer needs an independent oracle — and
 * note Step 11's duplicate-bearing archetype cannot use it at all, since m=1
 * `solveBag` rejects any duplicate outright.
 *
 * Its two long-standing `tsc` errors (`tileKey({n,c})` in `reconstructAssignment`)
 * were FIXED in a standalone build-fix session — they had blocked `tsc -b`, and
 * therefore `npm run build` / `npm run deploy`, ever since Step 1 added `Tile.id`.
 * The fix was type-level only (mint via `makeTile`); the DP below is untouched.
 * CLAUDE.md's Step 2 note had predicted Step 7 would clear them by deleting this
 * function, which turned out to be wrong — it survives as the harness oracle.
 */
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
        // `makeTile(v, c)` rather than a bare `{ n: v, c }` literal purely to
        // satisfy `Tile`'s `id` requirement (Step 1). This is a TYPE-level fix
        // only: `tileKey` reads `n` and `c` and ignores `id`, so the key string
        // is byte-identical to what the literal produced. Nothing about which
        // tiles land in a run vs a group changes here, and this whole function
        // runs only AFTER dp() has already decided `solvable`.
        if (groupSet.has(c)) {
          assignment.set(tileKey(makeTile(v, c)), 'group')
          newRuns[i] = 0
        } else {
          assignment.set(tileKey(makeTile(v, c)), 'run')
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

// ===========================================================================
// solveBagM2 — the m=2 partition oracle. Same job as solveBag (can this flat
// bag be split into valid runs/groups using every tile?), but for the real
// Rummikub universe of TILE_COPIES copies per (value, colour). solveBag is left
// untouched; existing archetypes keep calling it until Step 7 retires it.
//
// DESIGN (MIGRATION_M2.md §2, prototyped and differentially fuzzed in §0.3):
// per-colour state is an UNORDERED PAIR of saturating run lengths in {0,1,2,3}
// — 10 states per colour ({0,0}{0,1}{0,2}{0,3}{1,1}{1,2}{1,3}{2,2}{2,3}{3,3}),
// 10^4 per value. A colour can have up to two runs open at once because it may
// carry two copies of a value. At each value v we (a) choose a group multiset —
// 0, 1, or 2 groups, each a distinct-colour subset of size 3-4, with colour c
// used in at most count_c of them — then (b) the remaining r_c copies extend
// runs. Group tiles are consumed at v (they touch no run). Terminal at v>13:
// every open run is length 0 or >=3.
//
// The group/run split is exactly the m=1 idea generalised from "0 or 1 group,
// 0 or 1 run" to "0-2 groups, 0-2 runs" per colour, so with all counts <=1 the
// state pair never has two nonzero entries and the whole DP collapses onto the
// m=1 behaviour (verified: 0 differential mismatches vs solveBag on dup-free
// bags in the Step 10 probe).
// ===========================================================================

/** The 5 distinct-colour subsets of size 3 or 4, as colour-index arrays. A
 *  group is one of these; two groups (for m=2) is any unordered pair of them. */
const M2_SINGLE_GROUPS: number[][] = [
  [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3], [0, 1, 2, 3],
]

/** A concrete group multiset at one value plus the per-colour copy count it
 *  consumes. Deduped by `uses` so the DP visits each usage vector once, while a
 *  representative concrete `groups` is retained for assignment reconstruction. */
interface GroupChoice { groups: number[][]; uses: [number, number, number, number] }

/** Every legal group multiset (0, 1, or 2 groups) realisable from `counts`. */
function m2GroupChoices(counts: number[]): GroupChoice[] {
  const bySig = new Map<string, GroupChoice>()
  const ind = (G: number[]): [number, number, number, number] => {
    const u: [number, number, number, number] = [0, 0, 0, 0]
    for (const c of G) u[c] = 1
    return u
  }
  const add = (groups: number[][], uses: [number, number, number, number]) => {
    const sig = uses.join(',')
    if (!bySig.has(sig)) bySig.set(sig, { groups, uses })
  }
  add([], [0, 0, 0, 0]) // no group
  for (const G of M2_SINGLE_GROUPS) if (G.every(c => counts[c] >= 1)) add([G], ind(G))
  for (let i = 0; i < M2_SINGLE_GROUPS.length; i++)
    for (let j = i; j < M2_SINGLE_GROUPS.length; j++) {
      const a = ind(M2_SINGLE_GROUPS[i]), b = ind(M2_SINGLE_GROUPS[j])
      const uses: [number, number, number, number] = [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]
      if (uses.every((x, c) => x <= counts[c]))
        add([M2_SINGLE_GROUPS[i], M2_SINGLE_GROUPS[j]], uses)
    }
  return [...bySig.values()]
}

const m2Term = (n: number) => n === 0 || n === 3          // a run may end at length 0 or >=3
const m2Sat = (n: number) => (n >= 3 ? 3 : n + 1)          // extend/start (0 -> 1, saturates at 3)

/**
 * Every new (a<=b) run-pair reachable from incoming pair (x,y) when `r` copies
 * of this colour land at the current value. Each copy is the endpoint of one run
 * ending here: it either extends one of the (<=2) incoming runs or starts a
 * fresh length-1 run; any incoming run not extended must terminate legally
 * (length 0 or >=3). `E` is the set of incoming slots that get extended.
 */
function m2RunTransitions(x: number, y: number, r: number): [number, number][] {
  const slots = [x, y]
  const seen = new Set<string>()
  const out: [number, number][] = []
  for (const E of [[], [0], [1], [0, 1]] as number[][]) {
    if (E.length > r) continue
    let ok = true
    const lengths: number[] = []
    for (let i = 0; i < 2; i++) {
      if (E.includes(i)) lengths.push(m2Sat(slots[i]))
      else if (!m2Term(slots[i])) { ok = false; break }
    }
    if (!ok) continue
    for (let k = 0; k < r - E.length; k++) lengths.push(1) // fresh runs
    if (lengths.length > 2) continue                        // >2 open runs impossible
    while (lengths.length < 2) lengths.push(0)
    lengths.sort((a, b) => a - b)
    const key = `${lengths[0]},${lengths[1]}`
    if (!seen.has(key)) { seen.add(key); out.push([lengths[0], lengths[1]]) }
  }
  return out
}

// Integer encoding of the per-colour state so the DP allocates nothing per
// node. The 10 sorted run-length pairs are indexed 0..9; a full 4-colour state
// is packed as ((iR*10+iB)*10+iA)*10+iK in 0..9999, and a (value, state) memo
// key as v*10000 + that. This mirrors the tighter encoding the §0.3 prototype
// used — the earlier tuple-array/string-key form was correct but ~40x slower.
const M2_PAIRS: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [1, 3], [2, 2], [2, 3], [3, 3],
]
/** M2_PAIR_INDEX[a][b] (a<=b) -> its index in M2_PAIRS. */
const M2_PAIR_INDEX: number[][] = (() => {
  const t = Array.from({ length: 4 }, () => new Array<number>(4).fill(-1))
  M2_PAIRS.forEach(([a, b], i) => { t[a][b] = i })
  return t
})()
/** Whether pair `i` may terminate here (both runs length 0 or >=3). */
const M2_PAIR_TERM: boolean[] = M2_PAIRS.map(([a, b]) => m2Term(a) && m2Term(b))
/** M2_TRANS_IDX[fromPairIdx][r] -> the reachable next pair indices. */
const M2_TRANS_IDX: number[][][] = M2_PAIRS.map(([a, b]) =>
  [0, 1, 2].map(r => m2RunTransitions(a, b, r).map(([x, y]) => M2_PAIR_INDEX[x][y])))

/** Group multisets depend ONLY on a value's copy-count vector (each colour 0-2),
 *  so there are just 3^4 = 81 possibilities — precompute them all once at module
 *  load rather than re-enumerating per call. Indexed ((c0*3+c1)*3+c2)*3+c3. */
const M2_CHOICES_BY_COUNT: GroupChoice[][] = (() => {
  const table: GroupChoice[][] = []
  for (let c0 = 0; c0 <= 2; c0++) for (let c1 = 0; c1 <= 2; c1++) for (let c2 = 0; c2 <= 2; c2++) for (let c3 = 0; c3 <= 2; c3++)
    table[((c0 * 3 + c1) * 3 + c2) * 3 + c3] = m2GroupChoices([c0, c1, c2, c3])
  return table
})()
const m2CountIndex = (cnt: number[]) => ((cnt[0] * 3 + cnt[1]) * 3 + cnt[2]) * 3 + cnt[3]

interface M2Win { choiceIdx: number; next: number } // winning move per (v,state) key

export function solveBagM2(tiles: Tile[]): SolveResult {
  // An empty tile universe is never a valid puzzle (matches solveBag).
  if (tiles.length === 0) return { solvable: false }

  // count[value][colorIdx].
  const count: number[][] = Array.from({ length: MAX_VALUE + 1 }, () => [0, 0, 0, 0])
  for (const t of tiles) {
    if (!Number.isInteger(t.n) || t.n < MIN_VALUE || t.n > MAX_VALUE) return { solvable: false }
    const ci = COLORS.indexOf(t.c as Color)
    if (ci < 0) return { solvable: false }
    // More than TILE_COPIES copies can never be consumed — reject up front,
    // exactly as solveBag rejects a second copy under m=1.
    if (++count[t.n][ci] > TILE_COPIES) return { solvable: false }
  }

  // Per value, look up its precomputed group multisets (no per-call enumeration).
  const choicesAt: GroupChoice[][] = count.map(cnt => M2_CHOICES_BY_COUNT[m2CountIndex(cnt)])

  const memo = new Map<number, boolean>()
  const winMove = new Map<number, M2Win>()

  // state carried as four pair indices (s0..s3); no array allocated per node.
  function dp(v: number, s0: number, s1: number, s2: number, s3: number): boolean {
    if (v > MAX_VALUE) return M2_PAIR_TERM[s0] && M2_PAIR_TERM[s1] && M2_PAIR_TERM[s2] && M2_PAIR_TERM[s3]
    const sIdx = ((s0 * 10 + s1) * 10 + s2) * 10 + s3
    const key = v * 10000 + sIdx
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    const cnt = count[v]
    const choices = choicesAt[v]
    let result = false
    outer:
    for (let ci = 0; ci < choices.length; ci++) {
      const uses = choices[ci].uses
      const o0 = M2_TRANS_IDX[s0][cnt[0] - uses[0]]
      const o1 = M2_TRANS_IDX[s1][cnt[1] - uses[1]]
      const o2 = M2_TRANS_IDX[s2][cnt[2] - uses[2]]
      const o3 = M2_TRANS_IDX[s3][cnt[3] - uses[3]]
      if (o0.length === 0 || o1.length === 0 || o2.length === 0 || o3.length === 0) continue
      for (const t0 of o0) for (const t1 of o1) for (const t2 of o2) for (const t3 of o3) {
        if (dp(v + 1, t0, t1, t2, t3)) {
          winMove.set(key, { choiceIdx: ci, next: ((t0 * 10 + t1) * 10 + t2) * 10 + t3 })
          result = true
          break outer
        }
      }
    }
    memo.set(key, result)
    return result
  }

  if (!dp(MIN_VALUE, 0, 0, 0, 0)) return { solvable: false }

  // Reconstruct which structure each concrete tile id belongs to by replaying
  // the recorded winning move at each value. At (v, colour): the winning group
  // multiset consumes `uses_c` copies (labelled 'group'); the remaining
  // `count_c - uses_c` copies extend runs (labelled 'run'). The two copies of a
  // (v,c) pair are interchangeable, so any split of that (v,c)'s ids into
  // uses_c / rest is valid — and it is keyed by tile.id, so both copies of a
  // duplicate get their own entry (the m=1 `${n}_${c}` key would collide here).
  // Id buckets are built here (only on the solvable path), not in the hot loop.
  const idsAt: string[][][] = Array.from({ length: MAX_VALUE + 1 }, () => [[], [], [], []] as string[][])
  for (const t of tiles) idsAt[t.n][COLORS.indexOf(t.c as Color)].push(t.id)

  const assignment = new Map<string, 'run' | 'group'>()
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0
  for (let v = MIN_VALUE; v <= MAX_VALUE; v++) {
    const sIdx = ((s0 * 10 + s1) * 10 + s2) * 10 + s3
    const win = winMove.get(v * 10000 + sIdx)
    if (!win) throw new Error(`solveBagM2: no winning move at v=${v} state=${sIdx} on winning path`)
    const usesC = [0, 0, 0, 0]
    for (const g of choicesAt[v][win.choiceIdx].groups) for (const c of g) usesC[c]++
    for (let c = 0; c < 4; c++) {
      const ids = idsAt[v][c]
      for (let i = 0; i < ids.length; i++) assignment.set(ids[i], i < usesC[c] ? 'group' : 'run')
    }
    const nxt = win.next
    s0 = Math.floor(nxt / 1000) % 10; s1 = Math.floor(nxt / 100) % 10; s2 = Math.floor(nxt / 10) % 10; s3 = nxt % 10
  }
  return { solvable: true, assignment }
}
