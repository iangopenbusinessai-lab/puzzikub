export interface Tile {
  n: number
  c: 'r' | 'b' | 'a' | 'k'
}

// Used by Puzzle.sets, generator, and storage — do not remove
export type SetRow = (Tile | null)[]

export type Grid = (Tile | null)[][]

export interface Puzzle {
  id: string
  name: string
  diff: 'easy' | 'medium' | 'hard'
  sets: SetRow[]
  rack: Tile[]
  hint: string
  generated: boolean
}

export interface DragSrc {
  from: 'rack' | 'grid'
  idx?: number   // rack index
  row?: number   // grid row
  col?: number   // grid col
}
