import { useReducer, useCallback } from 'react'
import type { Tile, Grid, DragSrc, Puzzle } from '../types'
import { isValidGrid } from '../lib/validator'

const GRID_ROWS = 6
const GRID_COLS = 10

interface State {
  grid: Grid
  rackState: Tile[]
  history: Array<{ grid: Grid; rack: Tile[] }>
  moves: number
  undos: number
  dragSrc: DragSrc | null
}

type Action =
  | { type: 'DRAG_START'; src: DragSrc }
  | { type: 'DRAG_END' }
  | { type: 'DROP_GRID'; src: DragSrc; row: number; col: number }
  | { type: 'DROP_RACK'; src: DragSrc }
  | { type: 'UNDO' }
  | { type: 'RESET'; puzzle: Puzzle }

function copyGrid(grid: Grid): Grid {
  return grid.map(row => [...row])
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DRAG_START':
      return { ...state, dragSrc: action.src }

    case 'DRAG_END':
      return { ...state, dragSrc: null }

    case 'DROP_GRID': {
      const { src, row: toRow, col: toCol } = action
      const grid = copyGrid(state.grid)
      const rack = [...state.rackState]

      if (src.from === 'rack' && src.idx !== undefined) {
        const tile = rack[src.idx]
        rack.splice(src.idx, 1)
        const displaced = grid[toRow][toCol]
        grid[toRow][toCol] = tile
        if (displaced) rack.push(displaced)
      } else if (src.from === 'grid' && src.row !== undefined && src.col !== undefined) {
        // Swap the two cells (one or both may be null)
        const tmp = grid[toRow][toCol]
        grid[toRow][toCol] = grid[src.row][src.col]
        grid[src.row][src.col] = tmp
      } else {
        return state
      }

      return {
        ...state,
        grid,
        rackState: rack,
        history: [...state.history, { grid: copyGrid(state.grid), rack: [...state.rackState] }],
        moves: state.moves + 1,
        dragSrc: null,
      }
    }

    case 'DROP_RACK': {
      const { src } = action
      if (src.from === 'rack') return state
      if (src.row === undefined || src.col === undefined) return state
      const tile = state.grid[src.row][src.col]
      if (!tile) return state

      const grid = copyGrid(state.grid)
      grid[src.row][src.col] = null

      return {
        ...state,
        grid,
        rackState: [...state.rackState, tile],
        history: [...state.history, { grid: copyGrid(state.grid), rack: [...state.rackState] }],
        moves: state.moves + 1,
        dragSrc: null,
      }
    }

    case 'UNDO': {
      if (state.history.length === 0) return state
      const prev = state.history[state.history.length - 1]
      return {
        ...state,
        grid: prev.grid,
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
  const grid: Grid = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(null),
  )
  puzzle.sets.forEach((setRow, r) => {
    if (r >= GRID_ROWS) return
    setRow.forEach((tile, c) => {
      if (c < GRID_COLS) grid[r][c] = tile
    })
  })
  return {
    grid,
    rackState: [...puzzle.rack],
    history: [],
    moves: 0,
    undos: 0,
    dragSrc: null,
  }
}

export function usePlayState(puzzle: Puzzle) {
  const [state, dispatch] = useReducer(reducer, puzzle, initState)

  const won = state.rackState.length === 0 && isValidGrid(state.grid)

  const onDragStart = useCallback((src: DragSrc) => dispatch({ type: 'DRAG_START', src }), [])
  const onDragEnd = useCallback(() => dispatch({ type: 'DRAG_END' }), [])
  const onDropGrid = useCallback(
    (src: DragSrc, row: number, col: number) => dispatch({ type: 'DROP_GRID', src, row, col }),
    [],
  )
  const onDropRack = useCallback((src: DragSrc) => dispatch({ type: 'DROP_RACK', src }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET', puzzle }), [puzzle])

  return {
    grid: state.grid,
    rackState: state.rackState,
    moves: state.moves,
    undos: state.undos,
    canUndo: state.history.length > 0,
    won,
    dragSrc: state.dragSrc,
    onDragStart,
    onDragEnd,
    onDropGrid,
    onDropRack,
    undo,
    reset,
  }
}
