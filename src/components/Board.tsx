import type { Grid, DragSrc, Tile } from '../types'
import type { DragState } from '../hooks/useDrag'

const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222',
}

interface Props {
  grid: Grid
  drag: DragState | null
  hoveredCell: { row: number; col: number } | null
  onPointerDown: (e: React.PointerEvent<HTMLElement>, tile: Tile, src: DragSrc) => void
  invalidCells: Set<string>
}

function suppressDragGhost(e: React.DragEvent<HTMLDivElement>) {
  e.dataTransfer.effectAllowed = 'move'
  const ghost = document.createElement('div')
  ghost.style.cssText = 'width:1px;height:1px;position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 0, 0)
  requestAnimationFrame(() => document.body.removeChild(ghost))
}

export function Board({ grid, drag, hoveredCell, onPointerDown, invalidCells }: Props) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null

  const srcRow = drag?.src.from === 'grid' ? drag.src.row : undefined
  const srcCol = drag?.src.from === 'grid' ? drag.src.col : undefined

  const cells = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = grid[r][c]
      const key = `${r}-${c}`
      const hovered = hoveredCell?.row === r && hoveredCell?.col === c
      const isDraggingSrc = srcRow === r && srcCol === c
      const isInvalid = invalidCells.has(`${r},${c}`)

      if (tile) {
        cells.push(
          <div
            key={key}
            data-row={r}
            data-col={c}
            draggable
            onDragStart={suppressDragGhost}
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: isInvalid ? '#FFF0F0' : 'var(--tile-bg)',
              boxShadow: isInvalid ? 'none' : 'var(--tile-shadow)',
              border: isInvalid ? '1px solid #F09595' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              color: NUM_COLOR[tile.c],
              cursor: 'grab',
              userSelect: 'none',
              opacity: isDraggingSrc ? 0.35 : 1,
              transform: isDraggingSrc ? 'scale(0.93)' : 'none',
              outline: hovered && !isDraggingSrc ? '2px solid #378ADD' : 'none',
              outlineOffset: -2,
              transition: 'background 0.15s ease, opacity 0.1s ease',
              boxSizing: 'border-box',
            }}
            onPointerDown={e => onPointerDown(e, tile, { from: 'grid', row: r, col: c })}
          >
            {tile.n}
          </div>,
        )
      } else {
        cells.push(
          <div
            key={key}
            data-row={r}
            data-col={c}
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: hovered ? 'var(--cell-hover)' : 'var(--cell-empty)',
              outline: hovered ? '2px solid rgba(0,0,0,0.15)' : 'none',
              outlineOffset: -2,
              transition: 'background 0.15s ease',
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
      background: 'var(--grid-bg)',
      borderRadius: 16,
      padding: 16,
      transition: 'background 0.15s ease',
    }}>
      {cells}
    </div>
  )
}
