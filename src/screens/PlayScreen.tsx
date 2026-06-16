import { useEffect, useState, useCallback } from 'react'
import { usePlayState } from '../hooks/usePlayState'
import { useDrag } from '../hooks/useDrag'
import { generatePuzzle } from '../lib/generator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'
import { DragPreview } from '../components/DragPreview'
import { NavBar } from '../components/NavBar'
import type { Screen, Difficulty } from '../types'

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

interface Props {
  activeScreen: Screen
  onNav: (s: Screen) => void
  soundEnabled: boolean
  onShowSettings: () => void
  onShowTutorial: () => void
}

let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

function playSnap() {
  const ctx = getAudioCtx()
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

export function PlayScreen({ activeScreen, onNav, soundEnabled, onShowSettings, onShowTutorial }: Props) {
  const { grid, rack, moves, undos, won, optimalMoves, invalidCells, drop, undo, reset, loadPuzzle } = usePlayState()
  const { drag, startDrag, updatePos, endDrag } = useDrag()

  const [diff, setDiff] = useState<Difficulty>('easy')
  const [hoverTarget, setHoverTarget] = useState<
    { to: 'grid'; row: number; col: number } | { to: 'rack' } | null
  >(null)

  const generate = useCallback((d: Difficulty) => {
    const p = generatePuzzle(d)
    if (!p) {
      const p2 = generatePuzzle(d)
      if (!p2) return
      loadPuzzle(p2)
      return
    }
    loadPuzzle(p)
  }, [loadPuzzle])

  useEffect(() => {
    generate('easy')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDiff = (d: Difficulty) => { setDiff(d); generate(d) }

  useEffect(() => {
    if (!drag) return

    const onMove = (e: MouseEvent) => updatePos(e.clientX, e.clientY)

    const onUp = () => {
      if (hoverTarget) {
        drop(drag.src, hoverTarget)
        if (hoverTarget.to === 'grid' && soundEnabled) playSnap()
      }
      endDrag()
      setHoverTarget(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [drag, hoverTarget, soundEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = grid.length === 0

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', transition: 'background 0.15s ease' }}>
      <NavBar
        activeScreen={activeScreen}
        onNav={onNav}
        onShowTutorial={onShowTutorial}
        onShowSettings={onShowSettings}
      />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>

        {/* Difficulty pills */}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {DIFFS.map(d => (
            <button
              key={d}
              onClick={() => handleDiff(d)}
              style={{
                padding: '4px 14px',
                borderRadius: 20,
                border: d === diff ? '0.5px solid #85B7EB' : '0.5px solid var(--border)',
                background: d === diff ? '#E8F1FB' : 'var(--surface)',
                color: d === diff ? '#185FA5' : 'var(--text-secondary)',
                fontWeight: d === diff ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>Generating puzzle…</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
              moves: {moves}&nbsp;&nbsp;optimal: {optimalMoves}&nbsp;&nbsp;rack: {rack.length}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 16px' }}>
              <Board
                grid={grid}
                drag={drag}
                hoveredCell={hoverTarget?.to === 'grid' ? { row: hoverTarget.row, col: hoverTarget.col } : null}
                onTileMouseDown={startDrag}
                onCellEnter={(row, col) => setHoverTarget({ to: 'grid', row, col })}
                onCellLeave={() => setHoverTarget(null)}
                invalidCells={invalidCells}
              />
            </div>

            <Rack
              tiles={rack}
              drag={drag}
              onTileMouseDown={startDrag}
              onRackEnter={() => setHoverTarget({ to: 'rack' })}
              onRackLeave={() => setHoverTarget(null)}
            />

            {won && (
              <div style={{ color: '#27500A', fontSize: 13, margin: '12px 0' }}>
                cleared ✓&nbsp;&nbsp;{moves} moves&nbsp;&nbsp;·&nbsp;&nbsp;optimal: {optimalMoves}
              </div>
            )}

            <div style={{ display: 'flex', gap: 20, margin: '12px 0' }}>
              <HoverBtn onClick={undo} disabled={moves === 0}>Undo</HoverBtn>
              <HoverBtn onClick={reset}>Reset</HoverBtn>
              <HoverBtn onClick={() => generate(diff)}>New</HoverBtn>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 32 }}>
              undos: {undos}
            </div>
          </>
        )}
      </div>

      {drag && <DragPreview drag={drag} />}
    </div>
  )
}

function HoverBtn({ onClick, disabled = false, children }: {
  onClick: () => void
  disabled?: boolean
  children: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      style={{
        fontSize: 13,
        color: disabled ? 'var(--border)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        transition: 'color 0.1s ease',
      }}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  )
}
