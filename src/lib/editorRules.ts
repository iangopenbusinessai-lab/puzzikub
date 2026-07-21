// ---------------------------------------------------------------------------
// editorRules.ts — the pure rules behind manual tile entry (m=2 Step 8).
//
// Lives in src/lib/ rather than inside useEditor because it is game logic, not
// UI state: which copy index a newly placed tile gets, and when a placement must
// be refused outright. Zero React, so it is directly testable
// (storage.verify.ts) instead of only reachable through a rendered hook.
//
// THE CAP. A real Rummikub set contains TILE_COPIES of each (value, colour). A
// puzzle holding three 5-reds is unsolvable by construction — solveBagM2 rejects
// a bag with more than TILE_COPIES of any tile before it does any work — so the
// editor must refuse the third at input time rather than let the user build
// something that can never be played.
// ---------------------------------------------------------------------------

import type { Tile, TileSpec } from '../types'
import { makeTile, TILE_COPIES } from '../types'

/** Which slot (if any) is being overwritten, and so must not count against its
 * own replacement — re-picking the colour of an existing tile is not a new copy. */
export type EditorSlot =
  | { kind: 'grid'; row: number; col: number }
  | { kind: 'rack'; idx: number }

/** Every tile id currently live in the puzzle being edited, minus `skip`. */
export function usedIds(grid: (Tile | null)[][], rack: Tile[], skip?: EditorSlot): Set<string> {
  const out = new Set<string>()
  grid.forEach((r, ri) => r.forEach((t, ci) => {
    if (!t) return
    if (skip?.kind === 'grid' && skip.row === ri && skip.col === ci) return
    out.add(t.id)
  }))
  rack.forEach((t, i) => {
    if (skip?.kind === 'rack' && skip.idx === i) return
    out.add(t.id)
  })
  return out
}

/**
 * Mint `spec` at its lowest free copy index, or return **null** when all
 * TILE_COPIES are already in the puzzle. Null is the cap firing — callers must
 * treat it as a refusal and tell the user, never as "nothing happened".
 */
export function mintTile(spec: TileSpec, used: Set<string>): Tile | null {
  for (let copy = 0; copy < TILE_COPIES; copy++) {
    const t = makeTile(spec.n, spec.c, copy)
    if (!used.has(t.id)) return t
  }
  return null
}
