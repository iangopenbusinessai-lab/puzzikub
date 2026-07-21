import { useState, useRef, useEffect } from 'react'
import type { Tile, TileSpec } from '../types'
import { NUM_COLOR } from '../types'

interface Props {
  initialTile?: Tile
  position: { x: number; y: number }
  /** Emits a SPEC, not a Tile: the picker cannot know which copy index is free
   * in the puzzle being edited, so `useEditor` mints the id (m=2 Step 8). */
  onConfirm: (spec: TileSpec) => void
  onCancel: () => void
}

const PICKER_W = 192
const PICKER_H = 256

function ColorDot({ hex, label, isActive, onClick }: {
  hex: string
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: hex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        boxShadow: isActive ? `0 0 0 3px ${hex}66, 0 2px 6px rgba(0,0,0,0.18)` : '0 1px 3px rgba(0,0,0,0.18)',
        transition: 'box-shadow 0.1s ease',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  )
}

export function TilePicker({ initialTile, position, onConfirm, onCancel }: Props) {
  const [num, setNum] = useState(initialTile?.n ?? 1)
  const [color, setColor] = useState<Tile['c']>(initialTile?.c ?? 'r')
  const dragStartY = useRef<number | null>(null)
  const dragStartNum = useRef(num)

  const left = Math.max(8, Math.min(position.x - PICKER_W / 2, window.innerWidth - PICKER_W - 8))
  const top = Math.max(8, Math.min(position.y - PICKER_H / 2, window.innerHeight - PICKER_H - 8))

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragStartY.current === null) return
      const delta = dragStartY.current - e.clientY
      const steps = Math.round(delta / 20)
      setNum(Math.max(1, Math.min(13, dragStartNum.current + steps)))
    }
    const onMouseUp = () => {
      dragStartY.current = null
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <>
      {/* Transparent backdrop — click to cancel */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200 }}
        onMouseDown={onCancel}
      />
      {/* Picker popover */}
      <div
        style={{
          position: 'fixed',
          left,
          top,
          zIndex: 201,
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          userSelect: 'none',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Diamond: top dot */}
        <ColorDot hex="#A32D2D" label="R" isActive={color === 'r'} onClick={() => setColor('r')} />

        {/* Diamond: middle row — left dot, center tile, right dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ColorDot hex="#222222" label="K" isActive={color === 'k'} onClick={() => setColor('k')} />

          {/* Center tile — drag vertically to change number */}
          <div
            style={{
              width: 60,
              height: 74,
              borderRadius: 8,
              background: 'var(--tile-bg)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              border: `2px solid ${NUM_COLOR[color]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 600,
              color: NUM_COLOR[color],
              cursor: 'ns-resize',
            }}
            onMouseDown={e => {
              e.preventDefault()
              dragStartY.current = e.clientY
              dragStartNum.current = num
            }}
          >
            {num}
          </div>

          <ColorDot hex="#185FA5" label="B" isActive={color === 'b'} onClick={() => setColor('b')} />
        </div>

        {/* Diamond: bottom dot */}
        <ColorDot hex="#BA7517" label="A" isActive={color === 'a'} onClick={() => setColor('a')} />

        {/* Confirm */}
        <button
          onClick={() => onConfirm({ n: num, c: color })}
          style={{
            padding: '5px 24px',
            borderRadius: 20,
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: 2,
          }}
        >
          Confirm
        </button>
      </div>
    </>
  )
}
