import type { CSSProperties } from 'react'
import type { DragSrc } from '../types'

const STYLE: CSSProperties = {
  width: 46,
  height: 58,
  borderRadius: 5,
  borderWidth: 2,
  borderStyle: 'dashed',
  borderColor: '#aaaaaa',
  backgroundColor: 'rgba(0,0,0,0.04)',
  flexShrink: 0,
}

interface Props {
  onDrop: (src: DragSrc) => void
}

export function SlotEl({ onDrop }: Props) {
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
    />
  )
}
