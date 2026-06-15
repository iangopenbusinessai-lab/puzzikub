import type { Tile, DragSrc } from '../types'
import { NUM_COLOR } from '../types'
import type { DragState } from '../hooks/useDrag'

interface Props {
  tiles: Tile[]
  drag: DragState | null
  onPointerDown: (e: React.PointerEvent<HTMLElement>, tile: Tile, src: DragSrc) => void
}


export function Rack({ tiles, drag, onPointerDown }: Props) {
  const draggingRackIdx = drag?.src.from === 'rack' ? drag.src.rackIdx : undefined

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>rack</div>
      <div
        data-rack="true"
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
            onPointerDown={e => onPointerDown(e, tile, { from: 'rack', rackIdx: i })}
          >
            {tile.n}
          </div>
        ))}
      </div>
    </div>
  )
}
