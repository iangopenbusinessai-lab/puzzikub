import { useState, useCallback } from 'react'
import type { Tile, Grid, Puzzle } from '../types'

export function useEditor() {
  const [editorSets, setEditorSets] = useState<(Tile | null)[][]>([[null, null, null]])
  const [editorRack, setEditorRack] = useState<Tile[]>([])
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<Puzzle['diff']>('easy')
  const addSet = useCallback(() => {
    setEditorSets(prev => [...prev, [null, null, null]])
  }, [])

  const removeSet = useCallback((setIdx: number) => {
    setEditorSets(prev => prev.filter((_, i) => i !== setIdx))
  }, [])

  const addSlot = useCallback((setIdx: number) => {
    setEditorSets(prev => prev.map((row, i) => (i === setIdx ? [...row, null] : row)))
  }, [])

  const removeSlot = useCallback((setIdx: number) => {
    setEditorSets(prev =>
      prev.map((row, i) => (i === setIdx && row.length > 3 ? row.slice(0, -1) : row)),
    )
  }, [])

  const addTileToRack = useCallback((tile: Tile) => {
    setEditorRack(prev => [...prev, tile])
  }, [])

  const removeTileFromRack = useCallback((idx: number) => {
    setEditorRack(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const reset = useCallback(() => {
    setEditorSets([[null, null, null]])
    setEditorRack([])
    setName('')
    setDiff('easy')
  }, [])

  const isValid = name.trim().length > 0 && editorSets.length > 0

  const buildPuzzle = useCallback((): Puzzle => {
    const sets = editorSets
    const maxLen = Math.max(...sets.map(s => s.length), 3)
    const cols = maxLen + 2
    const rows = sets.length + 1
    const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))
    for (let i = 0; i < sets.length; i++) {
      for (let j = 0; j < sets[i].length; j++) {
        grid[i][j + 1] = sets[i][j]
      }
    }
    return {
      id: crypto.randomUUID(),
      name: name.trim(),
      diff,
      grid,
      rack: editorRack,
      optimalMoves: editorRack.length,
      generated: false,
    }
  }, [editorSets, editorRack, name, diff])

  return {
    editorSets,
    editorRack,
    name,
    diff,
    setName,
    setDiff,
    addSet,
    removeSet,
    addSlot,
    removeSlot,
    addTileToRack,
    removeTileFromRack,
    isValid,
    buildPuzzle,
    reset,
  }
}
