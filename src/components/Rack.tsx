import { useState } from 'react'
import type { Tile, DragSrc } from '../types'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222222',
}

interface Props {
  tiles: Tile[]
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: () => void
}

function suppressGhost(e: React.DragEvent) {
  const ghost = document.createElement('div')
  ghost.style.cssText = 'position:absolute;top:-9999px'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 0, 0)
  setTimeout(() => document.body.removeChild(ghost), 0)
}

export function Rack({ tiles, onDragStart, onDragEnd, onDrop }: Props) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  return (
    <div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>rack</div>
      <div
        style={{
          background: '#f0ede8',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          minHeight: 70,
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onDrop() }}
      >
        {tiles.map((tile, i) => (
          <div
            key={i}
            draggable
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              color: NUM_COLOR[tile.c],
              cursor: draggingIdx === i ? 'grabbing' : 'grab',
              userSelect: 'none',
              boxSizing: 'border-box',
              opacity: draggingIdx === i ? 0.4 : 1,
              transform: draggingIdx === i ? 'scale(0.95)' : 'none',
            }}
            onDragStart={e => {
              suppressGhost(e)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(i))
              setDraggingIdx(i)
              onDragStart({ from: 'rack', rackIdx: i })
            }}
            onDragEnd={() => { setDraggingIdx(null); onDragEnd() }}
          >
            {tile.n}
          </div>
        ))}
      </div>
    </div>
  )
}
