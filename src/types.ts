export interface Tile {
  n: number
  c: 'r' | 'b' | 'a' | 'k'
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export type Grid = (Tile | null)[][]

export interface Puzzle {
  id: string
  name: string
  diff: Difficulty
  rack: Tile[]
  hint: string
  generated: boolean
}

export interface DragSrc {
  from: 'rack' | 'grid'
  rackIdx?: number  // when from === 'rack'
  row?: number      // when from === 'grid'
  col?: number      // when from === 'grid'
}

export type Screen = 'play' | 'editor' | 'library'
