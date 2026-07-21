# Puzzikub — CLAUDE.md
*Last updated: June 2026 — post-Fable audit + open-reasoning session restructure.*

## Project overview
Rummikub-style clear-your-rack puzzle game on a free grid.
Stack: Vite + React + TypeScript, deployed to GitHub Pages.
Repo: https://github.com/iangopenbusinessai-lab/puzzikub.git

---

## CRITICAL: vite.config.ts
base must always be '/puzzikub/' — never change this, never remove it.

---

## Testing & verification workflow
- Local dev: `npm run dev` → http://localhost:5173/puzzikub/
- Live site: https://iangopenbusinessai-lab.github.io/puzzikub/
- Deploy: `npm run deploy` (builds + pushes dist/ to gh-pages branch)
  Changes are NOT live until this runs, even after `git push` to main.
- Correct order: git add/commit/push FIRST, then npm run deploy.
- Person reports bugs via: browser screenshots, browser console output,
  PowerShell terminal output (Windows environment).

## Debugging protocol — MANDATORY

1. Read relevant files first. Never assume file contents.
2. Add temporary console.log, get real output, THEN fix.
3. Dynamic import() of .ts files does NOT work on deployed GitHub Pages.
4. ESCALATION RULE: if a bug survives one fix attempt, STOP patching.
   Diagnose first. State root cause explicitly. Then fix.
5. SESSION HEALTH: if a single prompt takes more than ~5 minutes of
   tool-call time, STOP it. Do not let a session run 10+ minutes or
   burn 40k+ tokens. Split into smaller single-file prompts instead.
   One fresh session per file change is the safe default for anything
   touching solver.ts, generator.ts, archetypes.ts, or validator.ts.
6. **ANTI-ILLUSION RULE — the most important one, added after repeated
   false "fixed!" reports:** `tsc --noEmit` passing is NOT evidence
   that logic is correct. It only proves the code is syntactically
   valid TypeScript — it says nothing about whether a solver returns
   the right answer, a generator produces a fair puzzle, or a bug is
   actually gone. Every claim that something "works" or "is fixed"
   MUST be backed by real executed output: run the code (via
   `npx tsx <file>`, a dev-only test block, or the running app),
   print real values, and report the actual printed output verbatim.
   A narrative summary ("verified successfully", "confirmed working")
   is not acceptable in place of pasted real output. This rule applies
   to every session touching src/lib/, not just the ones that
   originally motivated it.

---

## Model and effort selection

Not every session needs the strongest available model — match the
tool to the kind of work:

- **Strong reasoning model (Opus/Fable-tier) + plan mode**: genuine
  open-ended design work where a subtle mistake would be easy to make
  and hard to notice — e.g. designing the solver's DP transitions from
  scratch, designing a puzzle-construction algorithm that must satisfy
  several invariants simultaneously. Give these sessions the RULES and
  INVARIANTS, not a pre-written implementation — let the model design
  its own approach and require it to prove correctness with real
  executed test output (see Anti-illusion rule above) before reporting
  done.
- **Default model + auto mode**: mechanical work with no real design
  freedom — deleting superseded functions, wiring one function to call
  another, routing by difficulty, prop threading, styling. If a
  "mechanical" prompt starts inventing new algorithmic logic, that's a
  sign the task was mis-scoped as mechanical — stop and re-scope it as
  a design session instead.

---

## Architecture rules
- All game logic in src/lib/ — pure functions, zero React imports
- Components are presentational only; all state in hooks
- Drag: native mouse events (mousedown/mousemove/mouseup on document)
  NO HTML5 drag API, NO draggable attribute, NO ondragstart
- localStorage key: 'puzzikub_library'
- Styling: inline style={{}} props only — index.css for keyframes and
  CSS custom properties (theme vars) only
- Never import React hooks inside src/lib/

---

## Core types
See `src/types.ts` for the full definitions (Tile, Grid, Difficulty,
Screen, Puzzle, DragSrc, NUM_COLOR). Two non-obvious contracts not
expressed by the types themselves: `Puzzle.grid` is the starting board
— fully solved, NO gaps, ever; `Puzzle.optimalMoves` is computed from
construction, not searched.

**m=2 MIGRATION — Step 1 DONE (types.ts only).** `Tile` now carries a
stable `id: string` in addition to `n`/`c`; `{n,c}` alone can't tell the
two m=2 copies of a (value,colour) pair apart. Two new exports in
`types.ts`: `TILE_COPIES = 2` (the copy count, named in one place, not
scattered as literal 2s) and `makeTile(n, c, copy = 0)` which mints tiles.

**ID-SCHEME DECISION (recorded per MIGRATION_M2.md Step 1): STRUCTURED,
not opaque.** The id is `` `${n}_${c}_${copy}` `` (e.g. `5_r_0`), chosen
over a uuid/global-counter because it (1) stays readable in verify-harness
output and (2) is a PURE function of `(n, c, copy)`, so it survives a JSON
round-trip with no remap table and lets Step 8's legacy-save migration
re-mint ids deterministically from `(n, c, occurrenceIndex)`.
**Signature note / deviation justified:** the doc wrote `makeTile(n, c)`,
but a pure structured id genuinely needs the copy index as input —
otherwise disambiguating the second copy requires hidden global state,
which is opaque-by-another-name and breaks per-puzzle scoping and the
round-trip purity the scheme exists for. So `copy` is an explicit third
argument defaulting to `0`, leaving `makeTile(n, c)` callable exactly as
the doc writes it (m=1-shaped construction only ever needs copy 0).

Step 1 is intentionally types-only: the rest of the codebase does NOT
compile until later steps swap `{n,c}` literals for `makeTile`. `tsc -p
tsconfig.app.json` reports 131 errors, ALL of them missing-`id`
construction sites (TS2741/TS2345/TS2322), zero logic errors — that error
list IS the Step 1 deliverable (it enumerates every call site later steps
must touch). Note `npx tsc --noEmit` alone is a no-op here: root
`tsconfig.json` has `files: []` + project references, so the real
typecheck is `tsc -b` / `tsc -p tsconfig.app.json`.

**m=2 MIGRATION — Step 2 DONE (solver.ts: `solveBagM2` added alongside
`solveBag`).** `solveBag` is UNTOUCHED; existing archetypes keep calling it
until Step 7. `solveBagM2` is the m=2 partition oracle: per-colour state is
an unordered pair of saturating run lengths (10 states/colour), at each
value 0-2 groups are chosen then the remaining copies extend runs; rejects
>`TILE_COPIES` copies up front; `assignment` is keyed by **`tile.id`** (the
old `${n}_${c}` key would collide on the two copies of a duplicate).

*Verification (real executed output, temp probe since deleted):*
- Hand-traced: two simultaneous same-colour runs ✓; only-one-of-two-copies-
  can-extend (red 1-8 + dup2 → unsolvable) ✓; owner red 1-8 + dup3 + dup6 →
  **solvable** ✓; two groups at one value ✓.
- 28-pair cut-point sweep reproduces exactly the §0.3 pairs `(2,3)(3,4)(3,5)
  (3,6)(4,5)(4,6)(5,6)(6,7)`, 0 oracle mismatches.
- Differential fuzz vs an independent brute-force oracle: **11,500 instances
  (7,478 duplicate-bearing), 0 mismatches.**
- `assignment`: on 333 solvable bags, every tile id present (both copies of
  duplicates) and re-partitioning by label passes isValidRun/isValidGroup.
- Timing: **0.0097 ms/call on the full 104-tile m=2 universe, 0.0043 ms on a
  typical bag** — in the prototype's 0.002-0.004 ms range. NOTE: the first
  implementation ran ~40x slower (0.15 ms); the cause was re-enumerating the
  bag-independent group multisets per call. Fix: precompute them once in a
  module-level 81-entry table (`M2_CHOICES_BY_COUNT`), plus integer-encoded
  state (pair-index per colour, numeric memo keys) so the DP allocates
  nothing per node.

*tsc after Step 2: still 131 errors, UNCHANGED.* The 2 pre-existing solver.ts
errors are inside `solveBag`'s `reconstructAssignment` (`tileKey({n,c})`,
lines 124/127) — Step 2 must NOT modify `solveBag`, so they correctly remain
(they clear in a later step / Step 7 retirement). `solveBagM2` itself added
zero new errors. (The Step 2 brief anticipated a drop of 2 here; that was a
misread — those 2 errors are `solveBag`'s, not something Step 2 resolves.)

**m=2 MIGRATION — Step 3 DONE (validator.ts: confirmation only, ZERO code
changes, per the plan).** The audit claim held: `isValidRun` sorts and
requires strict consecutiveness, so a duplicated value breaks the chain
naturally; `isValidGroup` compares distinct-colour count to array length, so
a duplicated colour breaks that naturally. Neither function references
`tile.id`, and none needed to.

*Verification (real executed output, `src/lib/verifyEngine.ts`, permanent —
added to the existing `=== m=2 STEP 3: VALIDATOR DUPLICATE-AWARENESS
(confirmation only) ===` section rather than a new file):*
```
  PASS  isValidRun rejects a duplicate value ([3r#0,3r#1,4r#0])
  PASS  isValidGroup rejects a duplicate colour ([5r#0,5r#1,5b#0])
  PASS  isValidGroup rejects a duplicate colour even at 4 tiles ([7r#0,7r#1,7b#0,7a#0])
  PASS  validateGrid accepts duplicate (value,colour) tiles split across two valid runs
  PASS  validateGrid still rejects an incomplete run even when it duplicates board values
  PASS  getInvalidCells flags only the incomplete duplicate-bearing row
  PASS  getInvalidCells leaves the complete duplicate-bearing row (row 0) unflagged
  PASS  getNewlyValidCells reports exactly the row that became valid, duplicate values notwithstanding
```
The real case (not just the rejection cases) is `validateGrid` on a 2-row
board where row 0 = `3r#0,4r#0,5r#0` and row 1 = `3r#1,4r#1,5r#1` — same
three (value,colour) pairs duplicated across two independently valid runs
— `=== true`. Full suite: `=== SELF-TESTS: 52 passed, 0 failed ===` (was 44
before these 8 were added; nothing else changed or regressed).

*tsc after Step 3: still 131 errors, UNCHANGED* — expected, since
`validator.ts` was not touched at all.

**m=2 MIGRATION — Step 4 DONE (`mixedGoalPlanner.ts`: id-keyed goals + concrete
resolver).** The planner now speaks tile ids, not `(value,colour)` labels, so the
two m=2 copies of a duplicate are placed and moved independently.

*What changed (only `mixedGoalPlanner.ts` + its verify harness — no other file):*
- `tileKey` is now `t => t.id` (was `${n}_${c}`). A new INTERNAL `labelKey =
  ${n}_${c}` keys the `(value,colour)` MULTISET in feasibility only — the two
  concepts genuinely split under m=2 (a window spec "red 4" is a label demand; a
  goal cell needs a specific copy id).
- `windowsPartitionBag`: presence check → **COUNT check**. Rejects a
  `(value,colour)` only when it appears **> `TILE_COPIES`** in the bag (not merely
  > once). Demand/supply are matched as label multisets; two windows may now both
  claim a label (legal when the bag holds two copies). Its internal solvability
  sanity check moved from `solveBag` → **`solveBagM2`** — required so a genuine
  duplicate bag (which m=1 `solveBag` rejects outright) can pass; on duplicate-free
  bags the two agree (Step 10 probe: 5,400 bags, 0 mismatches), so m=1 verdicts are
  unchanged. (This is a consequence of the count-check change, NOT the Step 7
  builder-call-site swap — no archetype call site was touched.)
- `windowTiles(w)` no longer keys goals: it mints copy-0 SPEC tiles for validation
  and length only. Goal binding goes through the new resolver `bindWindowTiles`.

*RESOLVER DESIGN DECISION — built BOTH (a) and (b), (b) as the default:* the doc's
"subtle part" (a window spec "red 4" can match two real tiles; never silently pick
"whichever is first"). `bindWindowTiles(windows, bag, pinned?)` binds each window
slot to a CONCRETE bag tile id, never mints one. When a `(value,colour)` has two
demanded copies (it lands in a run window AND a group window — a single window never
repeats a label), the choice is resolved by a **deliberate, documented rule: consume
copies in ASCENDING id order** (the pool bucket is explicitly sorted by id, so the
choice depends ONLY on ids — proven independent of bag/scan order by a test that
binds the natural, 3a-reversed, and fully-shuffled bag to byte-identical results).
Its safety claim is scoped precisely: it always yields a VALID injective binding
(every copy → exactly one slot, no collision) whose move cost `mixedLayoutMoves`
computes exactly (== move-BFS for that binding). It does **NOT** claim the MIN-cost
pairing when a duplicate copy is already on the board — a test exhibits an instance
where the ascending default costs 1 but the reverse pairing costs 0, and BFS confirms
each. Choosing the cheapest pairing is **Step 6's** minimisation, which drives this
resolver via the `pinned` override (design (a): pin explicit ids per label) to
enumerate the 2^d candidate pairings. Step 4 deliberately stops at "correct per
binding", which is exactly the Step 10 note's requirement.

*Verification (real executed output; `npx tsx src/lib/mixedGoalPlanner.verify.ts`):*
- **Regression (requirement 1):** the 16 original m=1 checks (sections 1-5) pass
  UNCHANGED — DECOY hybrid par=19, the 2/3-cycle + path BFS crafts, the 800-instance
  random sweep (493 BFS-checked, 0 witness/BFS mismatches), same as before. The only
  edits to those sections were mechanical: bare `{n,c}` → `makeTile(n,c)` and
  hardcoded goal keys `"7_r"` → `k(7,'r')` (= `7_r_0`), forced by `tileKey → id`.
- **New m=2 duplicate cases (requirement 2), all BFS-cross-checked:** 21 new checks
  (total **37 passed / 0 failed**). The canonical case — value-3 colour-a in both a
  run `{1,2,3}a` and a group `{3:a,b,k}` (bag holds 3a#0 AND 3a#1) — verified for
  BOTH the default binding (P0, analytic=witness=BFS=1) and the pinned reverse (P1,
  =0), proving the pairing matters and each binding's cost is exact. Plus resolver
  determinism (natural==reversed==shuffled binding), the count check
  (2-copy bag feasible; 3-copy rejected citing `TILE_COPIES`), and a **369-instance
  random m=2 sweep, all 369 BFS-checked, 0 witness and 0 BFS mismatches**, every one
  with both duplicate copies on the board.

*tsc delta (requirement 3): 131 → **102** (−29), verified by reading the diff.* The
29 resolved errors are EXACTLY the fabricated-`{n,c}`-literal construction sites in
the two files I touched (`mixedGoalPlanner.ts` 2 + `mixedGoalPlanner.verify.ts` 27),
now minting ids via `makeTile`. Zero new errors; `archetypes.ts` stayed at 25 (my
added `bindWindowTiles` export and unchanged `windowTiles`/`mixedLayoutMoves`
signatures did not affect it). Remaining 102: verifyEngine 53, archetypes 25, storage
21, solver 2, TilePicker 1 — all later-step construction sites.

**m=2 MIGRATION — Step 5 DONE (`archetypes.ts` id-keyed plumbing). ZERO behavioural
change: every harness green, every par number EXACT.** The Step 4/5 boundary noted
below is CLOSED — the three trap harnesses are green again.

*What changed (mechanical only — this relabels which string identifies a tile, never
what gets built):*
- `tileKey` is now `t => t.id` (was `${n}_${c}`), matching `mixedGoalPlanner`'s
  `tileKey` — the one every hybrid goal map is read through. `GoalPlan.goal` and
  every `goal.set(...)` are keyed by id.
- All **17** `{ n, c }` literals in `archetypes.ts` → `makeTile(n, c)`.
- **The actual Step 4/5 fix:** the three hybrid-goal sites (`buildDecoyAt`,
  `buildRedHerringAt`, `buildComposedAt`) now bind window specs to the **CONCRETE
  grid+rack tiles via `bindWindowTiles`** instead of minting fresh copy-0 spec
  tiles. Under m=1 a minted id and the real id coincide, so this is behaviour-
  neutral today; it is required by MIGRATION_M2.md §0.5's note and makes "exactly
  one tile per (value,colour), so the binding is unambiguous" an *asserted* fact
  (`bindWindowTiles` returns null if a slot has no concrete tile) rather than a
  hope. `buildComposedAt`'s `span` likewise selects from `allTiles` now.
- One judgement call recorded: `planValueGroupGoal`'s internal `rank` map is keyed
  by minted copy-0 ids. Safe *because that planner already rejects any value
  carrying a colour twice*, so it never sees a duplicate — commented in place.
- Harness edits forced by the same swap, **no assertion loosened**: `verifyEngine.ts`
  53 tile literals → `makeTile` + `plan.goal` lookups by `t.id`; the three trap
  harnesses' goal lookups by `t.id`. `verifyEngine`'s `allTiles` collision check
  stays a **LABEL** key deliberately — it asserts the builders still emit m=1-shaped
  puzzles, which IS Step 5's contract (Step 11 is what relaxes it).

*Verification (real executed output):*
```
verifyEngine.ts             === SELF-TESTS: 52 passed, 0 failed ===
                            === INVARIANTS (a)-(d): ALL PASSED on every generated puzzle ===
                            (a)-(e) 25/25 per archetype per difficulty, 0 duplicates
decoy.verify.ts             === SELF-CHECKS: 23 passed, 0 failed ===
redherring.verify.ts        === SELF-CHECKS: 25 passed, 0 failed ===
composed.verify.ts          === SELF-CHECKS: 32 passed, 0 failed ===
mixedGoalPlanner.verify.ts  === SELF-CHECKS: 37 passed, 0 failed ===
```
**Par: EXACT on all seven recorded numbers — 20 fresh builds each, zero spread**
(observed value set printed per row, not narrated):
```
EXACT  easy       (runs-to-groups)  expected 11  observed [11]
EXACT  medium     (runs-to-groups)  expected 16  observed [16]
EXACT  hard       (runs-to-groups)  expected 20  observed [20]
EXACT  decoy      hard/extreme      expected 22/25  observed [22]/[25]
EXACT  redherring hard/extreme      expected 21/24  observed [21]/[24]
EXACT  composed   hard/extreme      expected 24/27  observed [24]/[27]
--> ALL EXACT
```
`groups-to-runs` par is per-instance variable by construction (it always was);
its measured averages are unchanged too — 10.4 / 13.4 / 19.8 / 24.3 vs the
previously recorded 10.6 / 13.4 / 20.6 / 24.2.

*The `goal.get(undefined) → null` path is gone:* `buildDecoy` / `buildRedHerring` /
`buildComposed` each return non-null **100/100** at hard AND extreme (was: null on
every call after Step 4), and all three layers are emitted by real
`generatePuzzle()` again — e.g. extreme/200: composed 43, decoy 59, red herring 52,
base 46.

*tsc delta, read from the actual diff: **102 → 24 (−78)**.* Exactly the two files
touched: `archetypes.ts` 25 → 0 and `verifyEngine.ts` 53 → 0. Zero new errors, and
no other file's count moved. The remaining 24 are all later-step construction
sites: `storage.ts` 21 (Step 8 legacy-save migration), `solver.ts` 2 (inside
`solveBag`'s `reconstructAssignment` — retired in Step 7), `TilePicker.tsx` 1.

**⚠️ RESOLVED BY STEP 5 (kept for the record) — Step 4/5 BOUNDARY:
`decoy.verify.ts` / `redherring.verify.ts` / `composed.verify.ts` were RED after
Step 4, by design.** Root
cause (exact, for Step 5): `archetypes.ts:974` (and :1113, :1297) build `goal` keyed
by archetypes' LOCAL `tileKey = ${n}_${c}` over id-less `{n,c}` board tiles, then
call the now-id-keyed `mixedLayoutMoves`, which looks up `goal.get(t.id)` →
`goal.get(undefined)` → null → `buildDecoy`/etc. return null. Step 5's stated job —
"`{n,c}` literal → `makeTile(n,c)`; `GoalPlan.goal` and every `goal.set(...)` keyed
by id" — is precisely this fix. NOT broken by Step 4: **`verifyEngine.ts` 52/52
still green** (base archetypes don't use the planner) and **`generatePuzzle`
degrades gracefully** — a rolled trap layer returns null and falls through to the
base archetypes (`generator.ts:82/90-92`), so the live game still ships valid
base-only puzzles until Step 5 (just with wasted retry attempts on a trap roll).

---

## ENGINE ARCHITECTURE (src/lib/) — ground truth definitions

### The rule that matters most
**A puzzle is only valid to ship if the "obvious" move fails.** Every
prior generator version regressed to fill-in-the-blank because nothing
ever checked whether the naive placement wins. Whatever the exact
implementation, an `isTrivial`-equivalent gate must exist and must
actually reject puzzles where it fails — verified by generating real
puzzles and checking real counts, not by inspecting the construction
logic and assuming it's fine.

### Two failure modes actually observed in production (screenshots)
Any construction approach must be checked against both of these —
they are not hypothetical:

1. **Fill-in-the-blank**: board shows sets with visible gaps, rack
   tiles are exactly the missing pieces, each obviously belonging to
   one slot. E.g. board "6b 7b _ 9b 10b", rack "8b".
2. **Free-standing rack**: board is fully valid and untouched, but the
   rack tiles form a complete valid run/group entirely on their own
   (e.g. a full run of one color). Player places rack as a new row,
   never touches the board. E.g. rack "4,5,6,7,8" of one color.

### Solver (src/lib/solver.ts)
```ts
export interface SolveResult {
  solvable: boolean
  assignment?: Map<string, 'run' | 'group'>
}
export function solveBag(tiles: Tile[]): SolveResult
```
Job: given a flat bag of tiles (no grid position), can they be
partitioned into valid runs/groups using every tile? Reference: van
Rijn, Takes, Vis, "The Complexity of Rummikub Problems"
(arXiv:1604.07553) — proves this is O(n) via DP for fixed k=4 colors,
m=1 copy, n=13 values.

Known correctness requirements (verify with real executed test cases,
per the Anti-illusion rule, not by reading the code):
- `solveBag([])` must return `solvable: false` — an empty tile universe
  is never a valid puzzle. (A naive DP base case often gets this wrong
  by returning true when there's nothing to fail on — check explicitly.)
- `assignment` must be populated when solvable, mapping each tile to
  whether it landed in a run or a group — needed for `optimalMoves`
  and any goal-layout construction downstream.

Do NOT use solveBag as part of the live win condition — that's
validateGrid's job (below). A bag being partitionable in theory doesn't
mean the tiles are correctly positioned on the current grid. Conflating
these caused a real bug where placing tiles anywhere on the board
counted as a win.

### Validator (src/lib/validator.ts) — correct as of last audit
```ts
export function isValidRun(tiles: Tile[]): boolean
export function isValidGroup(tiles: Tile[]): boolean
export function validateGrid(grid: Grid): boolean
export function getInvalidCells(grid: Grid): Set<string>
export function getNewlyValidCells(prevGrid: Grid, newGrid: Grid): Set<string>
```
OR-based coverage (not XOR — a tile at the intersection of two
independently valid groups is fine), shared group-scanning logic, a
tile is invalid only if it has no valid group of length ≥3 in either
direction. Win condition: `rack.length === 0 && validateGrid(grid)` —
no bag-based fallback, ever.

### Generator + Archetypes (src/lib/generator.ts, src/lib/archetypes.ts)
**The exact construction algorithm is intentionally not dictated here**
— it's an open design problem, solved by whichever session designs it,
and re-verified independently by the harness (below) rather than
trusted from the design session's own report. What IS fixed, as
non-negotiable invariants any construction must satisfy:

1. `validateGrid(startBoard) === true` before any rack tile is placed.
2. `solveBag([...boardTiles, ...rack]).solvable === true`.
3. The rack (or any subset of it, size ≥3) does not form a valid run
   or group on its own.
4. Placing every rack tile at its single most "obvious" spot, with no
   board tile moved, does NOT produce a valid grid.

A known-good building block (available as a tool, not mandatory): an
N×L grid of tiles (N colors, L consecutive values, N∈{3,4}, L≥3)
decomposes validly both as N runs (rows) and as L groups (columns) —
same tiles, two structures. This is Latin-rectangle row/column duality
applied to Rummikub. Whoever designs the construction may use this,
extend it, combine multiple blocks, or use a different approach
entirely, provided the four invariants above hold and are verified
with real generated output.

`optimalMoves` should be computed directly from how the puzzle was
constructed (the builder knows how many tiles must move), not
recovered later via search.

### Verification harness (src/lib/verifyEngine.ts)
A standalone script, run via `npx tsx src/lib/verifyEngine.ts` (no
build step, no test framework dependency). Independently re-checks the
four invariants above against real generated puzzles, per difficulty,
and prints real pass/fail counts. This is not a one-time step — re-run
it after any change to solver.ts, generator.ts, or archetypes.ts, and
treat its printed terminal output (pasted in full, not summarized) as
the actual source of truth for whether the engine works. A session
that changes the generator and reports success without this file
being re-run and its raw output reviewed has not actually demonstrated
anything, per the Anti-illusion rule.

---

## Game state (src/hooks/usePlayState.ts) — unchanged, correct
```
loadPuzzle(p): grid=deepCopy(p.grid), rack=[...p.rack],
  initialState.current = deepCopy for reset()
drop(target): snapshot history, RACK→GRID / GRID→GRID / GRID→RACK,
  moves++, if rack.length===0: validateGrid → won or getInvalidCells
reset(): restore from initialState.current (NOT history[0])
undo(): pop history, won=false, clear invalidCells
```
Win condition: `rack.length === 0 && validateGrid(grid)` only.

---

## Drag system — CRITICAL RULES, NEVER VIOLATE
Pure mouse events. NO HTML5 drag API, NO draggable attribute,
NO setPointerCapture. onMouseEnter/Leave for drop-target detection
(not elementFromPoint). data-nodrag="" on every tile. main.tsx has
global capture-phase dragstart preventDefault + mousedown preventDefault
via [data-nodrag] closest-check.

---

## Theme system, Audio, Visual effects — unchanged, working
Five presets (minimalist/glass/wood/neon/paper) via src/lib/themes.ts +
TileFace.tsx. Web Audio synthesis in src/lib/audio.ts. Keyframes in
index.css. No changes needed to these systems.

---

## File responsibilities
```
src/lib/solver.ts       solveBag — bag-level partition oracle, see above
src/lib/validator.ts    DONE — do not modify without cause
src/lib/archetypes.ts   puzzle construction — open design, see above
src/lib/generator.ts    routes generatePuzzle(diff) to archetype builder(s)
src/lib/verifyEngine.ts standalone harness — re-run after any engine change
```

---

## Current status (update this after each session)
Solver, archetypes, generator and the harness are all built and green:
`npx tsx src/lib/verifyEngine.ts` prints 35/35 self-tests passing and
invariants (a)-(e) holding on 25 generated puzzles per difficulty.

**The move model — do not re-derive.** usePlayState's DROP reducer,
GRID→GRID branch, drops a grid tile onto an OCCUPIED cell by SWAPPING
the two, in a single move; Board.tsx fires onCellEnter on occupied
cells, so players can reach it. One move therefore relocates one tile
(empty target) or two (occupied target). Every cost/move-count claim in
src/lib/ depends on this.

`optimalMoves` = `planColorRunGoal()` in archetypes.ts. For a goal
layout (injective tile→cell), the misplaced board tiles form a
functional graph whose components are simple paths and simple cycles, so

    cost(goal) = boardTiles + rack − fixed(goal) − cycles(goal)

(a k-cycle unwinds in k−1 swaps; a k-path costs k). One O(tiles) cycle
decomposition per candidate layout, minimised over the 4! colour→row
permutations × row/column placement — ~1ms on an extreme puzzle.
Verified against real move-BFS on 265 instances (0 mismatches, incl.
3- and 4-cycles) and by simulating the real reducer on 5 puzzles per
difficulty (simulated count == optimalMoves, every run ends in a
validateGrid win).

Known scope limit: this is exact for the goal family the builder aims
at, i.e. it remains an *upper bound* on the true optimum over every
conceivable winning layout. Full-win BFS is infeasible at real tile
counts (11-28), so global optimality is not proven and must not be
claimed. Player-facing UI calls it "par", never "optimal".

**Two archetypes, both shipping, chosen ~50/50 per puzzle.**
- `groups-to-runs`: board = L horizontal groups (4 colours × one value
  per row); goal = 4 runs. Rack = boundary values s-1 / s+L.
- `runs-to-groups`: the mirror. Board = 3 horizontal runs (one colour
  per row, L consecutive values); goal = L groups. N is forced to 3
  because isValidGroup caps at 4, so the rack must be the whole 4th
  colour, at values *inside* the block and never 3 consecutive.

`planColorRunGoal` / `planValueGroupGoal` share one cost core
(`makeCostCtx`); each returns null on the other's tiles, which is what
makes invariant (e) a real check rather than a shape assumption.
`existsNoRelocationWin`, `formsValidSetAlone` and `obviousSpots` are
orientation-agnostic (they test run OR group) and are reused unchanged.

**RESOLVED (session after the above note):** `runs-to-groups` now has
its own `runsToGroupsParamsFor` table in archetypes.ts, separate from
`paramsFor` (which still governs `groups-to-runs` only). Par for this
direction is exactly `3L + rackSize - 6` (measured, not assumed) — a
deterministic function of (L, rackSize), still zero variance within a
difficulty, but now tuned to land in the same range as `groups-to-runs`:

| diff | L | rackSize | par | groups-to-runs avg (measured) |
|---|---|---|---|---|
| easy | 5 | 2 | 11 | 10.6 |
| medium | 6 | 4 | 16 | 13.4 |
| hard | 7 | 5 | 20 | 20.0 |
| extreme | 7 | 5 | 20 | 23.9 |

**REVERTED (later session):** extreme's L=8/par-24 was tried and
measured at ~5.3s per generation. On reflection that 10x generation-
time cost (vs ~500ms for every other tier) wasn't worth the calibration
gain, so extreme's `runsToGroupsParamsFor` entry was reverted to L=7 /
rackSize=5 — identical to hard's row, par 20. Re-measured after the
revert (`buildRunsToGroups('extreme')`, 10 runs): 359-502ms per call
(avg 467ms), par=20 on all 10 — confirms it's back in the same time
budget as hard rather than the ~5s L=8 outlier. Extreme's
runs-to-groups par (20) now sits below its groups-to-runs par (~24)
rather than matching it — accepted as the cost of staying fast; see
"PERFORMANCE WALL" below if this ever needs revisiting.

**PERFORMANCE WALL, measured directly** (`buildRunsToGroupsAt`, real
wall-clock): `planValueGroupGoal` enumerates `L!` value-permutations,
so cost is `O(L!)` — L=5 10.7ms, L=6 63.7ms, L=7 503ms, L=8 5335ms.
rackSize barely affects timing (only O(1) work per cost() call); L is
what must stay small. Every tier now stays at L<=7 (<1s/build) after
the extreme reversion above. If a higher extreme par is wanted again,
the fix is redesigning `planValueGroupGoal`'s search (currently
exhaustive over L!), not retuning the table back up to L=8 — L=7 is
close to the practical ceiling under the current algorithm.

Verified post-change: `verifyEngine.ts` invariants (a)-(e) all 25/25
for both archetypes at every difficulty; move-sequence simulation
exact-matches par on all 40 samples; grid dims stay modest (max 10×10
at extreme/runs-to-groups, well under any UI concern); 160 real
`generatePuzzle()` calls split ~47/53 between directions with real
par overlap at every tier (e.g. hard: groups-to-runs avg 20.6 vs
runs-to-groups avg 20.0; extreme: groups-to-runs ~24.2 vs
runs-to-groups 20.0, per the reversion above). `tsc --noEmit`: 0 errors.

**DECOYS — feasibility settled, see `DECOY_DESIGN.md`.** A session tried to
add a "decoy" tile (obvious-but-wrong placement, genuine hidden home) as a
MODIFIER reusing the pure planners. A probe over 40 real puzzles (every
candidate tile, both directions, hard+extreme) proved it impossible that way:
`groups-to-runs` is inherently decoy-proof (board is full groups → zero obvious
board placements to be tempted by); `runs-to-groups` DOES have real board-visible
decoys (boundary run-extensions in a board colour — 39 found at hard, 27 at
extreme) but their true home is a HYBRID run+group layout that
`planValueGroupGoal` cannot represent (`purePlacesD = 0`), so invariant (e) and
par can't be computed by the existing machinery. Root cause: the run/group
duality that makes the archetypes fair also makes them decoy-resistant. Shipping
decoys therefore needs a NEW mixed-goal planner + fresh par proof — its own
Opus/plan-mode design session, spec'd in `DECOY_DESIGN.md`. **Do NOT re-attempt
as a bolt-on modifier, and do NOT pursue decoys for `groups-to-runs`.**

**COUPLED BLOCKS — feasibility settled, see `COUPLED_DESIGN.md`.** A session
tried "two dual blocks at non-overlapping value ranges sharing exactly one
colour, coupled by row-tightness." A feasibility probe (run before any build)
found three walls: (1) COLOUR BUDGET — a dual block needs ≥3 colours (a 2-colour
block has no valid group form), and any two ≥3-colour subsets of the 4 game
colours overlap in ≥2 colours, so "exactly one shared colour" is provably
impossible without a 5th colour; (2) with ≥2 shared colours, a gap between
ranges makes the shared colour non-contiguous → `planColorRunGoal` returns null
(pure-planner wall, as with decoy); (3) every representable variant DECOMPOSES —
sharing a colour across disjoint value ranges shares a label, not a resource, so
the halves solve independently, and the row-tightness mechanism never bites for
a pure-goal shape (any colour→row bijection is feasible). Genuine coupling needs
a contested resource (overlapping ranges or tight cell geometry) + a generalized
planner — its own session, spec'd in `COUPLED_DESIGN.md`. **Do NOT re-attempt
the "shared colour across non-overlapping ranges" construction.**

**RED HERRING — feasibility settled, see `RED_HERRING_DESIGN.md`.** A session
tried a "red herring" modifier (two rack tiles both plausible for the same
visible opportunity, only one correct, wrong one blocks). Probed before building;
hits the SAME mixed-goal wall as decoy/coupled, two ways: (A) the only "one spot,
two plausible tiles" configs on a valid board are a run's two ends (24/21 found
per 10 runs-to-groups puzzles; ZERO on groups-to-runs' full-group board), and
none of those extender tiles has a pure-planner home (`pairTilesWithPureHome=0`)
— their true home is hybrid; (B) pure shape-ambiguous tiles (both a run- and
group-home) DO exist and are pure-homed (20/40), but committing the "wrong" shape
is an ALTERNATE VALID WIN, never a block (`BLOCKING-herring=0` across all rows) —
the run/group duality means both readings solve. Root cause: dead-end temptations
need hybrid-home boundary tiles; pure ambiguities never dead-end. THIRD
independent convergence on the same missing capability — a MIXED-goal planner.
Do decoy first (red herring is a strict superset). **Do NOT attempt as a bolt-on
or on `groups-to-runs`.**

**MIXED-GOAL PLANNER — built and verified STANDALONE (this session).** The
shared prerequisite all three briefs converge on now exists as
`src/lib/mixedGoalPlanner.ts` (harness: `src/lib/mixedGoalPlanner.verify.ts`,
run `npx tsx src/lib/mixedGoalPlanner.verify.ts`). It is deliberately NOT wired
into `archetypes.ts`, `generator.ts`, or any modifier yet — that is follow-up
work. What it is: a generalization of the proven cost model to HETEROGENEOUS
final layouts, where each destination window is independently a run
(`{type:'run',color,start,length}`) or a group (`{type:'group',value,colors[]}`),
in any mixture, rather than the whole board being one pure shape.

*What is PROVEN (real executed output, `16 passed / 0 failed`, `tsc` clean):*
- **The crux claim holds.** `cost = totalTiles − fixed − cycles` (the
  `makeCostCtx` graph argument) does NOT depend on windows sharing a type — it
  needs only one current cell + one target cell per tile. Confirmed empirically:
  a random sweep of **800 mixed instances, 482 cross-checked against an
  unrestricted move-BFS over the real reducer semantics (GRID→GRID swap /
  RACK→GRID displaced→rack, re-read from usePlayState.ts), 0 witness mismatches,
  0 BFS mismatches, 478 of them containing genuine cross-window cycles** (a cycle
  passing through a run window AND a group window). Plus 3 hand-crafted
  BFS-checked cross-window cycle/path cases, all analytic==witness==BFS.
- **The DECOY_DESIGN concrete example materialises**: board r/b/a runs 1..5 +
  rack {2k,4k,5k,6r} → hybrid goal (run {4,5,6}r + five groups), 19 tiles,
  `reachedGoal=true`, `validGoal=true` (a real `validateGrid` win), par=19 with a
  witness of exactly 19 real drops.
- **API**: `windowsPartitionBag()` (feasibility, delegates bag solvability to
  `solveBag`), `mixedLayoutMoves(grid, rack, goalMap)` → exact moves + fixed +
  cycles + concrete witness `Drop[]` + `reachedGoal`/`validGoal` flags
  (O(tiles), **0.05–0.10 ms/call at 19–35 tiles** — use this directly when the
  layout is known, e.g. decoy), and `planMixedGoal(...)` which SEARCHES window→row
  placements.
- **Known limit (measured, not guessed):** `planMixedGoal`'s placement search is
  factorial in window count `W` — same `L!` wall as `planValueGroupGoal`: W=3
  27ms, W=4 722ms, **W=5 23.6s** (W≥6 extrapolates to ~15-20 min, so the harness
  caps the timing sweep at W=5). Callers that already know their intended layout
  must build the goal map and call `mixedLayoutMoves` directly, bypassing the
  search — the O(tiles) core has no blow-up. A future decoy/coupled/red-herring
  session should construct the goal deterministically, NOT lean on
  `planMixedGoal` for large W.

*Tractability note:* the BFS sweep skips instances >11 cells (318 of 800) as a
guard — those are still witness-checked, just not BFS-checked; the O(tiles)
analytic==witness identity is what covers realistic sizes, BFS only anchors it on
small instances.

**DECOY ARCHETYPE — built, wired, and verified (this session, on top of the mixed
planner above).** `buildDecoy(diff)` / `buildDecoyAt(L)` in `archetypes.ts` (harness:
`src/lib/decoy.verify.ts`, run `npx tsx src/lib/decoy.verify.ts`). Wired into
`generator.ts` as an optional layer, hard/extreme ONLY, hidden `archetypeId:
'runs-to-groups-decoy'` (nothing player-facing reads it). Par flows through the
normal `optimalMoves` field.

*The construction (runs-to-groups only, per DECOY_DESIGN finding 1 — never
`groups-to-runs`):* board = 3 colour runs at values `s..s+L-1`. Rack = one **decoy**
`D={s+L, c}` in a board colour `c` (visibly extends `c`'s run — the tempting move),
two **supports** (4th colour at `s+L-2`, `s+L-1`), and interior **fillers** (4th
colour) chosen by `decoyFillerOffsets`. The decoy's genuine home is a HYBRID goal
built DETERMINISTICALLY — short run `{s+L-2,s+L-1,s+L}c` + one group per value —
scored by `mixedLayoutMoves` directly (NO `planMixedGoal` search). The filler
placement is the crux: it fragments the two non-`c` colours' leftover values so
that committing `D` to the run-extension leaves an unsolvable remainder.

*What is PROVEN (real executed output: `decoy.verify.ts` 23/0, `verifyEngine.ts`
44/0, `tsc` clean):*
- All original invariants (a)-(e) hold on **25/25 builds per difficulty**, PLUS the
  two new ones printed per puzzle: **TRAP** (`solveBag(allTiles \ run-extension)
  .solvable === false`, 25/25) and **OBVIOUS** (`obviousSpots(board, D) > 0`, 25/25).
  `existsNoRelocationWin` confirmed goal-shape-agnostic by reading it (dumps rack
  into frontier cells, calls `validateGrid`) — win=false & not exhausted on all.
- **Par proven by real move-sim, not narrated:** the witness simulated through a
  faithful DROP-reducer transcription lands a `validateGrid` win in exactly par on
  6/6 per difficulty. Par is deterministic `= 3L + rackSize` (fixed=0, cycles=0 for
  this stacked layout): L=5→19, L=6→22, L=7→25, L=8→29. L=5 reproduces the mixed
  planner's own proven par=19.
- **Construction is fast — no cliff:** 0.4 ms/build avg (deterministic; a handful of
  `solveBag`/`existsNoRelocationWin` calls, no candidate search).
- `verifyEngine.ts` invariants (a)-(d) still pass on every `generatePuzzle()` output
  INCLUDING the emitted decoys; both base directions still appear.

*Parameters settled:* `decoyParamsFor` — **hard L=6 (par 22, grid 7×9), extreme L=7
(par 25, grid 8×10)**. Decoy probability `DECOY_PROB` in `generator.ts` — hard 0.35,
extreme 0.60 (measured emission ~32% / ~65%; extreme visibly > hard, as intended).
Par sits just above base runs-to-groups (hard 20 / extreme 20) — decoys are a touch
harder, which is appropriate.

*Decoy layout note:* placed on fresh rows (fixed=0/cycles=0 → par = 3L+rackSize);
a future pass could overlap goal with board to trim par or add cycle-based variety
if calibration ever wants it — not needed now.

**RED HERRING ARCHETYPE — built, wired, and verified (this session, superset of
decoy).** `buildRedHerring(diff)` / `buildRedHerringAt(L)` in `archetypes.ts`
(harness: `src/lib/redherring.verify.ts`). Wired into `generator.ts`, hard/extreme
only, hidden `archetypeId: 'runs-to-groups-redherring'`; par flows through the
normal `optimalMoves`. **Decoy and red herring are MUTUALLY EXCLUSIVE per puzzle**
— one random roll picks at most one via disjoint probability bands; composing both
on a single puzzle is INTENTIONALLY DEFERRED to a dedicated later session.

*The construction (runs-to-groups only):* board = 3 colour runs at `s..s+L-1`. The
rack carries TWO tempting extenders of the SAME run colour `c` at OPPOSITE ends —
`Lo={s-1,c}` (extends the bottom) and `H={s+L,c}` (extends the top) — plus four
kColour supports at `s, s+1, s+L-2, s+L-1`. Both extenders score as obvious
run-extensions (OBVIOUS ×2). The genuine solution splits `c` into a LOW short run
`{s-1,s,s+1}` and a HIGH short run `{s+L-2,s+L-1,s+L}`, keeps `c`'s middle as
`{c,o1,o2}` groups, and turns the four vacated end-values into `{o1,o2,k}` groups.

*The interaction (why it's a red herring, not two glued decoys):* both extenders'
true homes come from the SAME hybrid reorganization, so committing EITHER obvious
append makes `c` one contiguous block again and ORPHANS the other extender —
provably unreachable. TRAP is scoped to this coupling and verified both directions
with real `solveBag`: `solveBag(allTiles \ {c at s..s+L})` and
`solveBag(allTiles \ {c at s-1..s+L-1})` are BOTH unsolvable, while the hybrid goal
wins via `mixedLayoutMoves`. `existsNoRelocationWin` re-confirmed goal-shape-agnostic
by reading it again (win=false, not exhausted on all builds).

*What is PROVEN (real output: `redherring.verify.ts` 25/0, `verifyEngine.ts` 44/0,
`tsc` clean):* on **25/25 builds per difficulty** — (a)-(e), **OBVIOUS ×2**
(lo=25, hi=25), **TRAP ×2** (commit-high dead=25, commit-low dead=25), **HOME ×2**
(both extenders have a real goal cell, 25/25). Witness simulated through the real
DROP reducer == par with a `validateGrid` win, 6/6 per difficulty. Deterministic
par `= 3L + rackSize` (rackSize=6): **hard L=5 → par 21, extreme L=6 → par 24**.

*The L≤6 cap (measured, decisive):* with L≥7 the `c`-middle is ≥3 values, so
"extend BOTH ends fully" leaves `o1/o2` middle RUNS and becomes an ALTERNATE WIN —
the trap leaks. Probed directly before building: L=5/6 `extendBoth-dead=true`,
**L=7 `extendBoth-dead=false`**. `buildRedHerringAt` rejects L∉{5,6}. This caps
extreme at L=6 (par 24), so red-herring puzzles are a touch smaller than decoy's
L=6/7 — accepted; the discrimination task, not raw size, is the point.

*Timing — deterministic, NOT sub-ms like decoy (0.4ms), and here's why:* ~1.8ms
(hard) / ~2.2ms (extreme) per build. No candidate search (fully deterministic goal),
but each build runs more oracle calls than decoy — TWO `solveBag` trap checks plus
the (b) solvability check plus `existsNoRelocationWin` over a LARGER rack (6 tiles)
on an `(L+2)×(L+3)` grid with more empty cells; that exhaustive no-relocation search
dominates. Still ~2ms, far under any budget, no blow-up.

*Emission:* `REDHERRING_PROB` hard 0.20 / extreme 0.30 (`DECOY_PROB` lowered to
0.30 / 0.45 so the bands stay disjoint). Measured ~22% / ~34% red herring; both
trap layers and both base directions still appear at every applicable tier.

**COMPOSED ARCHETYPE — built, wired, and verified (this session). The deferred
composition question above is now CLOSED.** `buildComposed(diff)` /
`buildComposedAt(L)` in `archetypes.ts` (harness: `src/lib/composed.verify.ts`).
Wired into `generator.ts` as its own band, hard/extreme only, hidden `archetypeId:
'runs-to-groups-composed'`. One board carries decoy's ONE-ended trap on colour `cD`
AND red herring's TWO-ended trap on a different colour `cH` — the player must
resolve both deceptions to win.

*The naive superposition is PROVABLY impossible — probed with real `solveBag`
BEFORE building, and this is why the composition needed a redesign rather than a
merge of the two racks:*
1. **TILE COLLISION.** decoy wants kColour supports at `{s+L-2, s+L-1}`; red
   herring wants `{s, s+1, s+L-2, s+L-1}`. The 4th colour has ONE tile per value,
   so they collide on exactly 2 tiles at **every** L (measured L=5..8).
2. **GROUP BUDGET — the unfixable one.** Both traps' high ends finish in a short
   run containing `s+L`, and any valid run containing `s+L` also contains `s+L-1`
   and `s+L-2`. So `cD` and `cH` both vacate those two values, leaving
   `{third board colour, kColour}` = 2 colours — below `isValidGroup`'s minimum of
   3 (`isValidGroup([9a,9k]) === false`, printed). **No value range or grid size
   repairs this**; it is forced by run contiguity, not by parameter choice.

*The fix — a RUN-ONLY high end.* Rather than fight for a group at `s+L-2/s+L-1`,
the layout gives up on having one: the third board colour `cC` ALSO runs across
the high end (`{s+L-3..s+L-1}`), so all three board colours are in runs there and
no group is needed; kColour simply carries no tile at those values. Rack = `D={s+L,cD}`,
`Lo={s-1,cH}`, `H={s+L,cH}`, plus kColour supports at `s`, `s+1` (vacated by `cH`'s
low run) and `s+L-3` (vacated by `cC`'s run) — 6 tiles, all distinct.

*Why it's a genuine chain, not two puzzles sharing a grid:* `cC`'s run exists ONLY
because `cD` and `cH` both vacate the high end — remove either trap's short run and
`cC`'s tiles there need a group that no longer has three colours. The two traps are
load-bearing for each other through one shared reorganization.

*What is PROVEN (real output: `composed.verify.ts` **32/0**, `verifyEngine.ts` 44/0,
`decoy.verify.ts` 23/0, `redherring.verify.ts` 25/0, `tsc` clean):* on **25/25 builds
per difficulty** — (a)-(e), **OBVIOUS ×3** (decoy=25, lo=25, hi=25), **TRAP ×4**
(decoy-append, herring-high, herring-low, herring-extend-both — all dead, 25 each),
**HOME ×3** (25 each). Witness through the real DROP reducer == par with a
`validateGrid` win, 6/6 per difficulty. Deterministic par `= 3L + 6`: **hard L=6 →
par 24 (24 tiles, 8×9), extreme L=7 → par 27 (27 tiles, 9×10)** — the deepest tier
the engine ships, above decoy (22/25) and red herring (21/24).

*The COMPOSITION-SPECIFIC check neither prior session could run — the reduction risk
was real to test and came back clean, 25/25 both tiers:* with ONE trap correctly
resolved (that colour's genuine short run(s) committed and removed from the bag), the
remainder stays solvable AND the OTHER trap's obvious move is STILL a `solveBag`
dead end — herring-high dead=25, herring-low dead=25 after resolving decoy;
decoy-append dead=25 after resolving the herring. Also verified: resolving one trap
alone is NOT a `validateGrid` win (25/25). So progress on one deception never defuses
the other. Plus explicit collision checks (rack distinct, tile set distinct, goal is an
exact duplicate-free cover, goal cells distinct) — 25/25 both tiers.

*The L≥6 cap (measured, two independent reasons):* at L=5 the three kColour supports
land on `s, s+1, s+2` — three consecutive, a valid run on their own, breaking
invariant (c) — AND `decoy-c1-append dead=false`, i.e. the trap doesn't bite yet.
`buildComposedAt` rejects L<6. L=8 verifies clean (par 30, 10×11) and is available if
a deeper tier is ever wanted.

*Timing:* ~3.5 ms/build both tiers (hard avg 3.48, extreme avg 3.63) — deterministic,
no search. Higher than red herring's ~2 ms because each build runs FOUR `solveBag`
trap checks plus (b) plus `existsNoRelocationWin` over a 6-tile rack on a larger grid.
Still far under budget, no cliff.

*Emission (three disjoint bands, at most one layer per puzzle):* `COMPOSED_PROB` hard
0.12 / extreme 0.25, `DECOY_PROB` 0.20 / 0.30, `REDHERRING_PROB` 0.14 / 0.22. Measured:
composed ~15% / ~24%, decoy ~22% / ~32%, red herring ~14% / ~23%, base archetypes still
emitted at both tiers. Note the earlier band values were retuned mid-session: a first
pass (decoy 0.26/0.32, herring 0.18/0.22) made `redherring.verify.ts`'s "extreme rate >
hard rate" assertion statistically marginal and it failed 2 checks on one run — real
flakiness from too narrow a gap, fixed by widening rather than by loosening the test.

*Still open:* COUPLED still needs a contested-resource redesign (see
COUPLED_DESIGN.md), not just the mixed planner.

## Prompt discipline
- One file per session for solver/generator/archetypes/validator work
- Always end with: Run tsc --noEmit AND real executed test output.
  Neither alone is sufficient (see Anti-illusion rule).
- Explore-first / open-reasoning mandatory for genuine design work in
  this ENGINE ARCHITECTURE section (see Model and effort selection)
- Never patch a bug twice without diagnosing root cause first
- If a session runs long, stop it — see SESSION HEALTH above
