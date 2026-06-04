import type { CSSProperties } from 'react'
import type { Tile, DragSrc } from '../types'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222222',
}

const BASE: CSSProperties = {
  width: 46,
  height: 58,
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'grab',
  userSelect: 'none',
  flexShrink: 0,
  boxSizing: 'border-box',
}

interface Props {
  tile: Tile
  src: DragSrc
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
}

export function TileEl({ tile, src, onDragStart, onDragEnd }: Props) {
  return (
    <div
      draggable
      style={{ ...BASE }}
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(src))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(src)
      }}
      onDragEnd={onDragEnd}
    >
      <span style={{ fontSize: 20, fontWeight: 500, color: NUM_COLOR[tile.c], lineHeight: 1 }}>
        {tile.n}
      </span>
    </div>
  )
}
