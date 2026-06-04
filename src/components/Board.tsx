import React, { type CSSProperties } from 'react'
import type { Grid, DragSrc, Tile } from '../types'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222222',
}

const boardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 46px)',
  gridTemplateRows: 'repeat(6, 58px)',
  gap: 6,
  background: '#f0ede8',
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
}

const tileBase: CSSProperties = {
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
  cursor: 'grab',
  userSelect: 'none',
  boxSizing: 'border-box',
}

const emptyBase: CSSProperties = {
  width: 46,
  height: 58,
}

interface Props {
  grid: Grid
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDropGrid: (src: DragSrc, row: number, col: number) => void
}

export function Board({ grid, onDragStart, onDragEnd, onDropGrid }: Props) {
  const cells: React.ReactElement[] = []

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tile = grid[r][c]
      const key = `${r}-${c}`

      if (tile) {
        const src: DragSrc = { from: 'grid', row: r, col: c }
        cells.push(
          <div
            key={key}
            draggable
            style={{ ...tileBase, color: NUM_COLOR[tile.c] }}
            onDragStart={e => {
              e.dataTransfer.setData('application/json', JSON.stringify(src))
              e.dataTransfer.effectAllowed = 'move'
              onDragStart(src)
            }}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('application/json')
              if (!raw) return
              onDropGrid(JSON.parse(raw) as DragSrc, r, c)
            }}
          >
            {tile.n}
          </div>,
        )
      } else {
        cells.push(
          <div
            key={key}
            style={emptyBase}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('application/json')
              if (!raw) return
              onDropGrid(JSON.parse(raw) as DragSrc, r, c)
            }}
          />,
        )
      }
    }
  }

  return <div style={boardStyle}>{cells}</div>
}
