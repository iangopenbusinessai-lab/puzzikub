# Decoy archetype — design brief for a dedicated session

*Written July 2026, after a feasibility session proved decoys cannot be added
as a modifier on the existing pure planners. This is a RULES + INVARIANTS brief
for a future Opus/Fable-tier + plan-mode session — NOT a pre-written
implementation. Design your own approach; prove it with real executed output
per CLAUDE.md's anti-illusion rule.*

---

## Why this is its own session

A prior session tried to build a decoy as a MODIFIER over an already-valid
archetype result (add one rack tile, keep the board, reuse
`planColorRunGoal` / `planValueGroupGoal` for par + invariant (e)). A
feasibility probe over 40 real puzzles (10 each of both directions × hard +
extreme), testing every candidate tile (all 4 colours × values `s-2…s+L+2`)
for the three properties a decoy needs at once, returned **FULL DECOY = 0**
everywhere:

```
runs-to-groups / hard      boardObvious=48  trap=39  bObv&Trap=39  purePlacesD=0   FULL DECOY=0
groups-to-runs / hard      boardObvious=0   trap=34  bObv&Trap=0   purePlacesD=34  FULL DECOY=0
runs-to-groups / extreme   boardObvious=54  trap=27  bObv&Trap=27  purePlacesD=0   FULL DECOY=0
groups-to-runs / extreme   boardObvious=0   trap=36  bObv&Trap=0   purePlacesD=36  FULL DECOY=0
```

- **boardObvious** — candidate D has an obvious board placement (`obviousSpots`).
- **trap** — bag solvable, but committing D to some valid set strands the
  remainder (`solveBag(bag \ set).solvable === false`).
- **purePlacesD** — an existing pure planner outputs a goal containing D.

Two structural findings:

1. **groups-to-runs is inherently decoy-proof.** Its board is L *full* groups
   (every interior value already carries all 4 colours), so there is no run to
   extend and no group-of-3 to complete — `boardObvious = 0`. A player is never
   given a visible wrong move to be tempted by. **Do not pursue decoys here.**

2. **runs-to-groups has real, board-visible decoys — but they need a mixed
   goal.** The `bObv&Trap` tiles (39 at hard, 27 at extreme) are boundary
   run-extensions in a *board* colour (e.g. `D = {s+L, r}`): they visibly extend
   a board run, but committing to that extension strands the remainder. Their
   value sits OUTSIDE the group block, so `planValueGroupGoal` (which demands
   every value carry 3–4 distinct colours) returns `null` → `purePlacesD = 0`,
   invariant (e) fails, par is uncomputable. Their true home is a **hybrid**
   layout: one short boundary run + the rest as groups.

**Root cause:** the Latin-rectangle duality that makes both archetypes fair
(same tiles solve as all-runs AND all-groups) also makes them decoy-resistant.
The only genuine dead-ends require a hybrid run+group solution the pure
planners cannot express. So a decoy is a NEW construction with its own goal
planner and its own par proof — this session's job.

---

## The target decoy family (runs-to-groups only)

Board unchanged: 3 runs (board colours) at values `s … s+L-1`, rack is the 4th
colour `k` at interior values (never 3 consecutive). Add ONE decoy tile.

**High-side decoy** `D = {s+L, c}` where `c` is a *board* colour:

- **Tempting (wrong) move:** extend `c`'s board run at its top → `s … s+L`.
  `obviousSpots` already recognises this. Committing it strands the remainder
  (verified `solveBag = false`): `c`'s run swallows `s+L`, but then value `s+L-1`
  and `s+L-2` still need `c` for their groups, and the scattered `k` tiles have
  nowhere to go — dead end.
- **True (hidden) home:** a 3-long run `{s+L-2, s+L-1, s+L} c`. Pulling `c` out
  of values `s+L-1` and `s+L-2` forces those two values to become
  `{other-2-board-colours, k}` groups — which is only possible **iff the rack
  already carries `k` at both `s+L-1` and `s+L-2`.**

**Low-side decoy** is the mirror: `D = {s-1, c}`, true home `{s-1, s, s+1} c`,
requires rack `k` at both `s` and `s+1`.

Worked example that the probe/hand-check confirmed solvable-with-trap:
`L=5, s=1`, board r/b/a runs `1..5`, rack `{2k,4k,5k}`, decoy `D={6,r}`. Obvious
`r`-run extension `1..6` → unsolvable. True solution: run `{4,5,6}r`, groups
`{4:b,a,k}`, `{5:b,a,k}`, and `{1:r,b,a} {2:r,b,a,k} {3:r,b,a}` below.

---

## Non-negotiable invariants (verify each with real executed output)

The modifier takes a valid `runs-to-groups` result and returns an expanded
result (board unchanged, rack + decoy) OR `null` when no safe decoy exists for
this puzzle (a legitimate outcome — preconditions below often won't hold).

- **(a)** `validateGrid(board)` still true, zero invalid cells (board untouched,
  so this is automatic — assert it anyway).
- **(b)** `solveBag([...board, ...rack, D]).solvable === true` — D has a real
  home. *If this ever fails, the decoy is a bug, not a decoy* (an unsolvable
  puzzle can never satisfy the `rack.length===0 && validateGrid` win).
- **(c)** re-check `formsValidSetAlone([...rack, D])` on the EXPANDED rack — the
  decoy must not let the rack (or a subset) become a self-contained set.
- **(d)** `existsNoRelocationWin(board, [...rack, D]).win === false` and not
  `exhausted` — the expanded rack still has no no-relocation win.
- **(e)** the NEW mixed-goal planner materialises to a `validateGrid` win (use
  `goalLayoutIsReachable`-style check from `verifyEngine.ts`).
- **Decoy property, explicit:** the tempting run-extension set S satisfies
  `solveBag(allTiles \ S).solvable === false`, AND the true mixed goal places D
  somewhere. Print both, per puzzle.

---

## Par (`minMoves`) for the mixed goal

`makeCostCtx` already computes `n + rack − fixed − cycles` for ANY injective
tile→cell goal, so it should handle a hybrid layout — you supply a custom
`cellOf` mapping each tile to its mixed-goal cell. Requirements:

- Build the mixed goal deterministically (groups block + the 3-long boundary
  run), lay it out injectively and in-bounds, confirm `validateGrid` on it.
- Compute par via `makeCostCtx(...).cost()` with your `cellOf`.
- **Prove par is real, not narrated:** simulate the actual reducer move
  sequence (reuse `simulatePlan` from `verifyEngine.ts`) and require
  `simulated === par` and a `validateGrid` win, on ≥5 puzzles per difficulty.
  This is where a silent cost-model break would surface — do not skip it.

---

## Verification checklist (all with pasted real output)

1. ≥20 expanded puzzles per difficulty (hard + extreme ONLY — decoys must not
   appear on easy/medium). Real pass counts for (a)-(e).
2. Per puzzle: print (i) tempting placement's `solveBag`-on-remainder is false,
   (ii) mixed planner places D, (iii) `validateGrid(board)` true / 0 invalid.
3. ≥5 puzzles/difficulty: real move-sequence sim, `simulated === par`, win.
4. Real wall-clock decoy-construction time across ≥10 puzzles/difficulty —
   watch for a performance cliff (repeated `solveBag` over many candidates), the
   same way the `L!` search was measured. Report it explicitly.
5. `npx tsx src/lib/verifyEngine.ts` still fully green for BOTH base archetypes.
6. `tsc --noEmit` clean (secondary to the executed evidence).

---

## Wiring (after the engine is proven)

- Add the decoy as an optional layer in `generator.ts`, applied with a
  probability that is visibly higher at extreme than hard, ONLY at hard/extreme.
- Nothing player-facing reveals a decoy is present or which tile it is;
  `archetypeId` may note it internally, consistent with the hidden-badge
  convention.
- **Do not touch `buildGroupsToRuns` or its planner** — decoys are
  runs-to-groups-only per finding (1).

---

## Model & effort

Genuine open-ended design (new planner + new par proof). Per CLAUDE.md
"Model and effort selection": strong reasoning model + plan mode, given RULES
and INVARIANTS (this doc), designing its own approach and proving correctness
with real executed output before reporting done. One file at a time; if it runs
long, split it (see SESSION HEALTH).
