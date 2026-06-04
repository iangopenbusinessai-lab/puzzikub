import type { CSSProperties } from 'react'
import type { Puzzle } from '../types'
import { usePlayState } from '../hooks/usePlayState'
import { isValidSet } from '../lib/validator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'
import { StatsBar } from '../components/StatsBar'

const DIFFS: Puzzle['diff'][] = ['easy', 'medium', 'hard']

interface Props {
  puzzle: Puzzle
  onNewPuzzle: (diff: Puzzle['diff']) => void
}

export function PlayScreen({ puzzle, onNewPuzzle }: Props) {
  const {
    boardState, rackState, moves, undos, canUndo, won,
    onDragStart, onDragEnd, onDropBoard, onDropRack,
    undo, reset,
  } = usePlayState(puzzle)

  const setsValid = boardState.filter(row => isValidSet(row)).length

  const pillRow: CSSProperties = {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
  }

  function pillStyle(active: boolean): CSSProperties {
    return {
      borderRadius: 20,
      fontSize: 12,
      padding: '4px 14px',
      border: active ? '1px solid #85B7EB' : '1px solid #ddd',
      background: active ? '#E6F1FB' : 'transparent',
      color: active ? '#0C447C' : '#555',
      cursor: 'pointer',
      fontWeight: active ? 500 : 400,
    }
  }

  const winStyle: CSSProperties = {
    background: '#EAF3DE',
    color: '#27500A',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
    fontWeight: 500,
  }

  const controlsStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  }

  const btnStyle = (disabled?: boolean): CSSProperties => ({
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: 8,
    border: '0.5px solid #ddd',
    background: disabled ? '#f5f5f5' : '#fff',
    color: disabled ? '#bbb' : '#333',
    cursor: disabled ? 'default' : 'pointer',
  })

  const hintStyle: CSSProperties = {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  }

  return (
    <div>
      <div style={pillRow}>
        {DIFFS.map(d => (
          <button key={d} style={pillStyle(puzzle.diff === d)} onClick={() => onNewPuzzle(d)}>
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <StatsBar
        moves={moves}
        undos={undos}
        rackLeft={rackState.length}
        setsValid={setsValid}
        totalSets={boardState.length}
      />

      {won && (
        <div style={winStyle}>
          Puzzle solved! {moves} move{moves !== 1 ? 's' : ''}, {undos} undo{undos !== 1 ? 's' : ''} used.
        </div>
      )}

      <Board
        sets={boardState}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDropBoard}
      />

      <Rack
        tiles={rackState}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDropRack}
      />

      <div style={controlsStyle}>
        <button style={btnStyle(!canUndo)} onClick={undo} disabled={!canUndo}>Undo</button>
        <button style={btnStyle()} onClick={reset}>Reset</button>
      </div>

      {puzzle.hint && <p style={hintStyle}>{puzzle.hint}</p>}
    </div>
  )
}
