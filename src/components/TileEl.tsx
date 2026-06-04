import type { CSSProperties } from 'react'
import type { Tile, DragSrc } from '../types'

const PALETTE: Record<Tile['c'], { num: string; border: string }> = {
  r: { num: '#A32D2D', border: '#F09595' },
  b: { num: '#185FA5', border: '#85B7EB' },
  a: { num: '#BA7517', border: '#EF9F27' },
  k: { num: '#333333', border: '#cccccc' },
}

const SYMBOL: Record<Tile['c'], string> = {
  r: '♦', b: '♠', a: '♣', k: '♥',
}

const BASE: CSSProperties = {
  width: 46,
  height: 58,
  borderRadius: 7,
  borderWidth: 1.5,
  borderStyle: 'solid',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'grab',
  userSelect: 'none',
  background: '#fff',
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
  const { num, border } = PALETTE[tile.c]
  return (
    <div
      draggable
      style={{ ...BASE, borderColor: border }}
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(src))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(src)
      }}
      onDragEnd={onDragEnd}
    >
      <span style={{ fontSize: 19, fontWeight: 500, color: num, lineHeight: 1 }}>
        {tile.n}
      </span>
      <span style={{ fontSize: 9, opacity: 0.5, color: num, lineHeight: 1.4 }}>
        {SYMBOL[tile.c]}
      </span>
    </div>
  )
}
