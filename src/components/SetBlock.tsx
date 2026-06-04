import type { CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { TileEl } from './TileEl'
import { SlotEl } from './SlotEl'

interface Props {
  setIdx: number
  row: SetRow
  isValid: boolean
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

const wrapStyle: CSSProperties = { marginBottom: 12 }

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  minHeight: 58,
}

export function SetBlock({ setIdx, row, isValid, onDragStart, onDragEnd, onDrop }: Props) {
  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: isValid ? '#27823B' : '#999',
    marginBottom: 5,
  }
  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>Set {setIdx + 1}{isValid ? ' ✓' : ''}</span>
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
    </div>
  )
}
