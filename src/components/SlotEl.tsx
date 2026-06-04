import type { DragSrc } from '../types'

interface Props {
  onDrop: (src: DragSrc) => void
}

export function SlotEl({ onDrop }: Props) {
  return (
    <div
      className="slot"
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
