import type { CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { isValidSet } from '../lib/validator'
import { SetBlock } from './SetBlock'

const style: CSSProperties = {
  background: '#f5f5f5',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  minHeight: 80,
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
          isValid={isValidSet(row)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
        />
      ))}
    </div>
  )
}
