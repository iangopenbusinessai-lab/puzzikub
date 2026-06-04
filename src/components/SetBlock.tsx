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

export function SetBlock({ setIdx, row, isValid, onDragStart, onDragEnd, onDrop }: Props) {
  const wrapStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 7,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: isValid ? '#28a745' : 'transparent',
    backgroundColor: isValid ? 'rgba(40,167,69,0.08)' : 'transparent',
  }

  const labelStyle: CSSProperties = {
    fontSize: 11,
    color: '#666',
    minWidth: 36,
    fontFamily: 'sans-serif',
  }

  const tilesStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  }

  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>#{setIdx + 1}</span>
      <div style={tilesStyle}>
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
            <SlotEl
              key={tileIdx}
              onDrop={src => onDrop(src, setIdx, tileIdx)}
            />
          ),
        )}
      </div>
    </div>
  )
}
