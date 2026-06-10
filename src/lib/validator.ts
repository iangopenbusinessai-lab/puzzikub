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

  if (!grid.some(row => row.some(t => t !== null))) return false

  // Steps 1 & 2: compute H and V group lengths for every occupied cell.
  // A tile in a vertical pair (vLen=2) is fine as long as its H group
  // covers it (hLen>=3); we only fail it in Step 7 if BOTH are < 3.
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

  // Step 5: validate every H group of length >= 3.
  // H groups of length 1 or 2 are ignored here; they are accepted iff the
  // tile is also covered by a V group of length >= 3 (checked in Step 7).
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const len = end - c + 1
      if (len >= 3) {
        const tiles = grid[r].slice(c, end + 1) as Tile[]
        if (!isValidRun(tiles) && !isValidGroup(tiles)) return false
      }
      c = end + 1
    }
  }

  // Step 6: validate every V group of length >= 3.
  // V groups of length 1 or 2 (e.g. tiles from two separate H sets that
  // happen to share a column) are not validated — they are only invalid if
  // the tile has no H group of length >= 3 either (Step 7).
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const len = end - r + 1
      if (len >= 3) {
        const tiles = grid.slice(r, end + 1).map(row => row[c]) as Tile[]
        if (!isValidRun(tiles) && !isValidGroup(tiles)) return false
      }
      r = end + 1
    }
  }

  // Step 7: every tile must be covered by at least one group of length >= 3.
  // A tile is fine in a horizontal pair (hLen=2) as long as vLen >= 3, and
  // vice-versa. Only isolated tiles or tiles in two pairs are invalid.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      if (hLen[r][c] < 3 && vLen[r][c] < 3) return false
    }
  }

  return true
}
