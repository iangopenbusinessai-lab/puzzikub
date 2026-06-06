import { useEffect, useState, useCallback } from 'react'
import { usePlayState } from '../hooks/usePlayState'
import { generatePuzzle } from '../lib/generator'
import { validateGrid } from '../lib/validator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'
import type { Screen, Difficulty } from '../types'

interface Props {
  activeScreen: Screen
  onNav: (s: Screen) => void
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

const NAV: { label: string; screen: Screen }[] = [
  { label: 'Play', screen: 'play' },
  { label: 'Library', screen: 'library' },
  { label: 'Editor', screen: 'editor' },
]

export function PlayScreen({ activeScreen, onNav }: Props) {
  const { grid, rack, moves, undos, won, optimalMoves, setDragSrc, drop, undo, reset, loadPuzzle, setWon } = usePlayState()

  const [diff, setDiff] = useState<Difficulty>('easy')
  const [checkResult, setCheckResult] = useState<'valid' | 'invalid' | null>(null)

  const generate = useCallback((d: Difficulty) => {
    const p = generatePuzzle(d)
    if (p) loadPuzzle(p)
    setCheckResult(null)
  }, [loadPuzzle])

  useEffect(() => {
    generate('easy')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDiff = (d: Difficulty) => {
    setDiff(d)
    generate(d)
  }

  const handleCheck = () => {
    if (rack.length > 0) {
      setCheckResult('invalid')
      return
    }
    const ok = validateGrid(grid)
    setCheckResult(ok ? 'valid' : 'invalid')
    if (ok) setWon(true)
  }

  const loading = grid.length === 0

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px' }}>

      {/* Nav bar */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 0' }}>
        {NAV.map(n => (
          <button
            key={n.screen}
            onClick={() => onNav(n.screen)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: n.screen === activeScreen ? '0.5px solid #85B7EB' : '0.5px solid transparent',
              background: n.screen === activeScreen ? '#E8F1FB' : 'transparent',
              color: n.screen === activeScreen ? '#185FA5' : '#bbb',
              fontWeight: n.screen === activeScreen ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Difficulty pills */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {DIFFS.map(d => (
          <button
            key={d}
            onClick={() => handleDiff(d)}
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              border: d === diff ? '0.5px solid #85B7EB' : '0.5px solid #ccc',
              background: d === diff ? '#E8F1FB' : '#f5f5f5',
              color: d === diff ? '#185FA5' : '#555',
              fontWeight: d === diff ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#999', fontSize: 13, padding: '20px 0' }}>Generating puzzle…</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ fontSize: 13, color: '#666', margin: '4px 0 8px' }}>
            moves: {moves}&nbsp;&nbsp;optimal: {optimalMoves}&nbsp;&nbsp;rack: {rack.length}
          </div>

          {/* Board centered */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
            <Board
              grid={grid}
              onDragStart={setDragSrc}
              onDragEnd={() => setDragSrc(null)}
              onDrop={(row, col) => drop({ to: 'grid', row, col })}
            />
          </div>

          {/* Rack */}
          <Rack
            tiles={rack}
            onDragStart={setDragSrc}
            onDragEnd={() => setDragSrc(null)}
            onDrop={() => drop({ to: 'rack' })}
          />

          {/* Win message */}
          {won && (
            <div style={{ color: '#27500A', fontWeight: 600, fontSize: 15, margin: '10px 0' }}>
              cleared ✓&nbsp;&nbsp;you used {moves} moves&nbsp;&nbsp;·&nbsp;&nbsp;optimal: {optimalMoves}
            </div>
          )}

          {/* Check result */}
          {checkResult === 'invalid' && !won && (
            <div style={{ color: '#A32D2D', fontSize: 13, margin: '6px 0' }}>
              {rack.length > 0 ? 'place all rack tiles first' : 'not valid — keep rearranging'}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 20, margin: '12px 0' }}>
            <HoverBtn onClick={handleCheck}>Check</HoverBtn>
            <HoverBtn onClick={() => { undo(); setCheckResult(null) }} disabled={moves === 0}>Undo</HoverBtn>
            <HoverBtn onClick={() => { reset(); setCheckResult(null) }}>Reset</HoverBtn>
            <HoverBtn onClick={() => generate(diff)}>New</HoverBtn>
          </div>

          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
            undos: {undos}
          </div>
        </>
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
        color: disabled ? '#ccc' : hov ? '#222' : '#555',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
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
