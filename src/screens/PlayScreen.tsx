import { useState, useEffect, useCallback } from 'react'
import type { Difficulty, Puzzle, Screen } from '../types'
import { generatePuzzle } from '../lib/generator'
import { validateGrid } from '../lib/validator'
import { usePlayState } from '../hooks/usePlayState'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'

type CheckResult = null | 'valid' | 'invalid' | 'needsRack'

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']
const SCREENS: Screen[] = ['play', 'editor', 'library']

interface Props {
  puzzle: Puzzle
  activeScreen: Screen
  onNav: (s: Screen) => void
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

export function PlayScreen({ puzzle, activeScreen, onNav }: Props) {
  const [diff, setDiff] = useState<Difficulty>('easy')
  const [checkResult, setCheckResult] = useState<CheckResult>(null)

  const { grid, rack, moves, undos, setDragSrc, loadPuzzle, reset, undo, drop, setWon } = usePlayState()

  const canUndo = (moves - undos) > 0

  // Load puzzle when App.tsx supplies a new one (initial load or library selection)
  useEffect(() => { loadPuzzle(puzzle); setCheckResult(null) }, [puzzle.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback((d: Difficulty) => {
    const p = generatePuzzle(d)
    if (p) loadPuzzle(p)
    setCheckResult(null)
  }, [loadPuzzle])

  function handleDiff(d: Difficulty) {
    setDiff(d)
    generate(d)
  }

  function handleUndo() {
    undo()
    setCheckResult(null)
  }

  function handleReset() {
    reset()
    setCheckResult(null)
  }

  function handleNew() {
    generate(diff)
  }

  function handleCheck() {
    if (rack.length > 0) { setCheckResult('needsRack'); return }
    if (validateGrid(grid)) {
      setWon(true)
      setCheckResult('valid')
    } else {
      setCheckResult('invalid')
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>

      {/* Nav */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
        {SCREENS.map(s => (
          <button
            key={s}
            style={{
              fontSize: 14,
              color: s === activeScreen ? '#222' : '#999',
              fontWeight: s === activeScreen ? 500 : 400,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginRight: 20,
              padding: 0,
            }}
            onClick={() => onNav(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Difficulty pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        {DIFFS.map(d => (
          <button
            key={d}
            style={{
              fontSize: 12,
              padding: '4px 12px',
              borderRadius: 20,
              cursor: 'pointer',
              border: d === diff ? 'none' : '0.5px solid #ddd',
              background: d === diff ? '#E6F1FB' : 'transparent',
              color: d === diff ? '#0C447C' : '#999',
            }}
            onClick={() => handleDiff(d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ fontSize: 12, color: '#999', margin: '12px 0' }}>
        moves: {moves}&nbsp;&nbsp;rack: {rack.length}
      </div>

      {/* Board */}
      <div style={{ display: 'flex' }}>
        <Board
          grid={grid}
          onDragStart={setDragSrc}
          onDragEnd={() => setDragSrc(null)}
          onDrop={(row, col) => drop({ to: 'grid', row, col })}
        />
      </div>

      {/* Rack */}
      <div style={{ margin: '16px 0' }}>
        <Rack
          tiles={rack}
          onDragStart={setDragSrc}
          onDragEnd={() => setDragSrc(null)}
          onDrop={() => drop({ to: 'rack' })}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <HoverBtn onClick={handleUndo} disabled={!canUndo}>Undo</HoverBtn>
        <HoverBtn onClick={handleReset}>Reset</HoverBtn>
        <HoverBtn onClick={handleNew}>New</HoverBtn>
        <HoverBtn onClick={handleCheck}>Check</HoverBtn>
      </div>

      {/* Check result */}
      {checkResult === 'needsRack' && (
        <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>place all tiles first</div>
      )}
      {checkResult === 'invalid' && (
        <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 8 }}>not quite</div>
      )}
      {checkResult === 'valid' && (
        <div style={{ fontSize: 12, color: '#27500A', marginTop: 8 }}>cleared ✓</div>
      )}

    </div>
  )
}
