import { useReducer, useCallback, useRef } from 'react'
import type { Tile, Grid, DragSrc, Puzzle } from '../types'

const ROWS = 6
const COLS = 10

export type DropTarget = { to: 'grid'; row: number; col: number } | { to: 'rack' }

interface State {
  grid: Grid
  rack: Tile[]
  history: { grid: Grid; rack: Tile[] }[]
  moves: number
  undos: number
  won: boolean
  dragSrc: DragSrc | null
}

type Action =
  | { type: 'LOAD'; puzzle: Puzzle }
  | { type: 'SET_DRAG'; src: DragSrc | null }
  | { type: 'DROP'; target: DropTarget }
  | { type: 'UNDO' }
  | { type: 'SET_WON'; won: boolean }

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function copyGrid(g: Grid): Grid {
  return g.map(row => [...row])
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return {
        grid: emptyGrid(),
        rack: [...action.puzzle.rack],
        history: [],
        moves: 0,
        undos: 0,
        won: false,
        dragSrc: null,
      }

    case 'SET_DRAG':
      return { ...state, dragSrc: action.src }

    case 'DROP': {
      const { dragSrc, grid: g, rack: r } = state
      if (!dragSrc) return state

      const { target } = action
      const grid = copyGrid(g)
      const rack = [...r]
      const snapshot = { grid: copyGrid(g), rack: [...r] }

      if (target.to === 'grid') {
        const { row, col } = target
        if (dragSrc.from === 'rack') {
          if (dragSrc.rackIdx === undefined) return state
          const tile = rack[dragSrc.rackIdx]
          rack.splice(dragSrc.rackIdx, 1)
          const displaced = grid[row][col]
          grid[row][col] = tile
          if (displaced) rack.push(displaced)
        } else {
          if (dragSrc.row === undefined || dragSrc.col === undefined) return state
          const tmp = grid[row][col]
          grid[row][col] = grid[dragSrc.row][dragSrc.col]
          grid[dragSrc.row][dragSrc.col] = tmp
        }
      } else {
        // target.to === 'rack'
        if (dragSrc.from === 'rack') return state
        if (dragSrc.row === undefined || dragSrc.col === undefined) return state
        const tile = grid[dragSrc.row][dragSrc.col]
        if (!tile) return state
        grid[dragSrc.row][dragSrc.col] = null
        rack.push(tile)
      }

      return {
        ...state,
        grid,
        rack,
        history: [...state.history, snapshot],
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
        rack: prev.rack,
        history: state.history.slice(0, -1),
        undos: state.undos + 1,
        won: false,
        dragSrc: null,
      }
    }

    case 'SET_WON':
      return { ...state, won: action.won }
  }
}

const INIT: State = {
  grid: emptyGrid(),
  rack: [],
  history: [],
  moves: 0,
  undos: 0,
  won: false,
  dragSrc: null,
}

export function usePlayState() {
  const [state, dispatch] = useReducer(reducer, INIT)
  const puzzleRef = useRef<Puzzle | null>(null)

  const loadPuzzle = useCallback((p: Puzzle) => {
    puzzleRef.current = p
    dispatch({ type: 'LOAD', puzzle: p })
  }, [])

  const reset = useCallback(() => {
    if (puzzleRef.current) dispatch({ type: 'LOAD', puzzle: puzzleRef.current })
  }, [])

  const setDragSrc = useCallback((src: DragSrc | null) => {
    dispatch({ type: 'SET_DRAG', src })
  }, [])

  const drop = useCallback((target: DropTarget) => {
    dispatch({ type: 'DROP', target })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const setWon = useCallback((won: boolean) => {
    dispatch({ type: 'SET_WON', won })
  }, [])

  return {
    grid: state.grid,
    rack: state.rack,
    moves: state.moves,
    undos: state.undos,
    won: state.won,
    dragSrc: state.dragSrc,
    setDragSrc,
    drop,
    undo,
    reset,
    loadPuzzle,
    setWon,
  }
}
