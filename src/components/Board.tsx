import type { CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { SetBlock } from './SetBlock'

const style: CSSProperties = {
  background: '#f0ede8',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  minHeight: 80,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
  boxSizing: 'border-box',
}

interface Props {
  sets: SetRow[]
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

export function Board({ sets, onDragStart, onDragEnd, onDrop }: Props) {
  return (
    <div style={style}>
      {sets.map((row, setIdx) => (
        <SetBlock
          key={setIdx}
          setIdx={setIdx}
          row={row}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
        />
      ))}
    </div>
  )
}
