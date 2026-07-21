// ---------------------------------------------------------------------------
// dragIdentity.verify.ts — m=2 migration Step 9, the programmatically checkable
// half. Run via `npx tsx src/lib/dragIdentity.verify.ts`.
//
// THE BUG THIS EXISTS TO PREVENT: two copies of a duplicate (value, colour) are
// visually identical. If any "is this tile being dragged" test were ever written
// as a value+colour comparison instead of a positional/identity one, dragging ONE
// copy would dim BOTH — visibly broken, and it would leak to the player that the
// two tiles are "the same", which real Rummikub never reveals.
//
// The live components cannot be rendered here (no DOM), so this file reproduces
// their dim predicates EXACTLY as written and drives them with duplicate-bearing
// state — then asserts, by reading the real source files, that the predicates in
// this file are still the predicates the components use. If someone rewrites
// Rack.tsx's comparison to value+colour, section 3 fails.
//
// The visual half (actually dragging in a browser) cannot be done from a
// non-interactive session and is handed off as manual steps — see the report.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import type { Tile, DragSrc } from '../types'
import { makeTile } from '../types'

let pass = 0, fail = 0
const check = (l: string, ok: boolean) => { if (ok) { pass++; console.log(`  PASS  ${l}`) } else { fail++; console.log(`  FAIL  ${l}`) } }

console.log('=== m=2 STEP 9: drag identity must be POSITIONAL, never value+colour ===\n')

// ===========================================================================
// 1. Rack: the real predicate, driven with BOTH copies of a duplicate present.
// ===========================================================================
console.log('1. Rack.tsx dim predicate with two identical tiles in the rack')
{
  // A rack holding both copies of 5r, plus an unrelated tile.
  const rack: Tile[] = [makeTile(5, 'r', 0), makeTile(9, 'b', 0), makeTile(5, 'r', 1)]
  console.log(`   rack: [${rack.map(t => `${t.n}${t.c}#${t.id.slice(-1)}`).join(', ')}]`)

  // Rack.tsx, verbatim:
  //   const draggingRackIdx = drag?.src.from === 'rack' ? drag.src.rackIdx : undefined
  //   dimmed={draggingRackIdx === i}
  const dimFlags = (drag: { src: DragSrc } | null): boolean[] => {
    const draggingRackIdx = drag?.src.from === 'rack' ? drag.src.rackIdx : undefined
    return rack.map((_, i) => draggingRackIdx === i)
  }

  // Drag the FIRST copy of 5r (index 0).
  const dragFirst = dimFlags({ src: { from: 'rack', rackIdx: 0 } })
  console.log(`   dragging rack[0] (5r#0) -> dimmed = [${dragFirst.join(', ')}]`)
  check('dragging copy #0 dims copy #0', dragFirst[0] === true)
  check('dragging copy #0 leaves the OTHER copy (5r#1) undimmed', dragFirst[2] === false)
  check('dragging copy #0 leaves the unrelated tile undimmed', dragFirst[1] === false)
  check('exactly ONE tile is dimmed', dragFirst.filter(Boolean).length === 1)

  // Drag the SECOND copy of 5r (index 2) — the mirror case.
  const dragSecond = dimFlags({ src: { from: 'rack', rackIdx: 2 } })
  console.log(`   dragging rack[2] (5r#1) -> dimmed = [${dragSecond.join(', ')}]`)
  check('dragging copy #1 dims copy #1', dragSecond[2] === true)
  check('dragging copy #1 leaves copy #0 undimmed', dragSecond[0] === false)
  check('exactly ONE tile is dimmed (mirror case)', dragSecond.filter(Boolean).length === 1)

  // Nothing dragged, and dragging from the GRID, must dim nothing in the rack.
  check('no drag dims nothing', dimFlags(null).every(d => !d))
  check('dragging a GRID tile dims nothing in the rack',
    dimFlags({ src: { from: 'grid', row: 0, col: 0 } }).every(d => !d))

  // The counterfactual: what the forbidden implementation WOULD do. This is not
  // the shipped code — it is here to show the failure is real, not theoretical.
  const dragged = rack[0]
  const byValueColour = rack.map(t => t.n === dragged.n && t.c === dragged.c)
  console.log(`   [counterfactual] if compared by (n,c): dimmed = [${byValueColour.join(', ')}]  <- BOTH copies`)
  check('counterfactual confirms the bug is real: value+colour would dim 2 tiles',
    byValueColour.filter(Boolean).length === 2)
  check('the shipped predicate does NOT behave like the counterfactual',
    dragFirst.filter(Boolean).length !== byValueColour.filter(Boolean).length)
}

// ===========================================================================
// 2. Board: same test, two identical tiles on the grid.
// ===========================================================================
console.log('\n2. Board.tsx dim predicate with two identical tiles on the board')
{
  // Board.tsx, verbatim:
  //   const srcRow = drag?.src.from === 'grid' ? drag.src.row : undefined
  //   const srcCol = drag?.src.from === 'grid' ? drag.src.col : undefined
  //   const isDraggingSrc = srcRow === r && srcCol === c
  const grid: (Tile | null)[][] = [
    [makeTile(5, 'r', 0), null, makeTile(5, 'r', 1)],
    [makeTile(9, 'b', 0), null, null],
  ]
  const dimAt = (drag: { src: DragSrc } | null) => {
    const srcRow = drag?.src.from === 'grid' ? drag.src.row : undefined
    const srcCol = drag?.src.from === 'grid' ? drag.src.col : undefined
    const out: string[] = []
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[0].length; c++)
        if (grid[r][c] && srcRow === r && srcCol === c) out.push(`${r},${c}`)
    return out
  }
  const d = dimAt({ src: { from: 'grid', row: 0, col: 0 } })
  console.log(`   grid holds 5r#0 at (0,0) and 5r#1 at (0,2); dragging (0,0) -> dimmed cells ${JSON.stringify(d)}`)
  check('dragging one board copy dims exactly that cell', d.length === 1 && d[0] === '0,0')
  check('the identical tile at (0,2) is NOT dimmed', !d.includes('0,2'))
  const d2 = dimAt({ src: { from: 'grid', row: 0, col: 2 } })
  check('mirror: dragging (0,2) dims only (0,2)', d2.length === 1 && d2[0] === '0,2')
  check('dragging a RACK tile dims nothing on the board',
    dimAt({ src: { from: 'rack', rackIdx: 0 } }).length === 0)
}

// ===========================================================================
// 3. SOURCE AUDIT — the checks above only prove the predicates *in this file*.
//    These assert the real components still contain those predicates and no
//    value+colour comparison, so this harness cannot drift from the shipped code.
// ===========================================================================
console.log('\n3. Source audit of the real components')
{
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  const rack = read('components/Rack.tsx')
  const board = read('components/Board.tsx')
  const tileFace = read('components/TileFace.tsx')
  const dragPreview = read('components/DragPreview.tsx')
  const useDrag = read('hooks/useDrag.ts')

  check('Rack.tsx dims by rack INDEX (positional)', rack.includes('dimmed={draggingRackIdx === i}'))
  check('Rack.tsx keys rows by tile.id (not array index)', rack.includes('key={tile.id}') && !/key=\{i\}/.test(rack))
  check('Board.tsx dims by grid row/col (positional)',
    board.includes('const isDraggingSrc = srcRow === r && srcCol === c') && board.includes('dimmed={isDraggingSrc}'))
  check('Board.tsx keys cells by position, not tile identity',
    board.includes('`${r}-${c}`') && !board.includes('key={tile.id}'))

  // The forbidden pattern: comparing a rendered tile's value+colour to the
  // dragged tile's. Anything of the form `tile.n === drag...` / `.c === drag...`.
  //
  // Comments are stripped first. Rack.tsx's own warning comment spells the
  // forbidden pattern out verbatim as an example of what not to write, and an
  // un-stripped scan flags it — which is a false positive, but a useful one: it
  // confirmed this detector actually fires rather than passing vacuously.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  const forbidden = /\.\s*n\s*===\s*[^;)\n]*drag|\.\s*c\s*===\s*[^;)\n]*drag|drag[^;)\n]*\.\s*n\s*===|drag[^;)\n]*\.\s*c\s*===/
  for (const [name, src] of [['Rack.tsx', rack], ['Board.tsx', board], ['TileFace.tsx', tileFace], ['DragPreview.tsx', dragPreview], ['useDrag.ts', useDrag]] as const) {
    check(`${name} contains no value/colour-vs-drag comparison (code, comments stripped)`, !forbidden.test(stripComments(src)))
  }
  // Prove the detector is not vacuous: it must flag the pattern when present.
  check('the forbidden-pattern detector actually fires on a planted violation',
    forbidden.test('dimmed={tile.n === drag.tile.n && tile.c === drag.tile.c}'))

  // No visual distinction for duplicates: TileFace must render from n/c only.
  check('TileFace.tsx never reads tile.id (duplicates render identically)', !tileFace.includes('tile.id'))
  check('DragPreview.tsx never reads tile.id', !dragPreview.includes('tile.id'))
}

// ===========================================================================
// 4. The invariant key={tile.id} depends on: ids unique within a rack.
// ===========================================================================
console.log('\n4. Rack ids are unique (what makes key={tile.id} legal)')
{
  const rack: Tile[] = [makeTile(5, 'r', 0), makeTile(5, 'r', 1), makeTile(9, 'b', 0)]
  const ids = rack.map(t => t.id)
  console.log(`   both copies of 5r in one rack -> ids ${ids.join(', ')}`)
  check('the two copies have DISTINCT ids', new Set(ids).size === ids.length)
  check('they are nevertheless identical in value and colour',
    rack[0].n === rack[1].n && rack[0].c === rack[1].c)
}

console.log(`\n=== SELF-CHECKS: ${pass} passed, ${fail} failed ===`)
