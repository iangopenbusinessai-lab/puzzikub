export interface Tile {
  n: number
  c: 'r' | 'b' | 'a' | 'k'
}

export const NUM_COLOR: Record<Tile['c'], string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222',
}

export type Difficulty = 'easy' | 'medium' | 'hard'

// Grid dimensions vary per puzzle (not always 6×10)
export type Grid = (Tile | null)[][]

export interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  grid: Grid          // partially filled — the puzzle starting state
  rack: Tile[]        // disrupted tiles the player must place
  optimalMoves: number // = number of disruptions made
  generated: boolean
}

export interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number  // when from === 'rack'
  row?: number      // when from === 'grid'
  col?: number      // when from === 'grid'
}

export type Screen = 'play' | 'editor' | 'library'
