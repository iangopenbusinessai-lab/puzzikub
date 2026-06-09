import { useState, useCallback } from 'react'
import type { Tile, DragSrc } from '../types'

export interface DragState {
  tile: Tile
  src: DragSrc
  x: number
  y: number
  startX: number
  startY: number
}

export function useDrag() {
  const [drag, setDrag] = useState<DragState | null>(null)

  const startDrag = useCallback((e: React.PointerEvent<HTMLElement>, tile: Tile, src: DragSrc) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ tile, src, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY })
    document.body.style.cursor = 'grabbing'
  }, [])

  const moveDrag = useCallback((e: React.PointerEvent) => {
    setDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null)
  }, [])

  const endDrag = useCallback(() => {
    setDrag(null)
    document.body.style.cursor = ''
  }, [])

  return { drag, startDrag, moveDrag, endDrag }
}
