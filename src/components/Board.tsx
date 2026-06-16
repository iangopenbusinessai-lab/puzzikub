import type { Grid, DragSrc, Tile } from '../types'
import { NUM_COLOR } from '../types'
import type { DragState } from '../hooks/useDrag'

interface Props {
  grid: Grid
  drag: DragState | null
  hoveredCell: { row: number; col: number } | null
  onTileMouseDown: (e: React.MouseEvent, tile: Tile, src: DragSrc) => void
  onCellEnter: (row: number, col: number) => void
  onCellLeave: () => void
  invalidCells: Set<string>
  lockInCells: Set<string>
}

export function Board({ grid, drag, hoveredCell, onTileMouseDown, onCellEnter, onCellLeave, invalidCells, lockInCells }: Props) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null

  const srcRow = drag?.src.from === 'grid' ? drag.src.row : undefined
  const srcCol = drag?.src.from === 'grid' ? drag.src.col : undefined
  const shakeKey = [...invalidCells].find(k => k.startsWith('__v:')) ?? '__v:0'

  const cells = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = grid[r][c]
      const hovered = hoveredCell?.row === r && hoveredCell?.col === c
      const isDraggingSrc = srcRow === r && srcCol === c
      const isInvalid = invalidCells.has(`${r},${c}`)
      const isLockIn = lockInCells.has(`${r},${c}`)

      if (tile) {
        cells.push(
          <div
            key={isInvalid ? `${r}-${c}-${shakeKey}` : `${r}-${c}`}
            className={isInvalid ? 'tile-invalid' : isLockIn ? 'tile-lockin' : ''}
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: isInvalid ? 'var(--invalid-bg)' : 'var(--tile-bg)',
              boxShadow: isInvalid ? '0 0 0 1.5px var(--invalid-ring)' : 'var(--tile-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              color: NUM_COLOR[tile.c],
              cursor: 'grab',
              userSelect: 'none',
              opacity: isDraggingSrc ? 0.35 : 1,
              transform: isDraggingSrc ? 'scale(0.93)' : undefined,
              animation: !isInvalid && !isLockIn ? 'tile-land 0.2s ease' : undefined,
              outline: hovered && !isDraggingSrc ? '2px solid #378ADD' : 'none',
              outlineOffset: -2,
              transition: 'background 0.15s ease, opacity 0.1s ease',
              boxSizing: 'border-box',
            }}
            onMouseDown={e => onTileMouseDown(e, tile, { from: 'grid', row: r, col: c })}
            onMouseEnter={() => onCellEnter(r, c)}
            onMouseLeave={onCellLeave}
          >
            <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{tile.n}</span>
          </div>,
        )
      } else {
        cells.push(
          <div
            key={`empty-${r}-${c}`}
            className="cell-idle"
            style={{
              width: 46,
              height: 58,
              borderRadius: 8,
              background: hovered ? 'var(--cell-hover)' : 'var(--cell-empty)',
              outline: hovered ? '2px solid rgba(0,0,0,0.15)' : 'none',
              outlineOffset: -2,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={() => onCellEnter(r, c)}
            onMouseLeave={onCellLeave}
          />,
        )
      }
    }
  }

  return (
    <div
      style={{
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
