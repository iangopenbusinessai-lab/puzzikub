import type { Puzzle } from '../types'
import { usePlayState } from '../hooks/usePlayState'
import { isValidSet } from '../lib/validator'
import { Board } from '../components/Board'
import { Rack } from '../components/Rack'
import { StatsBar } from '../components/StatsBar'

interface Props {
  puzzle: Puzzle
  onBack: () => void
}

export function PlayScreen({ puzzle, onBack }: Props) {
  const {
    boardState, rackState, moves, undos, canUndo, won,
    onDragStart, onDragEnd, onDropBoard, onDropRack,
    undo, reset,
  } = usePlayState(puzzle)

  const setsValid = boardState.filter(row => isValidSet(row)).length

  return (
    <div className="play-screen">
      <header className="play-screen__header">
        <button className="btn-back" onClick={onBack}>← Library</button>
        <h1 className="play-screen__title">{puzzle.name}</h1>
        <span className={`diff-badge diff-badge--${puzzle.diff}`}>{puzzle.diff}</span>
      </header>

      <StatsBar
        moves={moves}
        undos={undos}
        rackLeft={rackState.length}
        setsValid={setsValid}
        totalSets={boardState.length}
      />

      {won && (
        <div className="win-banner">
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

      <div className="play-screen__controls">
        <button onClick={undo} disabled={!canUndo}>Undo</button>
        <button onClick={reset}>Reset</button>
      </div>

      {puzzle.hint && <p className="play-screen__hint">{puzzle.hint}</p>}
    </div>
  )
}
