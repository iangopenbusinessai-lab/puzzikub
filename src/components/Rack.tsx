import type { Tile, DragSrc } from '../types'
import { NUM_COLOR } from '../types'
import type { DragState } from '../hooks/useDrag'

interface Props {
  tiles: Tile[]
  drag: DragState | null
  onMouseDown: (e: React.MouseEvent, tile: Tile, src: DragSrc) => void
  onRackEnter: () => void
  onRackLeave: () => void
}

export function Rack({ tiles, drag, onMouseDown, onRackEnter, onRackLeave }: Props) {
  const draggingRackIdx = drag?.src.from === 'rack' ? drag.src.rackIdx : undefined

  return (
    <div onDragStart={e => e.preventDefault()}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>rack</div>
      <div
        onMouseEnter={onRackEnter}
        onMouseLeave={onRackLeave}
        style={{
          background: 'var(--rack-bg)',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          minHeight: 70,
          transition: 'background 0.15s ease',
        }}
      >
        {tiles.map((tile, i) => (
          <div
            key={i}
            onDragStart={e => e.preventDefault()}
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: 'var(--tile-bg)',
              boxShadow: 'var(--tile-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              color: NUM_COLOR[tile.c],
              cursor: 'grab',
              userSelect: 'none',
              opacity: draggingRackIdx === i ? 0.35 : 1,
              transform: draggingRackIdx === i ? 'scale(0.93)' : 'none',
              transition: 'background 0.15s ease, opacity 0.1s ease',
            }}
            onMouseDown={e => onMouseDown(e, tile, { from: 'rack', rackIdx: i })}
          >
            <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{tile.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
