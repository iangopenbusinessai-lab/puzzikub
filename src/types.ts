export interface Tile {
  n: number
  c: 'r' | 'b' | 'a' | 'k'
}

export type SetRow = (Tile | null)[]

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
  from: 'rack' | 'board'
  rackIdx?: number
  setIdx?: number
  tileIdx?: number
}
