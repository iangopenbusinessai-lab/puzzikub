import { useState } from 'react'
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

  const updatePos = (x: number, y: number) => {
    setDrag(d => d ? { ...d, x, y } : null)
  }

  const endDrag = () => {
    setDrag(null)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  return { drag, startDrag, updatePos, endDrag }
}
