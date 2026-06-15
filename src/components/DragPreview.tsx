import type { DragState } from '../hooks/useDrag'
import { NUM_COLOR } from '../types'

interface Props {
  drag: DragState
  previewId?: string
}

export function DragPreview({ drag, previewId }: Props) {
  return (
    <div id={previewId} style={{
      position: 'fixed',
      left: drag.x - 23,
      top: drag.y - 29,
      width: 46,
      height: 58,
      borderRadius: 8,
      background: 'var(--tile-bg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
      fontWeight: 500,
      color: NUM_COLOR[drag.tile.c],
      pointerEvents: 'none',
      zIndex: 9999,
      userSelect: 'none',
    }}>
      {drag.tile.n}
    </div>
  )
}
