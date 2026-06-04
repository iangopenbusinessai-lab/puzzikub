# Puzzikub — CLAUDE.md

## Project overview
Rummikub-style clear-your-rack puzzle game.
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

## Core types (never change these interfaces)
```ts
interface Tile { n: number; c: 'r' | 'b' | 'a' | 'k' }
type SetRow = (Tile | null)[]
interface Puzzle {
  id: string
  name: string
  diff: 'easy' | 'medium' | 'hard'
  sets: SetRow[]
  rack: Tile[]
  hint: string
  generated: boolean
}
interface DragSrc {
  from: 'rack' | 'board'
  rackIdx?: number
  setIdx?: number
  tileIdx?: number
}
```

## File responsibilities
- src/types.ts          — all shared interfaces and types
- src/lib/validator.ts  — isValidRun, isValidGroup, isValidSet, setComplete
- src/lib/generator.ts  — generatePuzzle(diff), uses validator
- src/lib/storage.ts    — loadLibrary, saveLibrary, seed puzzles
- src/hooks/usePlayState.ts  — boardState, rackState, history, drag, win logic
- src/hooks/useEditor.ts     — editorSets, editorRack, validation
- src/components/TileEl.tsx  — single draggable tile
- src/components/SlotEl.tsx  — empty drop target slot
- src/components/SetBlock.tsx — one set row (tiles + slots + label)
- src/components/Board.tsx   — all sets on the table
- src/components/Rack.tsx    — player rack, drop target
- src/components/StatsBar.tsx — moves, undos, rack left, sets valid
- src/screens/PlayScreen.tsx    — play UI, wires usePlayState
- src/screens/EditorScreen.tsx  — editor UI, wires useEditor
- src/screens/LibraryScreen.tsx — library list, filter pills
- src/App.tsx  — screen router only, no game logic

## Build and deploy
npm run dev      — local dev server
npm run build    — production build to dist/
npm run deploy   — builds then pushes dist/ to gh-pages branch

## When building large modules — use three sequential prompts
1. Data layer: types.ts + src/lib/ files
2. Components: src/components/ files
3. Screens + wiring: src/screens/ + App.tsx + main.tsx

## Known issues to avoid
- Always check vite.config.ts base after any config change
- If gh-pages deploy 404s, check base path matches repo name exactly: /puzzikub/
- Do not use position:fixed in any component (breaks page height)
- Drag state must be reset on dragend even if drop never fires
