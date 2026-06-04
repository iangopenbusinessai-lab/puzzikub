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
  return (
    <div className={`set-block${isValid ? ' set-block--valid' : ''}`}>
      <span className="set-block__label">Set {setIdx + 1}</span>
      <div className="set-block__tiles">
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
          )
        )}
      </div>
    </div>
  )
}
