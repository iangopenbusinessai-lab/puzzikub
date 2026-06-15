import { useReducer, useCallback } from 'react'
import type { Tile, Grid, DragSrc, Puzzle } from '../types'
import { validateGrid, getInvalidCells } from '../lib/validator'

export type DropTarget = { to: 'grid'; row: number; col: number } | { to: 'rack' }

interface State {
  grid: Grid
  rack: Tile[]
  history: { grid: Grid; rack: Tile[] }[]
  moves: number
  undos: number
  won: boolean
  optimalMoves: number
  invalidCells: Set<string>
}

type Action =
  | { type: 'LOAD'; puzzle: Puzzle }
  | { type: 'DROP'; src: DragSrc; target: DropTarget }
  | { type: 'UNDO' }
  | { type: 'RESET' }
  | { type: 'SET_WON'; won: boolean }

function deepCopyGrid(g: Grid): Grid {
  return g.map(row => [...row])
}

function reducer(state: State, action: Action): State {
  switch (action.type) {

    case 'LOAD':
      return {
        grid: deepCopyGrid(action.puzzle.grid),
        rack: [...action.puzzle.rack],
        history: [],
        moves: 0,
        undos: 0,
        won: false,
        optimalMoves: action.puzzle.optimalMoves,
        invalidCells: new Set(),
      }

    case 'DROP': {
      const { src: dragSrc, target } = action
      const grid = deepCopyGrid(state.grid)
      const rack = [...state.rack]
      const snapshot = { grid: deepCopyGrid(state.grid), rack: [...state.rack] }

      const tile: Tile | null =
        dragSrc.from === 'rack'
          ? rack[dragSrc.rackIdx!]
          : grid[dragSrc.row!][dragSrc.col!]

      if (!tile) return state

      if (target.to === 'grid') {
        const { row, col } = target
        if (dragSrc.from === 'rack') {
          if (dragSrc.rackIdx === undefined) return state
          rack.splice(dragSrc.rackIdx, 1)
          const displaced = grid[row][col]
          grid[row][col] = tile
          if (displaced) rack.push(displaced)
        } else {
          if (dragSrc.row === undefined || dragSrc.col === undefined) return state
          grid[dragSrc.row][dragSrc.col] = grid[row][col]
          grid[row][col] = tile
        }
      } else {
        if (dragSrc.from === 'rack') return state
        if (dragSrc.row === undefined || dragSrc.col === undefined) return state
        grid[dragSrc.row][dragSrc.col] = null
        rack.push(tile)
      }

      const newWon = rack.length === 0 && validateGrid(grid)
      let newInvalidCells = new Set<string>()
      if (rack.length === 0 && !newWon) {
        newInvalidCells = getInvalidCells(grid)
        newInvalidCells.add(`__v:${Date.now()}`)
      }
      return {
        ...state,
        grid,
        rack,
        history: [...state.history, snapshot],
        moves: state.moves + 1,
        won: newWon,
        invalidCells: newInvalidCells,
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
        invalidCells: new Set(),
      }
    }

    case 'RESET': {
      if (state.history.length === 0) return state
      const initial = state.history[0]
      return {
        ...state,
        grid: initial.grid,
        rack: initial.rack,
        history: [],
        moves: 0,
        undos: 0,
        won: false,
        invalidCells: new Set(),
      }
    }

    case 'SET_WON':
      return { ...state, won: action.won, invalidCells: new Set() }
  }
}

const INIT: State = {
  grid: [],
  rack: [],
  history: [],
  moves: 0,
  undos: 0,
  won: false,
  optimalMoves: 0,
  invalidCells: new Set(),
}

export function usePlayState() {
  const [state, dispatch] = useReducer(reducer, INIT)

  const loadPuzzle = useCallback((p: Puzzle) => {
    dispatch({ type: 'LOAD', puzzle: p })
  }, [])

  const drop = useCallback((src: DragSrc, target: DropTarget) => {
    dispatch({ type: 'DROP', src, target })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
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
    optimalMoves: state.optimalMoves,
    invalidCells: state.invalidCells,
    drop,
    undo,
    reset,
    loadPuzzle,
    setWon,
  }
}
