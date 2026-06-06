import { useState, useCallback } from 'react'
import type { Tile, Puzzle } from '../types'

export function useEditor() {
  const [editorSets, setEditorSets] = useState<(Tile | null)[][]>([[null, null, null]])
  const [editorRack, setEditorRack] = useState<Tile[]>([])
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<Puzzle['diff']>('easy')
  const [hint, setHint] = useState('')

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
    setHint('')
  }, [])

  const isValid = name.trim().length > 0 && editorSets.length > 0

  const buildPuzzle = useCallback(
    (): Puzzle => ({
      id: crypto.randomUUID(),
      name: name.trim(),
      diff,
      rack: editorRack,
      hint: hint.trim() || 'Complete all sets.',
      generated: false,
    }),
    [editorRack, name, diff, hint],
  )

  return {
    editorSets,
    editorRack,
    name,
    diff,
    hint,
    setName,
    setDiff,
    setHint,
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
