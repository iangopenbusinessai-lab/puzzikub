import { useReducer, useCallback } from 'react'
import type { Tile, SetRow, DragSrc, Puzzle } from '../types'
import { isValidSet } from '../lib/validator'

interface State {
  boardState: SetRow[]
  rackState: Tile[]
  history: Array<{ board: SetRow[]; rack: Tile[] }>
  moves: number
  undos: number
  dragSrc: DragSrc | null
}

type Action =
  | { type: 'DRAG_START'; src: DragSrc }
  | { type: 'DRAG_END' }
  | { type: 'DROP_BOARD'; src: DragSrc; setIdx: number; tileIdx: number }
  | { type: 'DROP_RACK'; src: DragSrc }
  | { type: 'UNDO' }
  | { type: 'RESET'; puzzle: Puzzle }

function copyBoard(board: SetRow[]): SetRow[] {
  return board.map(row => [...row])
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DRAG_START':
      return { ...state, dragSrc: action.src }

    case 'DRAG_END':
      return { ...state, dragSrc: null }

    case 'DROP_BOARD': {
      const { src, setIdx: toSet, tileIdx: toTile } = action
      const board = copyBoard(state.boardState)
      const rack = [...state.rackState]

      let tile: Tile | null = null
      if (src.from === 'rack' && src.rackIdx !== undefined) {
        tile = rack[src.rackIdx]
        rack.splice(src.rackIdx, 1)
      } else if (src.from === 'board' && src.setIdx !== undefined && src.tileIdx !== undefined) {
        tile = board[src.setIdx][src.tileIdx] as Tile
        board[src.setIdx][src.tileIdx] = null
      }
      if (!tile) return state

      const displaced = board[toSet][toTile]
      board[toSet][toTile] = tile

      if (displaced) {
        if (src.from === 'rack') {
          rack.push(displaced)
        } else if (src.from === 'board' && src.setIdx !== undefined && src.tileIdx !== undefined) {
          // src slot already cleared above — put displaced there (swap)
          board[src.setIdx][src.tileIdx] = displaced
        }
      }

      return {
        ...state,
        boardState: board,
        rackState: rack,
        history: [...state.history, { board: copyBoard(state.boardState), rack: [...state.rackState] }],
        moves: state.moves + 1,
        dragSrc: null,
      }
    }

    case 'DROP_RACK': {
      const { src } = action
      if (src.from === 'rack') return state
      if (src.setIdx === undefined || src.tileIdx === undefined) return state

      const board = copyBoard(state.boardState)
      const rack = [...state.rackState]
      const tile = board[src.setIdx][src.tileIdx]
      if (!tile) return state

      board[src.setIdx][src.tileIdx] = null
      rack.push(tile)

      return {
        ...state,
        boardState: board,
        rackState: rack,
        history: [...state.history, { board: copyBoard(state.boardState), rack: [...state.rackState] }],
        moves: state.moves + 1,
        dragSrc: null,
      }
    }

    case 'UNDO': {
      if (state.history.length === 0) return state
      const prev = state.history[state.history.length - 1]
      return {
        ...state,
        boardState: prev.board,
        rackState: prev.rack,
        history: state.history.slice(0, -1),
        undos: state.undos + 1,
        dragSrc: null,
      }
    }

    case 'RESET':
      return initState(action.puzzle)
  }
}

function initState(puzzle: Puzzle): State {
  return {
    boardState: puzzle.sets.map(row => [...row]),
    rackState: [...puzzle.rack],
    history: [],
    moves: 0,
    undos: 0,
    dragSrc: null,
  }
}

export function usePlayState(puzzle: Puzzle) {
  const [state, dispatch] = useReducer(reducer, puzzle, initState)

  const won = state.boardState.length > 0 && state.boardState.every(row => isValidSet(row))

  const onDragStart = useCallback((src: DragSrc) => dispatch({ type: 'DRAG_START', src }), [])
  const onDragEnd = useCallback(() => dispatch({ type: 'DRAG_END' }), [])
  const onDropBoard = useCallback(
    (src: DragSrc, setIdx: number, tileIdx: number) => dispatch({ type: 'DROP_BOARD', src, setIdx, tileIdx }),
    [],
  )
  const onDropRack = useCallback((src: DragSrc) => dispatch({ type: 'DROP_RACK', src }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET', puzzle }), [puzzle])

  return {
    boardState: state.boardState,
    rackState: state.rackState,
    moves: state.moves,
    undos: state.undos,
    canUndo: state.history.length > 0,
    won,
    dragSrc: state.dragSrc,
    onDragStart,
    onDragEnd,
    onDropBoard,
    onDropRack,
    undo,
    reset,
  }
}
