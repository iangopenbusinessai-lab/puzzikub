import { useContext } from 'react'
import type { Tile, DragSrc } from '../types'
import type { DragState } from '../hooks/useDrag'
import { TileStyleContext } from '../lib/themes'
import { TileFace } from './TileFace'

interface Props {
  tiles: Tile[]
  drag: DragState | null
  onTileMouseDown: (e: React.MouseEvent, tile: Tile, src: DragSrc) => void
  onRackEnter: () => void
  onRackLeave: () => void
}

export function Rack({ tiles, drag, onTileMouseDown, onRackEnter, onRackLeave }: Props) {
  const tileStyle = useContext(TileStyleContext)
  const draggingRackIdx = drag?.src.from === 'rack' ? drag.src.rackIdx : undefined

  return (
    <div>
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
            style={{ cursor: 'grab', userSelect: 'none' }}
            onMouseDown={e => onTileMouseDown(e, tile, { from: 'rack', rackIdx: i })}
          >
            <TileFace
              tile={tile}
              tileStyle={tileStyle}
              dimmed={draggingRackIdx === i}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
