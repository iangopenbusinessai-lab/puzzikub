# Puzzikub — CLAUDE.md
*Last updated: June 2026. Keep this file current after every major change.*

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
  Person often tests the LIVE deployed site, not just localhost.
- Deploy: `npm run deploy` (builds + pushes dist/ to gh-pages branch)
  Changes are NOT live until this runs, even after `git push` to main.
- Person reports bugs via: browser screenshots, browser console output,
  PowerShell terminal output (Windows environment).

## Debugging protocol — MANDATORY
1. Read relevant files first. Never assume file contents.
2. Add temporary console.log, get real output, THEN fix.
3. Dynamic import() of .ts files does NOT work on deployed GitHub Pages.
4. ESCALATION RULE: if a bug survives one fix attempt, STOP patching.
   Diagnose first. State root cause explicitly. Then fix.
   (Drag bug took 8 patch attempts before this approach was applied.)

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
type Grid = (Tile | null)[][]   // variable size per puzzle
type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'
type Screen = 'play' | 'library' | 'editor'

interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  grid: Grid          // starting board — fully solved sets visible
  rack: Tile[]        // extra tiles player must incorporate
  optimalMoves: number
  generated: boolean
  archetypeId?: string  // which archetype template generated this
}

interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number
  row?: number
  col?: number
}

// Theme types
type BackgroundStyle = 'none'|'glass-glow'|'wood-grain'|'neon-veil'|'paper-grain'
type TileStyle = 'plain'|'glass'|'ceramic'|'neon-outline'|'paper'
type ThemePreset = 'minimalist'|'glass'|'wood'|'neon'|'paper'

// Exported constant — import from types.ts, never redefine elsewhere
export const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D', b: '#185FA5', a: '#BA7517', k: '#222222'
}
```

---

## ENGINE ARCHITECTURE (src/lib/)

### The core insight (from van Rijn et al. 2016)
The Rummikub puzzle with fixed k=4 suits, m=1 copy per tile is solvable
in O(n) time via dynamic programming — NOT brute-force backtracking.
The solver works on a TILE BAG (flat array), not grid positions.
Grid is purely a UI concern. Solvability is a bag property.

### Solver (src/lib/solver.ts) — VAN RIJN DP
```ts
export interface SolveResult {
  solvable: boolean
  // tile assignment when solvable:
  assignment?: Map<string, 'run' | 'group'>  // tileKey → assignment
}

export function solveBag(tiles: Tile[]): SolveResult
```

ALGORITHM — dynamic programming over values 1..13:
  State: (value: number, runLengths: [r,b,a,k] each in {0,1,2,3+})
    → 14 values × 4^4 = 3584 states max, all reachable states memoized

  At each value v, given tiles of that value in the bag:
    1. Enumerate all valid GROUP formations from tiles at this value:
       G(4,1) = 6 options: no group, C(4,3)=4 groups of 3, 1 group of 4
    2. For remaining tiles at this value (not in groups):
       Try all ways to continue/start runs for each color
       A run becomes valid (scores) when it reaches length 3
       Run state per color: 0=no run, 1=one tile, 2=two tiles, 3+=valid/extended
    3. Recurse to value v+1 with updated run states
    4. Memoize result for (value, runLengths) pair

  Base case: value > 13 — valid only if all run states are 0 or 3+
    (no incomplete runs of length 1 or 2 remaining)

  Returns solvable=true if max score equals sum of all tile values.

DO NOT use backtracking. DO NOT use elementFromPoint-style searches.
The DP state space is small and polynomial — use it.

### Generator (src/lib/generator.ts) — DUAL-SOLUTION ARCHITECTURE
```ts
export function generatePuzzle(diff: Difficulty): Puzzle | null
export function generateArchetype(type: ArchetypeType, diff: Difficulty): Puzzle | null
```

DUAL-SOLUTION APPROACH:
  1. Build tile bag T (the full tile universe for this puzzle)
  2. Find valid partition A of T → starting board (shown to player)
  3. Find valid partition B of T → solution board (hidden, but verified)
  4. rack = tiles whose set-assignment differs between A and B
  5. Verify: solveBag(allTiles) = true for both A and B independently
  6. Compute ambiguity score (see below)
  7. Gate on difficulty thresholds

AMBIGUITY SCORE — what makes puzzles feel hard:
  For each rack tile t: count distinct valid set assignments in context of board A
    assignment_count(t) = number of valid runs OR groups t could join
  total_ambiguity = sum of assignment_count across all rack tiles
  false_ambiguity = count of tiles where obvious placement → unsolvable
    (detected by: solveBag(bag with t placed "obviously") = false)
  difficulty_score = edit_distance(A, B) × (1 + false_ambiguity)

DIFFICULTY THRESHOLDS:
  easy:    edit_distance 1–2, ambiguity ≤ 2, false_ambiguity = 0
  medium:  edit_distance 3–5, ambiguity 3–6, false_ambiguity 0–1
  hard:    edit_distance 6–9, ambiguity 7–12, false_ambiguity 1–3
  extreme: edit_distance 10+, ambiguity 13+, false_ambiguity 3+,
           MUST use an archetype template (see below)

ARCHETYPE TEMPLATES (src/lib/archetypes.ts):
  type ArchetypeType = 'run-to-group' | 'domino-chain' | 'false-extension' | 'red-herring'

  TYPE 1 — run-to-group-collapse:
    A: N runs of same length L (e.g. 4 runs of length 4 = tiles 1–4 in each color)
    B: L groups of size N (e.g. groups of 1s, 2s, 3s, 4s)
    Same tiles, completely different structure. High ambiguity, non-obvious.
    Rack = tiles needed to complete the groups that were "locked" in runs.
    Example: board has 1b2b3b4b | 1r2r3r4r | 1a2a3a
             rack: 4a 1k 2k 3k 4k
             solution: groups {1b1r1a1k} {2b2r2a2k} {3b3r3a3k} {4b4r4a4k}

  TYPE 2 — domino-chain:
    A and B differ by a chain of interdependent tile moves.
    Each move in the chain is forced by the previous one.
    Chain length ≥ 3 for hard, ≥ 5 for extreme.

  TYPE 3 — false-extension:
    Rack tile looks like it extends run A (adjacent number, same color).
    Placing it in run A makes another rack tile unplaceable (verified by solver).
    Correct placement: tile goes into a group, requiring another tile to move.

  TYPE 4 — red-herring:
    Multiple rack tiles, each with an obvious-looking placement.
    All obvious placements conflict with each other.
    Player must find non-obvious ordering or non-obvious destination.

### Validator (src/lib/validator.ts)
```ts
export function validateGrid(grid: Grid): boolean
export function getInvalidCells(grid: Grid): Set<string>
export function getNewlyValidCells(prevGrid: Grid, newGrid: Grid): Set<string>
export function isValidRun(tiles: Tile[]): boolean    // same color, consecutive, ≥3
export function isValidGroup(tiles: Tile[]): boolean  // same number, diff colors, 3–4
```

CRITICAL RULE: vertical pairs (length 2) NEVER invalidate a tile that
belongs to a valid horizontal group. Tiles in different rows sharing a
column are independent — only horizontal groups count for win condition
unless player deliberately stacks 3+ tiles vertically.

Win = rack.length === 0 AND validateGrid(grid) = true

---

## Game state (src/hooks/usePlayState.ts)
```
State: grid, rack, history, moves, undos, won, optimalMoves,
       invalidCells: Set<string>, lockInCells: Set<string>

loadPuzzle(p: Puzzle):
  grid = deepCopy(p.grid)
  rack = [...p.rack]
  initialState.current = deepCopy({grid, rack})  ← used by reset()
  clear history/moves/undos/won/invalidCells

drop(target):
  snapshot to history before every mutation
  RACK→GRID: remove from rack, place; if occupied → displaced to rack
  GRID→GRID: swap cells
  GRID→RACK: null the cell, append to rack
  moves++
  if rack.length===0: validateGrid → won or getInvalidCells

reset(): restore from initialState.current (NOT history[0])
undo(): pop history, won=false, clear invalidCells
```

---

## Drag system — CRITICAL RULES, NEVER VIOLATE
Pure mouse events. Zero HTML5 drag API.

- onMouseDown on tile → startDrag (useDrag.ts)
- document mousemove → updatePos (only while drag !== null)
- document mouseup → reads hoverTarget → calls drop()
- onMouseEnter/Leave on cells → sets hoverTarget (NOT elementFromPoint)
- DragPreview: position:fixed, pointerEvents:none, uses TileFace

NEVER:
- NO setPointerCapture
- NO draggable attribute (not even draggable={false})
- NO ondragstart handlers
- data-nodrag="" on every tile div

main.tsx MUST have both:
  document.addEventListener('dragstart', e => e.preventDefault(), true)
  document.addEventListener('mousedown', e => {
    if ((e.target as HTMLElement).closest('[data-nodrag]')) e.preventDefault()
  }, true)

---

## Theme system (src/lib/themes.ts)
| Preset     | Background  | Tile          |
|------------|-------------|---------------|
| minimalist | none        | plain         |
| glass      | glass-glow  | glass         |
| wood       | wood-grain  | ceramic       |
| neon       | neon-veil   | neon-outline  |
| paper      | paper-grain | paper         |

- neon-veil = existing DarkVeil animated canvas
- TileFace.tsx renders all 5 tile styles
- DragPreview uses TileFace — must match active theme
- User can mix background and tile style independently

---

## Audio (src/lib/audio.ts)
Web Audio API, single AudioContext singleton.
  playPlace()      — soft snap, pitch-varied
  playLockIn()     — two-tone chime when set becomes valid
  playError()      — low thud for invalid placement
  playWinFanfare() — rising 5-note arpeggio

---

## File responsibilities
```
src/types.ts                  types + NUM_COLOR
src/lib/solver.ts             solveBag(tiles): SolveResult  ← VAN RIJN DP
src/lib/archetypes.ts         archetype templates + generators
src/lib/generator.ts          generatePuzzle, generateArchetype
src/lib/validator.ts          validateGrid, getInvalidCells, getNewlyValidCells
src/lib/storage.ts            loadLibrary, saveLibrary
src/lib/audio.ts              playPlace, playLockIn, playError, playWinFanfare
src/lib/themes.ts             ThemePreset, THEME_PRESETS, labels
src/hooks/usePlayState.ts     game state, drop, undo, reset, loadPuzzle
src/hooks/useEditor.ts        editor state, buildPuzzle()
src/hooks/useDrag.ts          drag state, startDrag, updatePos, endDrag
src/components/NavBar.tsx     shared navigation (all 3 screens)
src/components/TileFace.tsx   themed tile card rendering
src/components/Board.tsx      grid + mouse events + TileFace
src/components/Rack.tsx       rack + mouse events + TileFace
src/components/DragPreview.tsx floating drag preview using TileFace
src/components/StatsBar.tsx   moves/undos/rack count
src/components/SettingsPanel.tsx settings (theme, light/dark, sound)
src/components/Tutorial.tsx   first-visit overlay
src/components/TilePicker.tsx editor tile picker (color wheel)
src/screens/PlayScreen.tsx    play UI
src/screens/LibraryScreen.tsx library list
src/screens/EditorScreen.tsx  grid-based editor
src/App.tsx                   router, theme/sound state, DarkVeil
src/main.tsx                  global drag prevention, React root
```

---

## Known active bugs (fix before new features)
1. CRITICAL: generatePuzzle() returns null every attempt
   Page stuck on "Generating puzzle...". Solver gate rejecting all
   candidates. Root cause: current solver.ts is backtracking and likely
   has a bug OR is timing out. NEW SOLVER (van Rijn DP) replaces it.
2. Lag on live site — old backtracking solver may be running during drop().
   New DP solver is O(n) and runs instantly. This fixes lag too.
3. All tiles on rack — grid empty. Related to bug #1.
4. Mobile drag — mouse-only. Needs touchstart/touchmove/touchend parallel.

---

## Session plan for engine upgrade (DO THIS IN ORDER)

### Session 1 — New solver (PLAN MODE)
Files: src/lib/solver.ts only
Task: Rewrite using van Rijn DP. solveBag(tiles: Tile[]): SolveResult
State: Map<string, number> keyed by `${value}|${r}|${b}|${a}|${k}`
  where r/b/a/k are run lengths in {0,1,2,3} (3 means 3+)
Verify: solveBag([T(3,'r'),T(4,'r'),T(5,'r')]) = {solvable:true}
        solveBag([T(3,'r'),T(4,'r')]) = {solvable:false}
        solveBag([T(5,'r'),T(5,'b'),T(5,'k')]) = {solvable:true}
        solveBag([T(5,'r'),T(5,'b')]) = {solvable:false}

### Session 2 — Archetype engine (PLAN MODE)
Files: src/lib/archetypes.ts (new), src/lib/generator.ts (rewrite)
Task: Implement dual-solution architecture + Type 1 run-to-group archetype
Depends on: Session 1 solver passing all 4 verification tests

### Session 3 — Wire + fix stuck loading (AUTO MODE)
Files: PlayScreen.tsx, usePlayState.ts, generator.ts call sites
Task: Replace all calls to old solve(grid,rack) with solveBag(tiles)
      Fix stuck "Generating puzzle..." by using new generator
      Remove solver call from drop() — solver only runs in generator

---

## Prompt discipline
- Max 2–3 files per prompt
- Always end with: Run tsc --noEmit. Expect zero errors.
- For solver/generator/validator/drag: explore-first mandatory
- Never patch a bug twice without diagnosing root cause first
- Plan mode: solver, generator, archetypes (mathematical precision needed)
- Auto mode: UI wiring, styling, prop threading, storage
- Normal mode: everything else
