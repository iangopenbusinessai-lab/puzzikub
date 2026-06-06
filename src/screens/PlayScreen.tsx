import { useState, useEffect, type CSSProperties } from 'react'
import type { Puzzle } from '../types'
import { usePlayState } from '../hooks/usePlayState'
import { validateGrid } from '../lib/validator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'

const DIFFS: Puzzle['diff'][] = ['easy', 'medium', 'hard']

type CheckResult = null | 'valid' | 'invalid' | 'needsRack'

interface Props {
  puzzle: Puzzle
  onNewPuzzle: (diff: Puzzle['diff']) => void
}

function plainBtn(disabled?: boolean): CSSProperties {
  return {
    fontSize: 13,
    color: disabled ? '#ccc' : '#555',
    background: 'transparent',
    border: 'none',
    padding: '6px 0',
    cursor: disabled ? 'default' : 'pointer',
    marginRight: 16,
  }
}

export function PlayScreen({ puzzle, onNewPuzzle }: Props) {
  const {
    grid, rackState, moves, undos, canUndo, dragSrc,
    onDragStart, onDragEnd, onDropGrid, onDropRack,
    undo, reset,
  } = usePlayState(puzzle)

  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const [checkHovered, setCheckHovered] = useState(false)

  // Reset check result on new puzzle or any move/undo
  useEffect(() => { setCheckResult(null) }, [puzzle.id])
  useEffect(() => { if (checkResult !== null) setCheckResult(null) }, [moves, undos]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCheck() {
    if (rackState.length > 0) {
      setCheckResult('needsRack')
      return
    }
    setCheckResult(validateGrid(grid) ? 'valid' : 'invalid')
  }

  const statsRow: CSSProperties = {
    display: 'flex',
    gap: 20,
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {DIFFS.map(d => (
          <button
            key={d}
            style={{
              fontSize: 13,
              color: puzzle.diff === d ? '#222' : '#999',
              fontWeight: puzzle.diff === d ? 500 : 400,
              background: 'transparent',
              border: 'none',
              padding: '6px 0',
              cursor: 'pointer',
              marginRight: 16,
            }}
            onClick={() => onNewPuzzle(d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <div style={statsRow}>
        <span>Moves: {moves}</span>
        <span>Undos: {undos}</span>
        <span>Rack: {rackState.length}</span>
      </div>

      <Board
        grid={grid}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropGrid={onDropGrid}
      />

      <Rack
        tiles={rackState}
        activeDragSrc={dragSrc}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDropRack}
      />

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={plainBtn(!canUndo)} onClick={undo} disabled={!canUndo}>Undo</button>
        <button style={plainBtn()} onClick={reset}>Reset</button>
        <button
          style={{ ...plainBtn(), color: checkHovered ? '#222' : '#555' }}
          onMouseEnter={() => setCheckHovered(true)}
          onMouseLeave={() => setCheckHovered(false)}
          onClick={handleCheck}
        >Check</button>
        {checkResult === 'valid' && (
          <span style={{ fontSize: 13, color: '#27500A' }}>cleared</span>
        )}
        {checkResult === 'invalid' && (
          <span style={{ fontSize: 13, color: '#A32D2D' }}>not quite</span>
        )}
        {checkResult === 'needsRack' && (
          <span style={{ fontSize: 13, color: '#A32D2D' }}>place all tiles first</span>
        )}
      </div>
    </div>
  )
}
