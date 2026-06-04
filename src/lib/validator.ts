import type { Tile, SetRow } from '../types'

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
