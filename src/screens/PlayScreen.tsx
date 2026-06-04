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
    boardState, rackState, moves, undos, canUndo, won, dragSrc,
    onDragStart, onDragEnd, onDropBoard, onDropRack,
    undo, reset,
  } = usePlayState(puzzle)

  const setsValid = boardState.filter(row => isValidSet(row)).length

  const diffRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 20,
  }

  return (
    <div>
      <div style={diffRowStyle}>
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

      <StatsBar
        moves={moves}
        undos={undos}
        rackLeft={rackState.length}
        setsValid={setsValid}
        totalSets={boardState.length}
      />

      <Board
        sets={boardState}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDropBoard}
      />

      <Rack
        tiles={rackState}
        activeDragSrc={dragSrc}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDropRack}
      />

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button style={plainBtn(!canUndo)} onClick={undo} disabled={!canUndo}>Undo</button>
        <button style={plainBtn()} onClick={reset}>Reset</button>
        {won && <span style={{ fontSize: 13, color: '#27500A' }}>cleared</span>}
      </div>
    </div>
  )
}
