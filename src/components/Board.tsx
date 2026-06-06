import { useState } from 'react'
import type { Grid, DragSrc, Tile } from '../types'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222222',
}

interface Props {
  grid: Grid
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (row: number, col: number) => void
}

export function Board({ grid, onDragStart, onDragEnd, onDrop }: Props) {
  const [hoverCell, setHoverCell] = useState<string | null>(null)

  const cells: React.ReactElement[] = []

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tile = grid[r][c]
      const key = `${r}-${c}`
      const hovered = hoverCell === key

      if (tile) {
        cells.push(
          <div
            key={key}
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
              cursor: 'grab',
              userSelect: 'none',
              boxSizing: 'border-box',
            }}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', key)
              onDragStart({ from: 'grid', row: r, col: c })
            }}
            onDragEnd={onDragEnd}
            onDragOver={e => { e.preventDefault(); setHoverCell(key) }}
            onDragLeave={() => setHoverCell(null)}
            onDrop={e => { e.preventDefault(); setHoverCell(null); onDrop(r, c) }}
          >
            {tile.n}
          </div>,
        )
      } else {
        cells.push(
          <div
            key={key}
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: hovered ? '#c8c4bc' : '#d4d0c8',
            }}
            onDragOver={e => { e.preventDefault(); setHoverCell(key) }}
            onDragLeave={() => setHoverCell(null)}
            onDrop={e => { e.preventDefault(); setHoverCell(null); onDrop(r, c) }}
          />,
        )
      }
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 46px)',
      gridTemplateRows: 'repeat(6, 58px)',
      gap: 6,
      background: '#e8e5df',
      borderRadius: 16,
      padding: 16,
    }}>
      {cells}
    </div>
  )
}
