# Puzzikub — CLAUDE.md

## Project overview
Rummikub-style clear-your-rack puzzle game on a free grid.
Stack: Vite + React + TypeScript, deployed to GitHub Pages.
Repo: https://github.com/iangopenbusinessai-lab/puzzikub.git

## CRITICAL: vite.config.ts
base must always be '/puzzikub/' — never change this, never remove it.
Do NOT revert to base: '/' under any circumstances.

## Architecture rules
- All game logic lives in src/lib/ — pure functions, zero React imports
- Components are presentational only; all state lives in hooks
- Drag and drop uses native HTML5 drag API — no external DnD libraries
- localStorage key for puzzle library: 'puzzikub_library'
- Never import React hooks inside src/lib/ files
- All styling is inline style={{}} props — no CSS files, no classNames, no Tailwind

## Core types (never change these interfaces)
```ts
interface Tile { n: number; c: 'r' | 'b' | 'a' | 'k' }
type Grid = (Tile | null)[][]          // 6 rows × 10 cols, all null on init
type Difficulty = 'easy' | 'medium' | 'hard'

interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  rack: Tile[]       // ALL tiles — player places everything
  hint: string
  generated: boolean
  // NOTE: no sets[] — solution is not stored, only the rack
}

interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number   // when from === 'rack'
  row?: number       // when from === 'grid'
  col?: number       // when from === 'grid'
}
```

## Tile colors (never change)
| tile.c | number color | border color |
|--------|-------------|--------------|
| r      | #A32D2D     | #F09595      |
| b      | #185FA5     | #85B7EB      |
| a      | #BA7517     | #EF9F27      |
| k      | #222222     | #cccccc      |

Tile card: 46×58px, borderRadius 8, bg white, boxShadow "0 1px 3px rgba(0,0,0,0.12)", number 20px/500 centered. No suit symbol.

## Generator (src/lib/generator.ts)
Build solution first — never give impossible puzzles.

1. Decide numSets: easy=2, medium=2–3, hard=3–4
2. For each set, build either a valid RUN or GROUP:
   - RUN: pick color c, pick start so start+len-1 ≤ 13, tiles = [{n:start,c}…{n:start+len-1,c}]
     len: easy=3, medium=3–4, hard=3–5
   - GROUP: pick number n, pick 3–4 distinct colors, tiles = [{n,c}…]
3. Collision check: no two tiles share (n,c). Retry set up to 20× on collision.
4. rack = shuffle of ALL tiles from ALL sets
5. Return Puzzle with empty grid — solution is implicit, not stored

## Game state (src/hooks/usePlayState.ts)
State: grid:Grid, rack:Tile[], history:{grid,rack}[], moves, undos, won, dragSrc

loadPuzzle(p): grid=6×10 nulls, rack=[...p.rack], reset history/moves/undos/won

drop(target: {to:'grid',row,col} | {to:'rack'}):
  - Snapshot {grid,rack} to history before every mutation
  - RACK→GRID: remove rack[rackIdx], place at grid[row][col]
      if occupied: displaced tile returns to rack
  - GRID→GRID: swap grid[src.row][src.col] ↔ grid[row][col]
  - GRID→RACK: grid[src.row][src.col]=null, append tile to rack
  - moves++

undo: pop history, restore grid+rack, won=false

## Validator (src/lib/validator.ts)
validateGrid(grid): boolean — called only on Check button press

1. Collect all {tile,row,col} from grid
2. Find horizontal groups: per row, maximal contiguous tile sequences (no null gaps)
3. Find vertical groups: per col, maximal contiguous tile sequences
4. Every tile must belong to exactly ONE group (H or V — not both)
5. Every group must be length ≥ 3
6. Every group must pass isValidRun OR isValidGroup:
   - isValidRun: all same tile.c, tile.n values consecutive when sorted, length ≥ 3
   - isValidGroup: all same tile.n, all different tile.c, length 3 or 4
7. Return true only if ALL tiles covered, no overlaps, no isolated tiles

Win = rack.length===0 AND validateGrid returns true

## Board UI (src/components/Board.tsx)
CSS grid: gridTemplateColumns repeat(10,46px), gridTemplateRows repeat(6,58px), gap 6px
bg #f0ede8, borderRadius 16, padding 16, display inline-grid

Empty cell: 46×58 transparent, no border — drop target via ondragover+ondrop
Tile cell: white card (see tile colors above), draggable
Drag-over empty cell: bg #e8e4de

## Rack UI (src/components/Rack.tsx)
Label "rack" 11px #999 above tile area
Tile area: bg #f0ede8, borderRadius 12, padding 12, flex row, gap 8, flexWrap, minHeight 70
Whole area is drop target for returning grid tiles

## Play screen (src/screens/PlayScreen.tsx)
- Default screen on load — generate easy puzzle on mount
- Nav: 44px fixed-height bar, Play|Editor|Library, plain text buttons
  active: color #222 fontWeight 500 — inactive: color #999 — no borders/boxes
- Difficulty pills: Easy|Medium|Hard below nav
- Stats row: "moves: N  rack: N" 12px #999
- Board centered, Rack below board
- Buttons: Undo · Reset · New · Check — transparent, 13px, color #555, hover #222
- Check result (small text below buttons):
    rack not empty → "place all tiles first" #999
    invalid → "not quite" #A32D2D
    valid → "cleared ✓" #27500A, set won=true
- No hint button, no set labels, no valid/invalid badges on board

## File responsibilities
- src/types.ts                   — Tile, Grid, Difficulty, Puzzle, DragSrc, Screen
- src/lib/generator.ts           — generatePuzzle(diff): Puzzle|null
- src/lib/validator.ts           — validateGrid, isValidRun, isValidGroup
- src/lib/storage.ts             — loadLibrary, saveLibrary (localStorage)
- src/hooks/usePlayState.ts      — grid, rack, drag, drop, undo, reset, loadPuzzle
- src/hooks/useEditor.ts         — editor form state, buildPuzzle()
- src/components/Board.tsx       — 6×10 grid render + drag/drop
- src/components/Rack.tsx        — rack render + drop target
- src/components/StatsBar.tsx    — moves, undos, rack count display
- src/screens/PlayScreen.tsx     — play UI, wires usePlayState
- src/screens/EditorScreen.tsx   — manual puzzle builder
- src/screens/LibraryScreen.tsx  — saved puzzles list
- src/App.tsx                    — screen router only, no game logic

## Build and deploy
npm run dev      — local dev server at localhost:5173/puzzikub/
npm run build    — tsc + vite build → dist/
npm run deploy   — predeploy runs build, then gh-pages -d dist

## Prompt strategy for large changes
Break into three sequential prompts, confirm zero TS errors between each:
1. types.ts + src/lib/ (data layer — no React)
2. src/components/ (presentational, inline styles only)
3. src/screens/ + App.tsx (wiring)

## Known issues to avoid
- vite.config.ts base: '/puzzikub/' — check after every config touch
- Never use SetRow[] or sets[] in Puzzle — architecture moved to rack-only
- Never use from:'board' in DragSrc — only 'rack' | 'grid'
- Drag state must reset on dragend even if drop never fires
- No position:fixed anywhere (breaks iframe height)
- Do not auto-check win on every drop — only on Check button press
