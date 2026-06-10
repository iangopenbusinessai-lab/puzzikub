import { useEffect, useState, useCallback } from 'react'
import { usePlayState } from '../hooks/usePlayState'
import { useDrag } from '../hooks/useDrag'
import { generatePuzzle } from '../lib/generator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'
import { DragPreview } from '../components/DragPreview'
import { SettingsPanel } from '../components/SettingsPanel'
import type { Screen, Difficulty } from '../types'

type ThemeOption = 'light' | 'dark' | 'system'

interface Props {
  activeScreen: Screen
  onNav: (s: Screen) => void
  theme: ThemeOption
  setTheme: (t: ThemeOption) => void
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

const NAV: { label: string; screen: Screen }[] = [
  { label: 'Play', screen: 'play' },
  { label: 'Library', screen: 'library' },
  { label: 'Editor', screen: 'editor' },
]

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

function findDropTarget(e: React.PointerEvent): { to: 'grid'; row: number; col: number } | { to: 'rack' } | null {
  let el: Element | null = document.elementFromPoint(e.clientX, e.clientY)
  while (el) {
    const ds = (el as HTMLElement).dataset
    if (ds.row !== undefined && ds.col !== undefined) {
      return { to: 'grid', row: Number(ds.row), col: Number(ds.col) }
    }
    if (ds.rack) return { to: 'rack' }
    el = el.parentElement
  }
  return null
}

function findHoveredCell(e: React.PointerEvent): { row: number; col: number } | null {
  let el: Element | null = document.elementFromPoint(e.clientX, e.clientY)
  while (el) {
    const ds = (el as HTMLElement).dataset
    if (ds.row !== undefined && ds.col !== undefined) {
      return { row: Number(ds.row), col: Number(ds.col) }
    }
    el = el.parentElement
  }
  return null
}

export function PlayScreen({ activeScreen, onNav, theme, setTheme, soundEnabled, setSoundEnabled }: Props) {
  const { grid, rack, moves, undos, won, optimalMoves, drop, undo, reset, loadPuzzle } = usePlayState()
  const { drag, startDrag, moveDrag, endDrag } = useDrag()

  const [diff, setDiff] = useState<Difficulty>('easy')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const generate = useCallback((d: Difficulty) => {
    const p = generatePuzzle(d)
    if (p) loadPuzzle(p)
  }, [loadPuzzle])

  useEffect(() => {
    generate('easy')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDiff = (d: Difficulty) => { setDiff(d); generate(d) }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    moveDrag(e)
    setHoveredCell(findHoveredCell(e))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drag) return
    const target = findDropTarget(e)
    if (target) {
      drop(drag.src, target)
      if (target.to === 'grid' && soundEnabled) playSnap()
    }
    endDrag()
    setHoveredCell(null)
  }

  const loading = grid.length === 0

  return (
    <div
      style={{ background: 'var(--bg)', minHeight: '100vh', transition: 'background 0.15s ease' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Sticky nav */}
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '0.5px solid var(--border)',
        padding: '0 20px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        transition: 'background 0.15s ease',
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: '0 0 80px' }}>Puzzikub</span>
        <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {NAV.map(n => (
            <button
              key={n.screen}
              onClick={() => onNav(n.screen)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                border: n.screen === activeScreen ? '0.5px solid #85B7EB' : '0.5px solid transparent',
                background: n.screen === activeScreen ? '#E8F1FB' : 'transparent',
                color: n.screen === activeScreen ? '#185FA5' : 'var(--text-secondary)',
                fontWeight: n.screen === activeScreen ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {n.label}
            </button>
          ))}
        </div>
        <div style={{ flex: '0 0 80px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: 4 }}
          >⚙</button>
        </div>
      </nav>

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
                hoveredCell={hoveredCell}
                onPointerDown={startDrag}
              />
            </div>

            <Rack
              tiles={rack}
              drag={drag}
              onPointerDown={startDrag}
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

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          setTheme={setTheme}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
