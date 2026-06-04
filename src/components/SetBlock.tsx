import type { CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { TileEl } from './TileEl'
import { SlotEl } from './SlotEl'

interface Props {
  setIdx: number
  row: SetRow
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  minHeight: 58,
  marginBottom: 10,
}

export function SetBlock({ setIdx, row, onDragStart, onDragEnd, onDrop }: Props) {
  return (
    <div style={rowStyle}>
      {row.map((tile, tileIdx) =>
        tile ? (
          <TileEl
            key={tileIdx}
            tile={tile}
            src={{ from: 'board', setIdx, tileIdx }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ) : (
          <SlotEl key={tileIdx} onDrop={src => onDrop(src, setIdx, tileIdx)} />
        ),
      )}
    </div>
  )
}
