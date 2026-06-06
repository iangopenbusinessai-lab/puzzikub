import { useState } from 'react'
import type { Grid, DragSrc, Tile } from '../types'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222',
}

interface Props {
  grid: Grid
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
  onDrop: (row: number, col: number) => void
}

function playSnap() {
  const ctx = new AudioContext()
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008))
  }
  const src = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = 0.18
  src.buffer = buf
  src.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

function suppressGhost(e: React.DragEvent) {
  const ghost = document.createElement('div')
  ghost.style.cssText = 'position:absolute;top:-9999px'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 0, 0)
  setTimeout(() => document.body.removeChild(ghost), 0)
}

export function Board({ grid, onDragStart, onDragEnd, onDrop }: Props) {
  const [hoverCell, setHoverCell] = useState<string | null>(null)
  const [draggingCell, setDraggingCell] = useState<string | null>(null)

  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null

  const cells: React.ReactElement[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = grid[r][c]
      const key = `${r}-${c}`
      const hovered = hoverCell === key
      const dragging = draggingCell === key

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
              cursor: dragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              boxSizing: 'border-box',
              opacity: dragging ? 0.4 : 1,
              transform: dragging ? 'scale(0.95)' : 'none',
              outline: hovered ? '2px solid #378ADD' : 'none',
              outlineOffset: -2,
            }}
            onDragStart={e => {
              suppressGhost(e)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', key)
              setDraggingCell(key)
              onDragStart({ from: 'grid', row: r, col: c })
            }}
            onDragEnd={() => { setDraggingCell(null); setHoverCell(null); onDragEnd() }}
            onDragOver={e => { e.preventDefault(); setHoverCell(key) }}
            onDragLeave={() => setHoverCell(null)}
            onDrop={e => {
              e.preventDefault()
              setHoverCell(null)
              playSnap()
              onDrop(r, c)
            }}
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
              background: hovered ? '#b8b4aa' : '#d4d0c8',
              outline: hovered ? '2px solid rgba(0,0,0,0.15)' : 'none',
              outlineOffset: -2,
              boxSizing: 'border-box',
            }}
            onDragOver={e => { e.preventDefault(); setHoverCell(key) }}
            onDragLeave={() => setHoverCell(null)}
            onDrop={e => {
              e.preventDefault()
              setHoverCell(null)
              playSnap()
              onDrop(r, c)
            }}
          />,
        )
      }
    }
  }

  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: `repeat(${cols}, 46px)`,
      gridTemplateRows: `repeat(${rows}, 58px)`,
      gap: 6,
      background: '#e8e5df',
      borderRadius: 16,
      padding: 16,
    }}>
      {cells}
    </div>
  )
}
