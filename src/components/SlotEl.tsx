import { useState, type CSSProperties } from 'react'
import type { DragSrc } from '../types'

const BASE: CSSProperties = {
  width: 46,
  height: 58,
  borderRadius: 7,
  borderWidth: 1.5,
  borderStyle: 'dashed',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
}

interface Props {
  onDrop: (src: DragSrc) => void
}

export function SlotEl({ onDrop }: Props) {
  const [over, setOver] = useState(false)
  return (
    <div
      style={{
        ...BASE,
        borderColor: over ? '#378ADD' : '#ccc',
        background: over ? '#E6F1FB' : 'transparent',
      }}
      onDragOver={e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        const raw = e.dataTransfer.getData('application/json')
        if (!raw) return
        onDrop(JSON.parse(raw) as DragSrc)
      }}
    />
  )
}
