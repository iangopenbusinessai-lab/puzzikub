export interface Tile {
  n: number
  c: 'r' | 'b' | 'a' | 'k'
  /**
   * Stable identity. `{n, c}` alone cannot tell the two m=2 copies of a
   * (value, colour) pair apart; `id` can. Structured as `${n}_${c}_${copyIndex}`
   * — minted by `makeTile` below.
   */
  id: string
}

/**
 * Copies of each (value, colour) tile in the m=2 universe. Named here so the
 * copy count lives in exactly one place rather than as scattered literal 2s.
 */
export const TILE_COPIES = 2

/**
 * Mint a Tile with a STRUCTURED, stable id `${n}_${c}_${copy}` (copy defaults to
 * 0 — the only copy an m=1-shaped puzzle ever needs).
 *
 * Structured, not opaque (uuid/counter), per MIGRATION_M2.md Step 1: the id
 * stays readable in verify-harness output (`5_r_0`) and is a PURE function of
 * (n, c, copy), so it survives a JSON round-trip with no remap table and lets
 * Step 8's legacy-save migration re-mint ids deterministically from
 * (n, c, occurrenceIndex).
 *
 * A pure structured id necessarily takes the copy index as input; the doc's
 * `makeTile(n, c)` form would otherwise need a hidden global counter to
 * disambiguate copies — opaque-by-another-name, and it would break per-puzzle
 * scoping. So `copy` is an explicit argument defaulting to 0, leaving
 * `makeTile(n, c)` callable exactly as written.
 */
export function makeTile(n: number, c: Tile['c'], copy = 0): Tile {
  return { n, c, id: `${n}_${c}_${copy}` }
}

/**
 * A tile the user has *described* but which has no identity yet — what the tile
 * picker produces. Only `useEditor` can turn one into a `Tile`, because the copy
 * index depends on how many copies of that (value, colour) the puzzle being
 * edited already holds. Keeping the two types distinct is what stops a UI
 * component from minting a duplicate id it has no way to scope correctly.
 */
export type TileSpec = Pick<Tile, 'n' | 'c'>

export const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222',
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'

// Grid dimensions vary per puzzle (not always 6×10)
export type Grid = (Tile | null)[][]

export interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  grid: Grid
  rack: Tile[]
  optimalMoves: number
  generated: boolean
  archetypeId?: string
}

export interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number  // when from === 'rack'
  row?: number      // when from === 'grid'
  col?: number      // when from === 'grid'
}

export type Screen = 'play' | 'editor' | 'library'
