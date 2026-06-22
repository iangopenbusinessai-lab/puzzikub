import { useState, useCallback } from 'react'
import type { Tile, Puzzle, Difficulty } from '../types'

function emptyGrid(rows: number, cols: number): (Tile | null)[][] {
  return Array.from({ length: rows }, () => new Array<Tile | null>(cols).fill(null))
}

export function useEditor() {
  const [grid, setGrid] = useState<(Tile | null)[][]>(() => emptyGrid(4, 6))
  const [rack, setRack] = useState<Tile[]>([])
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<Difficulty>('easy')

  const setTileAt = useCallback((row: number, col: number, tile: Tile) => {
    setGrid(prev => prev.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? tile : c)) : r
    ))
  }, [])

  const clearTileAt = useCallback((row: number, col: number) => {
    setGrid(prev => prev.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? null : c)) : r
    ))
  }, [])

  const addRackTile = useCallback((tile: Tile) => {
    setRack(prev => [...prev, tile])
  }, [])

  const updateRackTile = useCallback((idx: number, tile: Tile) => {
    setRack(prev => prev.map((t, i) => (i === idx ? tile : t)))
  }, [])

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
      rack: allTiles,
      hint: '',
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
