import type { CSSProperties } from 'react'
import type { Tile, DragSrc } from '../types'
import { TileEl } from './TileEl'

const wrapStyle: CSSProperties = {
  border: '0.5px solid #ddd',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#999',
  marginBottom: 8,
}

const tilesStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  minHeight: 58,
  alignItems: 'flex-end',
}

interface Props {
  tiles: Tile[]
  activeDragSrc: DragSrc | null
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc) => void
}

export function Rack({ tiles, activeDragSrc, onDragStart, onDragEnd, onDrop }: Props) {
  // Rack only accepts drops from the board — rack-to-rack moves are not allowed
  const canAcceptDrop = activeDragSrc?.from === 'board'

  return (
    <div
      style={wrapStyle}
      onDragOver={e => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={e => {
        if (!canAcceptDrop) return
        e.preventDefault()
        const raw = e.dataTransfer.getData('application/json')
        if (!raw) return
        onDrop(JSON.parse(raw) as DragSrc)
      }}
    >
      <span style={labelStyle}>Your rack</span>
      <div style={tilesStyle}>
        {tiles.map((tile, rackIdx) => (
          <TileEl
            key={rackIdx}
            tile={tile}
            src={{ from: 'rack', rackIdx }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  )
}
