# Puzzikub — CLAUDE.md
*Last updated: June 2026 — post-Fable engine audit. Keep this current after every major change.*

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
   burn 40k+ tokens — this has caused API errors and wasted work
   multiple times. Split into smaller single-file prompts instead.
   One fresh session per file change is the safe default for anything
   touching solver.ts, generator.ts, archetypes.ts, or validator.ts.

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

## ENGINE ARCHITECTURE (src/lib/) — post-audit ground truth

### The one rule that matters most
**A puzzle is only valid to ship if the "obvious" move fails.** Every
prior version of this generator regressed to fill-in-the-blank because
nothing ever checked whether the naive placement wins. That check —
`isTrivial()` — is now mandatory and gates every generated puzzle.
Nothing else in this section matters if that gate is skipped.

### Solver (src/lib/solver.ts) — van Rijn DP, mostly correct, two bugs
```ts
export interface SolveResult {
  solvable: boolean
  assignment?: Map<string, 'run' | 'group'>
}
export function solveBag(tiles: Tile[]): SolveResult
```
Algorithm is right: state = (value 1-13, run-length per color in
{0,1,2,3+}), DP over values, group enumeration (no group / C(present,3)
/ group-of-4), memoized. Matches van Rijn et al. arXiv:1604.07553.

KNOWN BUGS TO FIX:
1. `solveBag([])` currently returns `solvable: true` (empty bag passes
   trivially through the DP). Must return `false` — an empty tile
   universe is never a valid puzzle.
2. `assignment` is declared on `SolveResult` but never populated. Needs
   a second top-down pass recording which group choice was taken at
   each value along the winning path, building `Map<tileKey, 'run'|
   'group'>`. Required for `optimalMoves` computation and goal-layout
   construction — do not skip this.

Do NOT use solveBag as part of the live win condition. It checks bag
partitionability, not grid position. That conflation caused a prior bug
where placing tiles anywhere on the board counted as a win.

### Validator (src/lib/validator.ts) — DONE, do not modify without cause
```ts
export function isValidRun(tiles: Tile[]): boolean
export function isValidGroup(tiles: Tile[]): boolean
export function validateGrid(grid: Grid): boolean
export function getInvalidCells(grid: Grid): Set<string>
export function getNewlyValidCells(prevGrid: Grid, newGrid: Grid): Set<string>
```
OR-based coverage (not XOR), shared `buildGroups` scan, explicit
`hLen<3 && vLen<3` rejection. This file is correct as of the last audit.
Win condition: `rack.length === 0 && validateGrid(grid)` — no bag fallback.

### Generator (src/lib/generator.ts) — REWRITE REQUIRED
Current `generateExtraRack` (easy/medium/hard path) produces ONLY tiles
that extend a run endpoint or complete a group — i.e., tiles whose
obvious placement always works. This is fill-in-the-blank by
construction and must be deleted, not patched. `computeAmbiguity` and
`computeFalseAmbiguity` are unreliable proxies for difficulty — delete
both. Difficulty must be gated on verified construction parameters
(block width L, number of blocks, decoy presence), never on superficial
"could extend N sets" counts.

### Archetypes (src/lib/archetypes.ts) — REWRITE REQUIRED
`buildRunToGroup`, `buildDominoChain`, `buildFalseExtension` all
currently punch holes in complete runs (remove an interior tile,
leaving contiguous fragments of length 1-2 in that row). This produces
a STARTING BOARD THAT FAILS validateGrid — the player sees red-highlighted
invalid cells before making a single move. All three must be rewritten
or deleted per the plan below.

### THE CORRECT CONSTRUCTION — dual block + subset rack

Core insight (verified sound — matches Latin rectangle row/column
duality): an N×L grid of tiles (N colors, L consecutive values, N∈{3,4},
L≥3) decomposes validly BOTH as N runs (rows) AND as L groups (columns).
Same tiles, two structures.

Correct puzzle construction:
1. Board = ONE complete dual block laid out as N runs (typically N=3),
   ZERO gaps. `validateGrid(board)` must pass before rack is even
   generated.
2. Rack = a STRICT SUBSET of the 4th color's tiles at value positions
   inside the block's range (NOT the full L tiles of that color — a
   full run-worth is a free-standing valid set the player can place
   without touching the board, which is its own trivial failure mode
   seen directly in user screenshots). Subset size must be small enough
   that `formsValidSetAlone(rack)` is false.
3. These rack tiles are the wrong color for every board run (can't
   extend anything) and there are no groups yet on the board (can't
   complete anything) — their only possible home is inside a group the
   player creates by DISASSEMBLING the runs. This is what makes naive
   reinsertion structurally impossible, verified by Check B below, not
   assumed.
4. Gate every candidate through:
   - `validateGrid(board) === true`
   - `solveBag([...boardTiles, ...rack]).solvable === true`
   - `!isTrivial(board, rack)`
   Discard and retry (fresh random N, L, start value, color choice,
   subset) if any gate fails. Never hand-trust a construction — always
   verify with code.

### isTrivial() — the mandatory gate (does not exist yet, must be built)
```ts
function isTrivial(board: Grid, rack: Tile[]): boolean {
  // Check A: does rack, or any subset of it (size >= 3), form a valid
  // run or group on its own? If so the player just places it as a new
  // row/column and never touches the board. Reject.
  if (formsValidSetAlone(rack)) return true

  // Check B: does placing every rack tile at its "obvious" spot (run
  // endpoint extension or group completion) — with NO board tile
  // relocation — immediately produce a valid grid? If so this is
  // fill-in-the-blank. Reject.
  const naive = attemptNaiveReinsertion(board, rack)
  if (naive && validateGrid(naive)) return true

  return false
}
```
A puzzle only ships if reaching the win state requires moving at least
one tile that started on the board. This replaces all prior ambiguity
scoring.

### Archetype status
- Archetype 1 (dual-block collapse): the ONLY archetype currently
  worth keeping, and it needs the rewrite above (subset rack, not full
  column removal).
- Domino-chain, false-extension: DELETE current implementations (both
  produce invalid starting boards via interior-tile removal). May be
  reintroduced later as a solver-verified decoy LAYERED ON TOP of a
  working dual-block puzzle, not as standalone builders.

### Difficulty scaling (construction parameters, not scores)
- easy: N=3, L=3, rack subset size 1
- medium: N=3, L=4, rack subset size 1-2
- hard: N=3, L=5, rack subset size 2-3
- extreme: N=3, L=6 or two compound dual blocks, rack subset size 3+,
  optional verified decoy

### optimalMoves
Computed from construction (you built the disruption, you know the
count) — never from a post-hoc search.

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
src/lib/solver.ts       solveBag — fix empty-bag bug + assignment reconstruction
src/lib/validator.ts    DONE — do not modify
src/lib/archetypes.ts   REWRITE — dual-block + subset rack, delete other two
src/lib/generator.ts    REWRITE — delete generateExtraRack + ambiguity scoring,
                         add isTrivial gate, wire new archetype construction
                         for all difficulties (not just extreme)
```

---

## Rewrite session plan (in order — each independently testable)

1. solver.ts: fix empty-bag bug, implement assignment reconstruction
2. archetypes.ts: add isTrivial() + formsValidSetAlone() + 
   attemptNaiveReinsertion() as new exported helpers
3. archetypes.ts: rewrite buildRunToGroup with subset-rack construction,
   delete buildDominoChain and buildFalseExtension
4. generator.ts: delete generateExtraRack/computeAmbiguity/
   computeFalseAmbiguity, route ALL difficulties through
   generateArchetype (not just extreme), tune N/L/subset-size per
   difficulty
5. Verification: generate 20 puzzles per difficulty, assert
   validateGrid(board), solveBag(all).solvable, !isTrivial for every one
6. Manual playtest: 3 puzzles per difficulty, confirm board starts
   with zero gaps, rack can't stand alone, win requires moving a
   board tile

## Prompt discipline
- One file per session for solver/generator/archetypes/validator work
- Always end with: Run tsc --noEmit. Expect zero errors.
- Explore-first mandatory for anything in this ENGINE ARCHITECTURE section
- Never patch a bug twice without diagnosing root cause first
- If a session runs long, stop it — see SESSION HEALTH above
