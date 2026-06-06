import type { Tile, Grid } from '../types'

export function isValidRun(tiles: Tile[]): boolean {
  if (tiles.length < 3) return false
  const color = tiles[0].c
  if (!tiles.every(t => t.c === color)) return false
  const sorted = [...tiles].sort((a, b) => a.n - b.n)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].n !== sorted[i - 1].n + 1) return false
  }
  return true
}

export function isValidGroup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false
  const num = tiles[0].n
  if (!tiles.every(t => t.n === num)) return false
  const colors = tiles.map(t => t.c)
  return new Set(colors).size === colors.length
}

export function validateGrid(grid: Grid): boolean {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  // Must have at least one tile
  if (!grid.some(row => row.some(t => t !== null))) return false

  // Step 1 & 2: compute maximal H and V run lengths for every cell
  const hLen: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const len = end - c + 1
      for (let i = c; i <= end; i++) hLen[r][i] = len
      c = end + 1
    }
  }

  const vLen: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const len = end - r + 1
      for (let i = r; i <= end; i++) vLen[i][c] = len
      r = end + 1
    }
  }

  // Step 3 & 4: assign each tile to exactly one group (H or V)
  // Prefer the longer group when both qualify; tied lengths → invalid; unassigned → invalid
  const assign: ('h' | 'v' | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      const h = hLen[r][c]
      const v = vLen[r][c]
      const inH = h >= 3
      const inV = v >= 3
      if (inH && inV) {
        if (h === v) return false   // tied — ambiguous, invalid
        assign[r][c] = h > v ? 'h' : 'v'
      } else if (inH) {
        assign[r][c] = 'h'
      } else if (inV) {
        assign[r][c] = 'v'
      } else {
        return false                // isolated tile or pair — invalid
      }
    }
  }

  // Step 5–8: validate each contiguous sequence of H-assigned tiles per row
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (assign[r][c] !== 'h') { c++; continue }
      let end = c
      while (end + 1 < cols && assign[r][end + 1] === 'h') end++
      const len = end - c + 1
      if (len < 3) return false
      const tiles = grid[r].slice(c, end + 1) as Tile[]
      if (!isValidRun(tiles) && !isValidGroup(tiles)) return false
      c = end + 1
    }
  }

  // Step 5–8: validate each contiguous sequence of V-assigned tiles per col
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (assign[r][c] !== 'v') { r++; continue }
      let end = r
      while (end + 1 < rows && assign[end + 1][c] === 'v') end++
      const len = end - r + 1
      if (len < 3) return false
      const tiles = grid.slice(r, end + 1).map(row => row[c]) as Tile[]
      if (!isValidRun(tiles) && !isValidGroup(tiles)) return false
      r = end + 1
    }
  }

  return true
}
