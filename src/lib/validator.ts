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

  type Group = { tiles: Tile[]; len: number }

  // Step 1: collect all H groups (every maximal horizontal contiguous run).
  const hGroups: Group[] = []
  const hOf: (Group | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))

  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const tiles = grid[r].slice(c, end + 1) as Tile[]
      const g: Group = { tiles, len: tiles.length }
      hGroups.push(g)
      for (let i = c; i <= end; i++) hOf[r][i] = g
      c = end + 1
    }
  }

  // Step 2: collect all V groups (every maximal vertical contiguous run).
  const vGroups: Group[] = []
  const vOf: (Group | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))

  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const tiles = grid.slice(r, end + 1).map(row => row[c]) as Tile[]
      const g: Group = { tiles, len: tiles.length }
      vGroups.push(g)
      for (let i = r; i <= end; i++) vOf[i][c] = g
      r = end + 1
    }
  }

  // Step 5: every H group of length >= 3 must be a valid run or group.
  for (const g of hGroups) {
    if (g.len >= 3 && !isValidRun(g.tiles) && !isValidGroup(g.tiles)) return false
  }

  // Step 6: every V group of length >= 3 must be a valid run or group.
  // V groups of length 1-2 formed by tiles from separate horizontal sets
  // are not penalised here — Step 7 handles coverage.
  for (const g of vGroups) {
    if (g.len >= 3 && !isValidRun(g.tiles) && !isValidGroup(g.tiles)) return false
  }

  // Step 7: every tile must be covered by at least one group of length >= 3.
  // A tile in a horizontal pair (hLen=2) is fine if its V group is >= 3,
  // and vice-versa. Only tiles uncovered in both directions are invalid.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      const hLen = hOf[r][c]?.len ?? 0
      const vLen = vOf[r][c]?.len ?? 0
      if (hLen < 3 && vLen < 3) return false
    }
  }

  return true
}
