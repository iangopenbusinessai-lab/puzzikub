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

// ── Shared scanning logic ─────────────────────────────────────────────────────

type GroupCell = { r: number; c: number }
type Group = { tiles: Tile[]; cells: GroupCell[] }
type GroupMaps = {
  hGroups: Group[]
  vGroups: Group[]
  hOf: (Group | null)[][]
  vOf: (Group | null)[][]
}

function buildGroups(grid: Grid): GroupMaps {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const hGroups: Group[] = []
  const hOf: (Group | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))

  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!grid[r][c]) { c++; continue }
      let end = c
      while (end + 1 < cols && grid[r][end + 1]) end++
      const tiles: Tile[] = []
      const cells: GroupCell[] = []
      for (let i = c; i <= end; i++) { tiles.push(grid[r][i] as Tile); cells.push({ r, c: i }) }
      const g: Group = { tiles, cells }
      hGroups.push(g)
      for (let i = c; i <= end; i++) hOf[r][i] = g
      c = end + 1
    }
  }

  const vGroups: Group[] = []
  const vOf: (Group | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))

  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!grid[r][c]) { r++; continue }
      let end = r
      while (end + 1 < rows && grid[end + 1][c]) end++
      const tiles: Tile[] = []
      const cells: GroupCell[] = []
      for (let i = r; i <= end; i++) { tiles.push(grid[i][c] as Tile); cells.push({ r: i, c }) }
      const g: Group = { tiles, cells }
      vGroups.push(g)
      for (let i = r; i <= end; i++) vOf[i][c] = g
      r = end + 1
    }
  }

  return { hGroups, vGroups, hOf, vOf }
}

// ── Public API ────────────────────────────────────────────────────────────────

function isCovered(hGroup: Group | null, vGroup: Group | null): boolean {
  if (hGroup && hGroup.cells.length >= 3 && (isValidRun(hGroup.tiles) || isValidGroup(hGroup.tiles))) return true
  if (vGroup && vGroup.cells.length >= 3 && (isValidRun(vGroup.tiles) || isValidGroup(vGroup.tiles))) return true
  return false
}

export function validateGrid(grid: Grid): boolean {
  if (!grid.some(row => row.some(t => t !== null))) return false

  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const { hOf, vOf } = buildGroups(grid)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      if (!isCovered(hOf[r][c], vOf[r][c])) return false
    }
  }

  return true
}

export function getInvalidCells(grid: Grid): Set<string> {
  const invalid = new Set<string>()
  if (!grid.some(row => row.some(t => t !== null))) return invalid

  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const { hOf, vOf } = buildGroups(grid)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      if (!isCovered(hOf[r][c], vOf[r][c])) invalid.add(`${r},${c}`)
    }
  }

  return invalid
}
