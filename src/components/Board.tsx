import type { SetRow, DragSrc } from '../types'
import { isValidSet } from '../lib/validator'
import { SetBlock } from './SetBlock'

interface Props {
  sets: SetRow[]
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

export function Board({ sets, onDragStart, onDragEnd, onDrop }: Props) {
  return (
    <div className="board">
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
