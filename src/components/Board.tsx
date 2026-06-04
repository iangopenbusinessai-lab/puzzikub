import type { CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { isValidSet } from '../lib/validator'
import { SetBlock } from './SetBlock'

const STYLE: CSSProperties = {
  backgroundColor: '#d4d8d0',
  borderRadius: 10,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

interface Props {
  sets: SetRow[]
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

export function Board({ sets, onDragStart, onDragEnd, onDrop }: Props) {
  return (
    <div style={STYLE}>
      {sets.map((row, setIdx) => (
        <SetBlock
          key={setIdx}
          setIdx={setIdx}
          row={row}
          isValid={isValidSet(row)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
        />
      ))}
    </div>
  )
}
