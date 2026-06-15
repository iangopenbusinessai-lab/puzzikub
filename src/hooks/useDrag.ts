import { useState, useCallback } from 'react'
import type { Tile, DragSrc } from '../types'

export interface DragState {
  tile: Tile
  src: DragSrc
  x: number
  y: number
}

export function useDrag() {
  const [drag, setDrag] = useState<DragState | null>(null)

  const startDrag = (e: React.MouseEvent, tile: Tile, src: DragSrc) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ tile, src, x: e.clientX, y: e.clientY })
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  const moveDrag = useCallback((e: MouseEvent) => {
    setDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null)
  }, [])

  const endDrag = useCallback(() => {
    setDrag(null)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  return { drag, startDrag, moveDrag, endDrag }
}
