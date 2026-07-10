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

## Core types (src/types.ts)
```ts
interface Tile { n: number; c: 'r' | 'b' | 'a' | 'k' }
type Grid = (Tile | null)[][]
type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'
type Screen = 'play' | 'library' | 'editor'

interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  grid: Grid          // starting board — fully solved, NO gaps, ever
  rack: Tile[]         // extra tiles player must incorporate
  optimalMoves: number // computed from construction, not searched
  generated: boolean
  archetypeId?: string
}

interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number
  row?: number
  col?: number
}

export const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D', b: '#185FA5', a: '#BA7517', k: '#222222'
}
```

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

Known scope limit: this is exact for the "one colour's run per row"
goal family, i.e. it remains an *upper bound* on the true optimum over
every conceivable winning layout. Full-win BFS is infeasible at real
tile counts (14-28), so global optimality is not proven and should not
be claimed.

## Prompt discipline
- One file per session for solver/generator/archetypes/validator work
- Always end with: Run tsc --noEmit AND real executed test output.
  Neither alone is sufficient (see Anti-illusion rule).
- Explore-first / open-reasoning mandatory for genuine design work in
  this ENGINE ARCHITECTURE section (see Model and effort selection)
- Never patch a bug twice without diagnosing root cause first
- If a session runs long, stop it — see SESSION HEALTH above
