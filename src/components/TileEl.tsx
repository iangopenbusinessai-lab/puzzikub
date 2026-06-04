import type { CSSProperties } from 'react'
import type { Tile, DragSrc } from '../types'

const COLOR: Record<Tile['c'], { color: string; border: string; bg: string }> = {
  r: { color: '#c0001a', border: '#c0001a', bg: '#fff5f5' },
  b: { color: '#0033cc', border: '#0033cc', bg: '#f0f4ff' },
  a: { color: '#c05800', border: '#c05800', bg: '#fff8f0' },
  k: { color: '#ffffff', border: '#111111', bg: '#111111' },
}

const BASE: CSSProperties = {
  width: 46,
  height: 58,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 5,
  borderWidth: 2,
  borderStyle: 'solid',
  fontSize: 20,
  fontWeight: 700,
  fontFamily: 'sans-serif',
  cursor: 'grab',
  userSelect: 'none',
  flexShrink: 0,
}

interface Props {
  tile: Tile
  src: DragSrc
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
}

export function TileEl({ tile, src, onDragStart, onDragEnd }: Props) {
  const { color, border, bg } = COLOR[tile.c]
  return (
    <div
      draggable
      style={{ ...BASE, color, borderColor: border, backgroundColor: bg }}
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(src))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(src)
      }}
      onDragEnd={onDragEnd}
    >
      {tile.n}
    </div>
  )
}
