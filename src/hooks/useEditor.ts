import { useState, useCallback } from 'react'
import type { Tile, TileSpec, Puzzle, Difficulty } from '../types'
import { usedIds, mintTile } from '../lib/editorRules'

function emptyGrid(rows: number, cols: number): (Tile | null)[][] {
  return Array.from({ length: rows }, () => new Array<Tile | null>(cols).fill(null))
}

// ---------------------------------------------------------------------------
// m=2 migration Step 8. The editor is the one place a user can conjure tiles
// from nothing, so it owns two responsibilities the picker cannot:
//
//  1. MINTING. `TilePicker` yields a `TileSpec` ({n, c}) — it has no idea how
//     many copies of that (value, colour) the puzzle already holds, so it cannot
//     choose a copy index. The hook does, scanning the current grid + rack.
//  2. THE CAP. A puzzle with more than TILE_COPIES of one tile is unsolvable by
//     construction, so it is refused at input rather than at play time.
//
// Both rules are pure and live in src/lib/editorRules.ts (game logic, zero
// React, directly testable); this hook only binds them to editor state.
//
// Every mutator returns a boolean: true if it happened, false if the cap
// refused it. Callers surface that; they must not assume success.
// ---------------------------------------------------------------------------

export function useEditor() {
  const [grid, setGrid] = useState<(Tile | null)[][]>(() => emptyGrid(4, 6))
  const [rack, setRack] = useState<Tile[]>([])
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<Difficulty>('easy')

  const setTileAt = useCallback((row: number, col: number, spec: TileSpec): boolean => {
    const tile = mintTile(spec, usedIds(grid, rack, { kind: 'grid', row, col }))
    if (!tile) return false
    setGrid(prev => prev.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? tile : c)) : r
    ))
    return true
  }, [grid, rack])

  const clearTileAt = useCallback((row: number, col: number) => {
    setGrid(prev => prev.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? null : c)) : r
    ))
  }, [])

  const addRackTile = useCallback((spec: TileSpec): boolean => {
    const tile = mintTile(spec, usedIds(grid, rack))
    if (!tile) return false
    setRack(prev => [...prev, tile])
    return true
  }, [grid, rack])

  const updateRackTile = useCallback((idx: number, spec: TileSpec): boolean => {
    const tile = mintTile(spec, usedIds(grid, rack, { kind: 'rack', idx }))
    if (!tile) return false
    setRack(prev => prev.map((t, i) => (i === idx ? tile : t)))
    return true
  }, [grid, rack])

  const removeRackTile = useCallback((idx: number) => {
    setRack(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const addRow = useCallback(() => {
    setGrid(prev => {
      const cols = prev[0]?.length ?? 6
      return [...prev, new Array<Tile | null>(cols).fill(null)]
    })
  }, [])

  const addCol = useCallback(() => {
    setGrid(prev => prev.map(r => [...r, null]))
  }, [])

  const removeRow = useCallback((rowIdx: number) => {
    setGrid(prev => prev.filter((_, i) => i !== rowIdx))
  }, [])

  const removeCol = useCallback((colIdx: number) => {
    setGrid(prev => prev.map(r => r.filter((_, i) => i !== colIdx)))
  }, [])

  const buildPuzzle = useCallback((): Puzzle | null => {
    const gridTiles = grid.flat().filter((t): t is Tile => t !== null)
    const allTiles = [...gridTiles, ...rack]
    if (!name.trim() || allTiles.length === 0) return null
    return {
      id: crypto.randomUUID(),
      name: name.trim(),
      diff,
      grid,
      rack,
      optimalMoves: rack.length,
      generated: false,
    }
  }, [grid, rack, name, diff])

  const reset = useCallback(() => {
    setGrid(emptyGrid(4, 6))
    setRack([])
    setName('')
    setDiff('easy')
  }, [])

  return {
    grid, rack, name, diff,
    setName, setDiff,
    setTileAt, clearTileAt,
    addRackTile, updateRackTile, removeRackTile,
    addRow, addCol, removeRow, removeCol,
    rowHasTiles: (rowIdx: number) => grid[rowIdx]?.some(t => t !== null) ?? false,
    colHasTiles: (colIdx: number) => grid.some(r => r[colIdx] !== null),
    buildPuzzle,
    reset,
  }
}
