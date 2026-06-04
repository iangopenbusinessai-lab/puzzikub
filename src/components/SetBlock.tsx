import { useRef, type CSSProperties } from 'react'
import type { SetRow, DragSrc } from '../types'
import { TileEl } from './TileEl'

// 46px tile + 8px gap
const TILE_STEP = 54

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  minHeight: 58,
}

const emptySlotStyle: CSSProperties = {
  width: 46,
  height: 58,
  flexShrink: 0,
}

interface Props {
  setIdx: number
  row: SetRow
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc, setIdx: number, tileIdx: number) => void
}

export function SetBlock({ setIdx, row, onDragStart, onDragEnd, onDrop }: Props) {
  const rowRef = useRef<HTMLDivElement>(null)

  function nearestIdx(clientX: number): number {
    if (!rowRef.current) return 0
    const relX = clientX - rowRef.current.getBoundingClientRect().left
    return Math.max(0, Math.min(row.length - 1, Math.round(relX / TILE_STEP)))
  }

  return (
    <div
      ref={rowRef}
      style={rowStyle}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('application/json')
        if (!raw) return
        onDrop(JSON.parse(raw) as DragSrc, setIdx, nearestIdx(e.clientX))
      }}
    >
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
          <div key={tileIdx} style={emptySlotStyle} />
        ),
      )}
    </div>
  )
}
