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
 * isValidGrid: used internally by usePlayState for background win tracking.
 * Tiles may be covered by either an H or V valid set (lenient).
 */
export function isValidGrid(grid: Grid): boolean {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return false

  const covered: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  )

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

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null && !covered[r][c]) return false
    }
  }
  return true
}

/**
 * validateGrid: strict check triggered by the Check button.
 * Every tile must belong to exactly one valid set — horizontal OR vertical, not both.
 * Tiles at intersections (with both H and V neighbors) are always invalid.
 * Isolated tiles and pairs are always invalid.
 * Every group must be 3+ tiles forming a valid run or group.
 */
export function validateGrid(grid: Grid): boolean {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return false

  // Compute maximal H-group size for each cell
  const hSize: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const size = end - c + 1
      for (let i = c; i <= end; i++) hSize[r][i] = size
      c = end + 1
    }
  }

  // Compute maximal V-group size for each cell
  const vSize: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const size = end - r + 1
      for (let i = r; i <= end; i++) vSize[i][c] = size
      r = end + 1
    }
  }

  // Check membership and validate each non-null tile
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue

      const inH = hSize[r][c] >= 2
      const inV = vSize[r][c] >= 2

      if (inH && inV) return false   // intersection — belongs to both groups
      if (!inH && !inV) return false // isolated tile
    }
  }

  // Validate every H-group of size >= 2
  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const size = end - c + 1
      if (size >= 2) {
        const tiles = grid[r].slice(c, end + 1) as Tile[]
        if (size < 3 || (!isValidRun(tiles) && !isValidGroup(tiles))) return false
      }
      c = end + 1
    }
  }

  // Validate every V-group of size >= 2
  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const size = end - r + 1
      if (size >= 2) {
        const tiles = grid.slice(r, end + 1).map(row => row[c]) as Tile[]
        if (size < 3 || (!isValidRun(tiles) && !isValidGroup(tiles))) return false
      }
      r = end + 1
    }
  }

  return true
}
