import type { DragState } from '../hooks/useDrag'
import type { TileStyle } from '../lib/themes'
import { TileFace } from './TileFace'

interface Props {
  drag: DragState
  previewId?: string
  tileStyle: TileStyle
}

export function DragPreview({ drag, previewId, tileStyle }: Props) {
  return (
    <div id={previewId} style={{
      position: 'fixed',
      left: drag.x - 23,
      top: drag.y - 29,
      pointerEvents: 'none',
      zIndex: 9999,
      userSelect: 'none',
    }}>
      <TileFace tile={drag.tile} tileStyle={tileStyle} />
    </div>
  )
}
