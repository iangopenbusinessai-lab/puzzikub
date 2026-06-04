import type { Tile, SetRow, Grid } from '../types'

/** A run: same color, consecutive numbers, min length 3 */
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

/** A group: same number, all different colors, min length 3 */
export function isValidGroup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false
  const num = tiles[0].n
  if (!tiles.every(t => t.n === num)) return false
  const colors = tiles.map(t => t.c)
  return new Set(colors).size === colors.length
}

export function isValidSet(row: SetRow): boolean {
  const tiles = row.filter((t): t is Tile => t !== null)
  if (tiles.length < 3) return false
  return isValidRun(tiles) || isValidGroup(tiles)
}

/** True when every slot in the row is filled and the set is valid */
export function setComplete(row: SetRow): boolean {
  return row.every(t => t !== null) && isValidSet(row)
}

/**
 * Grid win check.
 * Every non-null tile must belong to at least one valid horizontal or
 * vertical contiguous group (3+ tiles forming a valid run or group).
 * Isolated tiles and pairs are always invalid.
 */
export function isValidGrid(grid: Grid): boolean {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return false

  const covered: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  )

  // Horizontal scan
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const tiles = grid[r].slice(c, end + 1) as Tile[]
      if (tiles.length >= 3 && (isValidRun(tiles) || isValidGroup(tiles))) {
        for (let i = c; i <= end; i++) covered[r][i] = true
      }
      c = end + 1
    }
  }

  // Vertical scan
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const tiles = grid.slice(r, end + 1).map(row => row[c]) as Tile[]
      if (tiles.length >= 3 && (isValidRun(tiles) || isValidGroup(tiles))) {
        for (let i = r; i <= end; i++) covered[i][c] = true
      }
      r = end + 1
    }
  }

  // Every non-null tile must be covered by a valid set
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null && !covered[r][c]) return false
    }
  }
  return true
}
