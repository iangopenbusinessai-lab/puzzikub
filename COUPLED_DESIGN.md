# Coupled blocks — feasibility finding + scoped brief

*Written July 2026. A session attempted "coupled blocks" (two dual blocks at
non-overlapping value ranges sharing exactly one colour, made interdependent by
row-tightness). A feasibility-first probe — run BEFORE any build, the same
discipline `DECOY_DESIGN.md` used — found the literal spec is impossible in the
4-colour game and the achievable variants decompose. No engine code was shipped.
This documents exactly why, and what a genuine coupling design would actually
require, so the next session does not repeat the groundwork.*

---

## What was asked

Two dual blocks `D(N1,L1)` and `D(N2,L2)` at non-overlapping value ranges,
sharing exactly one colour, with the grid tight on destination rows so that a
greedy row choice for block 1 starves the row block 2's shared colour needs —
forcing the player to plan row allocation jointly rather than solving one block
then the other. Board per block shows a valid starting shape; rack per block
holds homeless boundary tiles; invariants (a)–(e) hold on the COMBINED puzzle.

---

## WALL 1 — colour budget makes "exactly one shared colour" impossible (decisive)

A dual block must be able to appear as GROUPS, and `isValidGroup` needs 3–4
distinct colours, so a dual block needs **≥3 colours** (a 2-colour block has no
valid group form — `isValidGroup([1r,1b]) = false` — so it is not dual). The
game has exactly **4 colours** (`r b a k`; see `src/types.ts`). Enumerating every
pair of ≥3-colour blocks (real probe output):

```
>=3-colour blocks available: rba, rbk, rak, bak, rbak
min overlap over ALL pairs of >=3-colour blocks: 2
any pair sharing EXACTLY one colour? false
=> "two dual blocks, exactly one shared colour" is IMPOSSIBLE with 4 colours
```

By inclusion–exclusion, two 3-subsets of a 4-set overlap in `≥ 3+3−4 = 2`
colours. So the shared-colour count is **always ≥2** — never exactly one. The
literal construction cannot be built without a 5th colour, which the game does
not have (adding one is a core `types.ts` + theme change, out of scope).

## WALL 2 — with ≥2 shared colours, a GAP breaks the pure runs planner

Grant 2 shared colours (the closest achievable). If the two value ranges have a
gap (as "non-overlapping" invites), the shared colour is non-contiguous, and
`planColorRunGoal` requires every colour contiguous (`archetypes.ts:482–486`).
Real probe output on `{r,b,a}@1–4` + `{r,b,k}@7–10` (gap at 5–6):

```
gapped combined board: 24 tiles, validateGrid=true
planColorRunGoal (pure runs goal)  => null (cannot represent)
planValueGroupGoal (pure groups)   => PLAN
reason: shared colour r values = 1,2,3,4,7,8,9,10 (non-contiguous)
```

The only pure planner that survives the gap is the one whose goal equals the
shape already shown (identity — no puzzle). Same class of wall as decoy: the
existing planners represent only PURE goal shapes.

## WALL 3 — every representable variant DECOMPOSES (fails the coupling test)

The prompt's own non-decomposition test is the real bar, and no achievable
config clears it:

- **Gapped, runs→groups (representable via `planValueGroupGoal`):** the two
  blocks share only a colour *label* over entirely disjoint tile sets and
  disjoint value-rows. Block-1 groups use only block-1 tiles; block-2 groups use
  only block-2 tiles. Zero tile- or cell-level interaction → solves as two
  independent sub-puzzles. Probe: `block1 alone solvable: true, block2 alone
  solvable: true`.
- **Adjacent ranges, runs goal (representable via `planColorRunGoal`,
  moves=18):** the shared colours become ONE contiguous run each, bridging both
  blocks — but that is just "one longer run," not contention. Any colour→row
  bijection is feasible (a run is valid in any row), so row-tightness never
  forces a conflict: **the proposed row-starvation mechanism does not bite for a
  pure-goal shape.** And adjacent + fully-shared reads as one bigger block, not
  two coupled ones.

Root cause: "sharing a colour across non-overlapping value ranges" shares a
*label*, not a *resource*. Genuine coupling needs a contested shared resource
(tiles or cells), which this construction never creates.

---

## What genuine coupling would actually require (for a future session)

Not a bolt-on. Any of these is its own design + feasibility pass:

1. **A contested resource, not a shared label.** Candidates: OVERLAPPING value
   ranges + a shared colour, so at the overlap a tile can serve block 1's run OR
   block 2's group but not both (a real either/or); or a genuinely tight grid
   GEOMETRY where the two goal layouts must pack into overlapping cell regions.
   Both contradict the "non-overlapping ranges / row-tightness" premise here.
2. **A generalized (mixed / cell-level) planner.** Overlap or geometric packing
   cannot be scored by the current colour→row and value→row abstractions; it
   needs a planner reasoning about cell occupancy directly, with par re-proven
   under the swap-move cost model (`makeCostCtx` can score any injective
   tile→cell goal, but building the goal and proving its optimality is the work).
   Measure the row/cell-assignment search space for blow-up (the way the `L!`
   search was measured) before building around it.
3. **Combined-gate cost.** The exhaustive `existsNoRelocationWin` gate ran in
   ~0.2ms on a 24-tile combined board with an empty rack, so tile count alone is
   not the worry — but re-measure with a real combined rack, since node count
   grows with empty-cell count × rack size.

Until a design clears the non-decomposition test with real generated puzzles,
coupled blocks should not ship.

---

## Model & effort

If revisited: strong reasoning model + plan mode, given these RULES/INVARIANTS,
designing its own coupling mechanism and proving non-decomposition + par with
real executed output (anti-illusion rule). One file at a time; stop and brief if
it hits a wall, as this session did.
