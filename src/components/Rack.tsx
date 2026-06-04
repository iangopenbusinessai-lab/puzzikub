import type { CSSProperties } from 'react'
import type { Tile, DragSrc } from '../types'
import { TileEl } from './TileEl'

const STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6,
  padding: 14,
  backgroundColor: '#f0e6c0',
  borderRadius: 10,
  minHeight: 86,
  alignItems: 'flex-start',
  alignContent: 'flex-start',
}

interface Props {
  tiles: Tile[]
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (src: DragSrc) => void
}

export function Rack({ tiles, onDragStart, onDragEnd, onDrop }: Props) {
  return (
    <div
      style={STYLE}
      onDragOver={e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={e => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('application/json')
        if (!raw) return
        onDrop(JSON.parse(raw) as DragSrc)
      }}
    >
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
  )
}
