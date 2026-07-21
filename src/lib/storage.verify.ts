// ---------------------------------------------------------------------------
// storage.verify.ts — m=2 migration Step 8. Run via
// `npx tsx src/lib/storage.verify.ts`.
//
// This is the ONE step that touches real persisted user data (the
// `puzzikub_library` localStorage key), so the bar is: a puzzle a real person
// saved before ids existed must come back with ids, otherwise unchanged, and
// still play.
//
// ON TEST DATA — stated plainly rather than implied. This session cannot read a
// browser profile's localStorage, so the legacy blobs below are SYNTHETIC. They
// are not guessed at, though: the pre-migration `Tile` was exactly `{ n, c }`
// (confirmed by reading src/types.ts at commit aeafc4a, the commit before Step 1
// added `id`), and the pre-migration SEED_PUZZLES literal is reproduced verbatim
// from that same commit's storage.ts. So the blob shape is the real one.
//
// The strongest evidence here is section 3: a REAL generated puzzle has its ids
// stripped — reproducing exactly what that puzzle would have looked like in an
// old save — and the migration must reconstruct it byte-identically.
// ---------------------------------------------------------------------------

import type { Puzzle, Tile } from '../types'
import { makeTile, TILE_COPIES } from '../types'
import { migrateLibrary, loadLibrary, saveLibrary } from './storage'
import { usedIds, mintTile } from './editorRules'
import { validateGrid, getInvalidCells } from './validator'
import { solveBagM2 } from './solver'
import { isTrivial, formsValidSetAlone, existsNoRelocationWin } from './archetypes'
import { generatePuzzle } from './generator'

let pass = 0, fail = 0
const check = (label: string, ok: boolean) => {
  if (ok) { pass++; console.log(`  PASS  ${label}`) }
  else { fail++; console.log(`  FAIL  ${label}`) }
}

// A minimal localStorage so loadLibrary/saveLibrary can be exercised for real
// rather than only through migrateLibrary.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
}
const KEY = 'puzzikub_library'

/** Strip every `id`, producing exactly the shape a pre-migration save had. */
function stripIds(p: Puzzle): unknown {
  return JSON.parse(JSON.stringify({
    ...p,
    grid: p.grid.map(r => r.map(t => (t ? { n: t.n, c: t.c } : null))),
    rack: p.rack.map(t => ({ n: t.n, c: t.c })),
  }))
}

const allTilesOf = (p: Puzzle): Tile[] => [...p.grid.flat().filter((t): t is Tile => t !== null), ...p.rack]
const idsOf = (p: Puzzle) => allTilesOf(p).map(t => t.id)

console.log('=== m=2 STEP 8: storage + editor id migration ===\n')

// ===========================================================================
// 1. The legacy blob: verbatim pre-migration SEED_PUZZLES (git aeafc4a).
// ===========================================================================
console.log('1. Legacy (id-less) library blob -> loadLibrary()')
{
  const LEGACY = [
    {
      id: 'seed1', name: 'First steps', diff: 'easy',
      grid: Array.from({ length: 6 }, () => Array(10).fill(null)),
      rack: [{ n: 6, c: 'r' }, { n: 9, c: 'k' }, { n: 4, c: 'r' }, { n: 5, c: 'r' }, { n: 9, c: 'b' }, { n: 9, c: 'r' }],
      optimalMoves: 6, generated: false,
    },
    {
      id: 'seed3', name: 'Triple threat', diff: 'hard',
      grid: Array.from({ length: 6 }, () => Array(10).fill(null)),
      rack: [{ n: 4, c: 'r' }, { n: 10, c: 'k' }, { n: 8, c: 'k' }, { n: 3, c: 'r' }, { n: 5, c: 'r' }, { n: 10, c: 'b' }, { n: 10, c: 'a' }, { n: 7, c: 'k' }, { n: 9, c: 'k' }],
      optimalMoves: 9, generated: false,
    },
  ]
  store.clear()
  store.set(KEY, JSON.stringify(LEGACY))
  const loaded = loadLibrary()

  check('both legacy puzzles survive the load (nothing dropped)', loaded.length === 2)
  const everyTileHasId = loaded.every(p => allTilesOf(p).every(t => typeof t.id === 'string' && t.id.length > 0))
  check('every tile now carries a real id', everyTileHasId)
  const idsUnique = loaded.every(p => new Set(idsOf(p)).size === idsOf(p).length)
  check('ids are unique within each puzzle', idsUnique)

  // Structure must be otherwise untouched.
  const p0 = loaded[0]
  check('puzzle id / name / diff / optimalMoves / generated unchanged',
    p0.id === 'seed1' && p0.name === 'First steps' && p0.diff === 'easy' && p0.optimalMoves === 6 && p0.generated === false)
  check('rack length and (n,c) sequence unchanged',
    p0.rack.length === 6 && p0.rack.map(t => `${t.n}${t.c}`).join(',') === '6r,9k,4r,5r,9b,9r')
  check('grid dimensions unchanged', p0.grid.length === 6 && p0.grid[0].length === 10)

  console.log(`     seed1 minted ids: ${p0.rack.map(t => t.id).join('  ')}`)
  check('ids are the structured (n,c,occurrence) scheme, all copy 0 here',
    p0.rack.map(t => t.id).join(',') === '6_r_0,9_k_0,4_r_0,5_r_0,9_b_0,9_r_0')
}

// ===========================================================================
// 2. Legacy blob CONTAINING DUPLICATES — the case the id scheme exists for.
// ===========================================================================
console.log('\n2. Legacy blob with duplicate (value,colour) tiles')
{
  const LEGACY = [{
    id: 'dup1', name: 'Dupes', diff: 'hard',
    // 5r appears on the grid AND in the rack; 7b appears twice on the grid.
    grid: [
      [{ n: 5, c: 'r' }, { n: 7, c: 'b' }, null],
      [{ n: 7, c: 'b' }, null, { n: 9, c: 'a' }],
    ],
    rack: [{ n: 5, c: 'r' }, { n: 9, c: 'a' }],
    optimalMoves: 4, generated: false,
  }]
  const { puzzles, stats } = migrateLibrary(LEGACY)
  const p = puzzles[0]
  const ids = idsOf(p)
  console.log(`     ids in scan order (grid row-major, then rack): ${ids.join('  ')}`)
  check('scan order is grid row-major then rack, copies numbered by occurrence',
    ids.join(',') === '5_r_0,7_b_0,7_b_1,9_a_0,5_r_1,9_a_1')
  check('all ids distinct', new Set(ids).size === ids.length)
  check('the two 7b copies are distinguishable', p.grid[0][1]!.id !== p.grid[1][0]!.id)
  check('the grid 5r and the rack 5r are distinguishable', p.grid[0][0]!.id !== p.rack[0].id)
  check('stats report one migrated puzzle, 6 tiles minted, 0 over cap',
    stats.puzzlesMigrated === 1 && stats.tilesMinted === 6 && stats.countOverCap === 0)
}

// ===========================================================================
// 3. THE REAL-DATA TEST: strip ids off a genuinely generated puzzle (exactly
//    what an old save of it looked like), migrate, and demand it come back
//    byte-identical AND still pass the fresh-puzzle validity suite.
// ===========================================================================
console.log('\n3. Real generated puzzles: strip ids -> migrate -> must be identical AND playable')
{
  let identical = 0, valid = 0, total = 0
  let firstMismatch = ''
  for (const diff of ['easy', 'medium', 'hard', 'extreme'] as const) {
    for (let i = 0; i < 25; i++) {
      const fresh = generatePuzzle(diff)
      if (!fresh) continue
      total++
      const legacy = stripIds(fresh)
      const { puzzles } = migrateLibrary([legacy])
      const back = puzzles[0]

      // Byte-identical: an m=1-shaped puzzle is all copy 0, so occurrence-index
      // minting must reproduce the original ids exactly.
      const same = JSON.stringify(back) === JSON.stringify(JSON.parse(JSON.stringify(fresh)))
      if (same) identical++
      else if (!firstMismatch) firstMismatch = `${diff}#${i}`

      // Same suite a freshly-generated puzzle is held to.
      const all = allTilesOf(back)
      const ok = validateGrid(back.grid)
        && getInvalidCells(back.grid).size === 0
        && solveBagM2(all).solvable
        && !formsValidSetAlone(back.rack)
        && !existsNoRelocationWin(back.grid, back.rack).win
        && !isTrivial(back.grid, back.rack)
        && back.optimalMoves > 0
      if (ok) valid++
    }
  }
  console.log(`     ${total} real puzzles (25 per difficulty, all archetype layers)`)
  console.log(`     stripped -> migrated -> byte-identical to the original : ${identical}/${total}${firstMismatch ? ` (first mismatch ${firstMismatch})` : ''}`)
  console.log(`     migrated puzzle passes the full fresh-puzzle validity suite : ${valid}/${total}`)
  check('migration reconstructs real puzzles byte-identically', identical === total)
  check('migrated puzzles are still valid, solvable, non-trivial and playable', valid === total)
}

// ===========================================================================
// 4. Requirement 3: a FRESH puzzle (ids already present) must round-trip
//    through save -> load completely unchanged. The migration path must never
//    touch a puzzle that already has identity.
// ===========================================================================
console.log('\n4. Fresh puzzle save -> load round-trip must not alter anything')
{
  let unchanged = 0, kept = 0, minted = 0
  const N = 40
  for (let i = 0; i < N; i++) {
    const fresh = generatePuzzle((['easy', 'medium', 'hard', 'extreme'] as const)[i % 4])
    if (!fresh) continue
    store.clear()
    saveLibrary([fresh])
    const back = loadLibrary()[0]
    if (JSON.stringify(back) === JSON.stringify(JSON.parse(JSON.stringify(fresh)))) unchanged++
    const { stats } = migrateLibrary(JSON.parse(JSON.stringify([fresh])))
    kept += stats.tilesKept
    minted += stats.tilesMinted
  }
  console.log(`     ${unchanged}/${N} round-tripped byte-identically`)
  console.log(`     across those ${N} puzzles the migrator KEPT ${kept} tiles and minted ${minted}`)
  check('fresh puzzles round-trip unchanged through save/load', unchanged === N)
  check('nothing is re-minted on a puzzle that already has ids', minted === 0 && kept > 0)

  // Idempotence: migrating an already-migrated blob changes nothing.
  const fresh = generatePuzzle('hard')!
  const once = migrateLibrary([stripIds(fresh)]).puzzles
  const twice = migrateLibrary(JSON.parse(JSON.stringify(once))).puzzles
  check('migration is idempotent (migrate twice == migrate once)',
    JSON.stringify(once) === JSON.stringify(twice))
}

// ===========================================================================
// 5. Hostile / partial blobs — the paths that could destroy real user data.
// ===========================================================================
console.log('\n5. Partial and damaged blobs must not cost the user their library')
{
  // 5a. MIXED: one tile already has an id, its twin does not. The minted one
  // must not collide with the surviving one.
  const mixed = [{
    id: 'mix', name: 'Mixed', diff: 'easy',
    grid: [[{ n: 4, c: 'b', id: '4_b_1' }, { n: 4, c: 'b' }, null]],
    rack: [], optimalMoves: 1, generated: false,
  }]
  const m = migrateLibrary(mixed).puzzles[0]
  console.log(`     mixed blob ids: ${m.grid[0][0]!.id}  ${m.grid[0][1]!.id}`)
  check('pre-existing id is preserved exactly', m.grid[0][0]!.id === '4_b_1')
  check('minted twin skips the taken copy index (no collision)',
    m.grid[0][1]!.id === '4_b_0' && m.grid[0][0]!.id !== m.grid[0][1]!.id)

  // 5b. OVER-CAP legacy data: three copies. Nothing may be dropped.
  const over = [{
    id: 'over', name: 'Over', diff: 'easy',
    grid: [[{ n: 2, c: 'k' }, { n: 2, c: 'k' }, { n: 2, c: 'k' }]],
    rack: [], optimalMoves: 1, generated: false,
  }]
  const res = migrateLibrary(over)
  const o = res.puzzles[0]
  const oIds = o.grid[0].filter((t): t is Tile => t !== null).map(t => t.id)
  console.log(`     over-cap blob (3 copies) ids: ${oIds.join('  ')}   countOverCap=${res.stats.countOverCap}`)
  check('over-cap legacy tiles are all PRESERVED, none dropped', oIds.length === 3)
  check('over-cap tiles still get distinct ids', new Set(oIds).size === 3)
  check('over-cap condition is reported rather than hidden', res.stats.countOverCap === 1)

  // 5c. One unreadable entry must not take the rest of the library with it.
  const partly = [
    { id: 'good', name: 'Good', diff: 'easy', grid: [[{ n: 3, c: 'r' }]], rack: [], optimalMoves: 1, generated: false },
    { id: 'bad', name: 'Bad', diff: 'easy', grid: 'not-a-grid', rack: [], optimalMoves: 1, generated: false },
    { id: 'good2', name: 'Good2', diff: 'easy', grid: [[{ n: 8, c: 'a' }]], rack: [], optimalMoves: 1, generated: false },
  ]
  const pr = migrateLibrary(partly)
  console.log(`     partly-damaged blob: kept ${pr.puzzles.length}, skipped ${pr.stats.puzzlesSkipped}`)
  check('a single damaged entry does not discard the healthy ones',
    pr.puzzles.length === 2 && pr.stats.puzzlesSkipped === 1)
  check('the healthy survivors are properly migrated',
    pr.puzzles[0].grid[0][0]!.id === '3_r_0' && pr.puzzles[1].grid[0][0]!.id === '8_a_0')

  // 5d. Absent key -> seeds, and the seeds themselves must carry ids.
  store.clear()
  const seeded = loadLibrary()
  check('absent key still seeds the library', seeded.length === 3)
  check('SEED_PUZZLES tiles all carry real ids',
    seeded.every(p => allTilesOf(p).every(t => typeof t.id === 'string' && t.id.startsWith(`${t.n}_${t.c}_`))))

  // 5e. Corrupt JSON -> seeds, not a crash.
  store.clear()
  store.set(KEY, '{not json at all')
  check('corrupt JSON falls back to seeds instead of throwing', loadLibrary().length === 3)

  // 5f. The original blob must NOT be rewritten by a mere load — a bug in the
  // migrator must not be able to destroy the user's saved data.
  store.clear()
  const legacyRaw = JSON.stringify([{
    id: 'keep', name: 'Keep', diff: 'easy',
    grid: [[{ n: 3, c: 'r' }]], rack: [], optimalMoves: 1, generated: false,
  }])
  store.set(KEY, legacyRaw)
  loadLibrary()
  check('loadLibrary does not overwrite the stored blob (original survives a load)',
    store.get(KEY) === legacyRaw)
}

// ===========================================================================
// 6. Requirement 4: the editor's TILE_COPIES cap actually refuses a third copy.
//    Tested against the real rule functions useEditor calls (src/lib/editorRules
//    — pure, which is why they live in lib rather than in the hook).
// ===========================================================================
console.log(`\n6. Editor cap — a third copy of any (value,colour) is REFUSED (TILE_COPIES=${TILE_COPIES})`)
{
  // Simulate the exact sequence useEditor.addRackTile performs.
  const grid: (Tile | null)[][] = [[null, null, null], [null, null, null]]
  const rack: Tile[] = []
  const addToRack = (n: number, c: Tile['c']): boolean => {
    const t = mintTile({ n, c }, usedIds(grid, rack))
    if (!t) return false
    rack.push(t)
    return true
  }

  const first = addToRack(5, 'r')
  const second = addToRack(5, 'r')
  const third = addToRack(5, 'r')
  console.log(`     add 5r x3 -> ${first}, ${second}, ${third}   rack now: ${rack.map(t => t.id).join(' ')}`)
  check('first copy accepted', first === true)
  check('second copy accepted (m=2 allows exactly TILE_COPIES)', second === true)
  check('THIRD copy REFUSED', third === false)
  check('the refused copy really was not added', rack.length === TILE_COPIES)
  check('the two accepted copies got distinct ids', rack[0].id === '5_r_0' && rack[1].id === '5_r_1')

  // The cap counts grid + rack together, not each in isolation.
  const g2: (Tile | null)[][] = [[makeTile(7, 'b', 0), makeTile(7, 'b', 1)]]
  const r2: Tile[] = []
  check('cap spans grid AND rack (grid already holds both copies -> rack add refused)',
    mintTile({ n: 7, c: 'b' }, usedIds(g2, r2)) === null)

  // Overwriting a slot must not count the tile being replaced against itself.
  const g3: (Tile | null)[][] = [[makeTile(9, 'k', 0), makeTile(9, 'k', 1)]]
  const reuse = mintTile({ n: 9, c: 'k' }, usedIds(g3, [], { kind: 'grid', row: 0, col: 1 }))
  check('re-picking an existing tile is not treated as a new copy', reuse !== null && reuse.id === '9_k_1')

  // And a different (value,colour) is of course still free.
  check('an unrelated tile is unaffected by another tile being capped',
    mintTile({ n: 6, c: 'a' }, usedIds(g2, r2))?.id === '6_a_0')

  // A capped puzzle is exactly what solveBagM2 rejects — the reason for the cap.
  const overCapBag = [makeTile(5, 'r', 0), makeTile(5, 'r', 1), makeTile(5, 'r', 2), makeTile(6, 'r'), makeTile(7, 'r')]
  check('justification: solveBagM2 rejects an over-cap bag outright',
    solveBagM2(overCapBag).solvable === false)
}

console.log(`\n=== SELF-CHECKS: ${pass} passed, ${fail} failed ===`)
