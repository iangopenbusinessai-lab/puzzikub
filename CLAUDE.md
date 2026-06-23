# Puzzikub — CLAUDE.md
*Last updated: June 2026. Keep this file current after every major change.*

## Project overview
Rummikub-style clear-your-rack puzzle game on a free grid.
Stack: Vite + React + TypeScript, deployed to GitHub Pages.
Repo: https://github.com/iangopenbusinessai-lab/puzzikub.git

---

## CRITICAL: vite.config.ts
base must always be '/puzzikub/' — never change this, never remove it.
Do NOT revert to base: '/' under any circumstances.

---

## Testing & verification workflow
- Local dev: `npm run dev` → http://localhost:5173/puzzikub/
- Live site: https://iangopenbusinessai-lab.github.io/puzzikub/
  The person often tests the LIVE deployed site, not just localhost.
- Deploy: `npm run deploy` (builds + pushes dist/ to gh-pages branch)
  Changes are NOT live until this runs, even after `git push` to main.
- Person reports bugs via: browser screenshots, pasted browser console
  output, and pasted PowerShell terminal output (Windows).

## Debugging protocol — ALWAYS follow this order
1. Read the relevant files first. Never assume file contents.
2. If root cause is unclear, add temporary console.log statements,
   have the person paste the output, THEN write the fix.
3. Dynamic import() of .ts files does NOT work against the deployed
   GitHub Pages build — never suggest this for the live site.
4. ESCALATION RULE: if a bug survives one fix attempt, STOP patching.
   Diagnose first — read files, add logging, get real output, state
   root cause explicitly — THEN fix. This is mandatory.

---

## Architecture rules
- All game logic lives in src/lib/ — pure functions, zero React imports
- Components are presentational only; all state lives in hooks
- Drag uses native mouse events (mousedown/mousemove/mouseup on document)
  NO HTML5 drag API anywhere, NO draggable attribute, NO ondragstart
- localStorage key for puzzle library: 'puzzikub_library'
- All styling is inline style={{}} props — exception: index.css for
  keyframe animations and CSS custom properties (theme vars) only
- Never import React hooks inside src/lib/ files

---

## Core types (src/types.ts)
```ts
interface Tile { n: number; c: 'r' | 'b' | 'a' | 'k' }
type Grid = (Tile | null)[][]   // variable size per puzzle
type Difficulty = 'easy' | 'medium' | 'hard'
type Screen = 'play' | 'library' | 'editor'

interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  grid: Grid        // partially filled starting board state
  rack: Tile[]      // extra tiles player must incorporate
  optimalMoves: number
  generated: boolean
  // NO sets[] — removed. NO hint — removed.
}

interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number
  row?: number
  col?: number
}

// Theme system types
type BackgroundStyle = 'none' | 'glass-glow' | 'wood-grain' | 'neon-veil' | 'paper-grain'
type TileStyle = 'plain' | 'glass' | 'ceramic' | 'neon-outline' | 'paper'
type ThemePreset = 'minimalist' | 'glass' | 'wood' | 'neon' | 'paper'

// Exported constant — import from types.ts, never redefine elsewhere
export const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D', b: '#185FA5', a: '#BA7517', k: '#222222'
}
```

---

## Puzzle generation (src/lib/generator.ts)
Build solution first, then disrupt. Never build random tiles and hope.

### How it works
1. Build 2–6 valid sets (runs + groups) with collision checking
2. Lay sets onto grid row by row — grid sized to fit + 2 extra empty rows
3. Generate EXTRA tiles via legalExtensions():
   - Each extra tile must be a valid extension of an existing set
   - RUN: minN-1 or maxN+1 of same color
   - GROUP: missing color for same-number group
   - Hard mode: prefer ambiguous tiles that could extend 2+ sets
4. Verify solvability via solve() — reject and retry if unsolvable
5. Return Puzzle with fully-solved grid + extra tiles as rack

### Difficulty
| Diff   | numSets | numExtra |
|--------|---------|----------|
| easy   | 2       | 2–3      |
| medium | 3       | 3–5      |
| hard   | 4–6     | 5–8      |

Board starts FULLY SOLVED. Rack has EXTRA tiles only.
Player incorporates rack tiles into existing sets — not fills holes.

---

## Solver (src/lib/solver.ts)
```ts
export function solve(grid: Grid, rack: Tile[], maxDepthMs = 800): SolveResult
```
- Phase 1: backtrack placement-only
- Phase 2: backtrack with one board-to-board swap allowed
- Used by generator to gate every puzzle before returning
- KNOWN ISSUE: currently causing generatePuzzle() to return null
  every time → page stuck on "Generating puzzle..."
  Root cause unknown — needs console.log diagnostic in generator

---

## Validator (src/lib/validator.ts)
```ts
export function validateGrid(grid: Grid): boolean
export function getInvalidCells(grid: Grid): Set<string>
export function getNewlyValidCells(prevGrid: Grid, newGrid: Grid): Set<string>
export function isValidRun(tiles: Tile[]): boolean
export function isValidGroup(tiles: Tile[]): boolean
```
- Horizontal groups only matter for validity — vertical pairs (length 2)
  NEVER invalidate a tile that belongs to a valid horizontal group
- isValidRun: all same tile.c, consecutive tile.n, ≥3 tiles
- isValidGroup: all same tile.n, all different tile.c, 3–4 tiles
- Win = rack.length===0 AND validateGrid returns true

---

## Drag system
Pure mouse events. Zero HTML5 drag API.

- onMouseDown on tile → startDrag (useDrag.ts)
- document mousemove → updatePos (active only while drag !== null)
- document mouseup → reads hoverTarget → calls drop()
- onMouseEnter/onMouseLeave on each cell → sets hoverTarget
  (drop target detection — NOT elementFromPoint)
- DragPreview: position:fixed, pointerEvents:none, uses TileFace

### Critical rules — never violate
- NO setPointerCapture
- NO draggable attribute anywhere (not even draggable={false})
- NO ondragstart handlers
- data-nodrag="" on every tile div
- main.tsx must have both:
    document.addEventListener('dragstart', e => e.preventDefault(), true)
    document.addEventListener('mousedown', e => {
      if ((e.target as HTMLElement).closest('[data-nodrag]')) e.preventDefault()
    }, true)

---

## Game state (src/hooks/usePlayState.ts)
```
State: grid, rack, history, moves, undos, won, optimalMoves,
       invalidCells: Set<string>, lockInCells: Set<string>

loadPuzzle(p):
  grid = deepCopy(p.grid)
  rack = [...p.rack]
  initialState.current = deepCopy({grid, rack})  ← for reset()
  clear history/moves/undos/won/invalidCells

drop(target):
  snapshot to history first
  RACK→GRID: remove from rack, place; if occupied → displaced to rack
  GRID→GRID: swap cells
  GRID→RACK: null the cell, append to rack
  moves++
  if rack.length===0: validateGrid → won or getInvalidCells

reset(): restore from initialState.current (NOT history[0])
undo(): pop history, won=false, clear invalidCells
```

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
- Tile styles in src/components/TileFace.tsx
- DragPreview uses TileFace — preview must match active theme
- Settings: preset pills + independent background/tile dropdowns
- Theme state in App.tsx, persisted to localStorage

---

## Audio (src/lib/audio.ts)
Web Audio API synthesized sounds, single AudioContext singleton.
```ts
playPlace()      // soft snap, pitch-varied per placement
playLockIn()     // two-tone chime when set becomes valid
playError()      // low thud for invalid placement
playWinFanfare() // rising 5-note arpeggio on win
```

---

## Visual effects (keyframes in src/index.css)
- tile-land: scale bounce on placement
- tile-lockin: golden ring pulse when set locks in
- tile-invalid: shake animation + var(--invalid-bg/ring)
- win confetti: 20 CSS-animated divs in 4 tile colors
- win-text-in: scale+fade on win message
- cell-idle: subtle breathing opacity on empty cells

---

## Shared components
```
NavBar.tsx       — shared nav, all three screens
TileFace.tsx     — themed tile card (plain/glass/ceramic/neon/paper)
DragPreview.tsx  — floating tile following cursor, uses TileFace
SettingsPanel.tsx — slide-in panel (theme presets, bg/tile, light/dark, sound)
Tutorial.tsx     — first-visit overlay
TilePicker.tsx   — editor cell click → color wheel + drag-to-change-number
```

---

## File responsibilities
```
src/types.ts                   types + NUM_COLOR
src/lib/generator.ts           generatePuzzle(diff): Puzzle|null
src/lib/validator.ts           validateGrid, getInvalidCells, getNewlyValidCells
src/lib/solver.ts              solve(grid, rack, ms): SolveResult
src/lib/storage.ts             loadLibrary, saveLibrary
src/lib/audio.ts               playPlace, playLockIn, playError, playWinFanfare
src/lib/themes.ts              ThemePreset, BackgroundStyle, TileStyle, THEME_PRESETS
src/hooks/usePlayState.ts      game state, drop, undo, reset, loadPuzzle
src/hooks/useEditor.ts         editor state, buildPuzzle()
src/hooks/useDrag.ts           drag state, startDrag, updatePos, endDrag
src/components/NavBar.tsx      shared navigation
src/components/TileFace.tsx    themed tile rendering
src/components/Board.tsx       grid + mouse events + TileFace
src/components/Rack.tsx        rack + mouse events + TileFace
src/components/DragPreview.tsx floating drag preview
src/components/StatsBar.tsx    moves/undos/rack count
src/components/SettingsPanel.tsx settings panel
src/components/Tutorial.tsx    tutorial overlay
src/components/TilePicker.tsx  editor tile picker (color wheel)
src/screens/PlayScreen.tsx     play UI
src/screens/LibraryScreen.tsx  library list
src/screens/EditorScreen.tsx   grid-based editor
src/App.tsx                    router, theme/sound state, DarkVeil
src/main.tsx                   global drag prevention, React root
```

---

## Known active bugs (fix these first)
1. CRITICAL: generatePuzzle() returns null every attempt
   Page stuck on "Generating puzzle...". Solver gate rejecting all
   candidates. Add console.log in generator to diagnose — do not
   assume solver is correct, it is new code.
2. Lag on live site — solver may be running during drop() instead of
   only during generation. Verify solver is NOT called from usePlayState.
3. All tiles on rack — likely grid empty, all tiles in rack. Related to #1.
4. Mobile drag — mouse-only system, needs touchstart/touchmove/touchend.
   Run explore-first diagnostic before implementing.

---

## Prompt discipline
- Scope to max 2–3 files per prompt
- Always end with: Run tsc --noEmit. Expect zero errors.
- For validator/generator/solver/drag — always explore-first:
  "Read [files]. Report findings. Propose nothing yet."
  Then implement in a follow-up prompt.
- Never patch a bug twice without diagnosing root cause first
