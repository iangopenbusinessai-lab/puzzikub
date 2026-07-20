# MIGRATION_M2.md — moving Puzzikub from m=1 to m=2 tiles

*Scoping document. Written after a full audit of every file that touches `Tile`,
plus a verified standalone prototype of the m=2 solver DP (Part 2 of that
session — results summarised in §0.3). No migration work has been started.*

**Goal.** Today the engine assumes exactly ONE copy of each (value, colour) pair,
and identifies a tile BY that pair. Moving to m=2 (two full copies of every tile,
the real Rummikub rule) unlocks constructions that genuinely need duplicate
same-colour tiles — e.g. a board run of red 1-8 with a second red-3 and red-6 in
the rack, where the player must find the cut points that leave every piece a
legal run.

**The rule that does NOT change.** Two tiles of the same colour still never form
a group together. A group is still 3-4 tiles of one value with DISTINCT colours.
m=2 only means a colour may participate in two independent runs at once (and
that two disjoint groups can exist at the same value, each internally
distinct-coloured). This is assumed throughout below.

---

## 0. Executive summary

### 0.1 The single load-bearing change

`Tile` gains a stable `id`, and every place that currently uses `${n}_${c}` as a
tile's identity switches to `tile.id`. That string appears under three different
names — `tileKey` in `solver.ts`, `tileKey` in `archetypes.ts`, `tileKey` in
`mixedGoalPlanner.ts` — plus three inlined copies in `verifyEngine.ts` and one in
each of the three modifier harnesses.

### 0.2 What is already m=2-safe (verified by reading, listed so nobody re-does it)

- **`validator.ts` — needs no change at all.** `isValidRun` sorts and requires
  strictly consecutive values, so a repeated value fails naturally.
  `isValidGroup` compares `new Set(colors).size` to `colors.length`, so a
  repeated colour fails naturally. Both already encode the m=2 rules correctly.
  It still needs a *confirmation* step (§3) because "correct by reading" is not
  this project's standard of evidence — but expect zero code changes.
- **`usePlayState.ts` — needs no change.** The DROP reducer addresses tiles
  POSITIONALLY (`rackIdx`, `row`/`col`), never by value+colour. Two identical
  tiles move independently and correctly today.
- **`generator.ts`** — routes difficulties to builders, never inspects tiles.
- **`Board.tsx`** (`key={`${r}-${c}`}`), **`DragPreview.tsx`**, **`TileFace.tsx`**
  — all address cells or render `{n, c}` only.
- **`useDrag.ts`** — carries a `Tile` and a positional `DragSrc`.

### 0.3 The prototype result that de-risks the hardest piece

The m=2 solver DP was prototyped and verified in isolation before this document
was written. Using the 10-state run-pair space per colour ({0,0} {0,1} {0,2}
{0,3} {1,1} {1,2} {1,3} {2,2} {2,3} {3,3}) from van Rijn et al.:

- 14 hand-traced cases, all matching an independent brute-force oracle
- the owner's red 1-8 + duplicate-3 + duplicate-6 example: **solvable**, via
  runs [1..3] [3..6] [6..8]
- full 28-pair cut-point sweep matching both brute force AND a hand-derived
  closed form, 0 mismatches
- **17,700 differential fuzz instances vs. an independent brute-force oracle,
  0 mismatches** (5,361 of them solvable, 12,339 unsolvable)
- **0.002-0.004 ms/call**, including the 104-tile full m=2 universe — no
  performance concern whatsoever

So Step 2 below is de-risked. The prototype file was deleted; the DP design is
recorded in §2 and reproducible from the paper plus that description.

### 0.4 The risk that is NOT de-risked — read this before scheduling anything

**Duplicate tiles break the injectivity assumption the whole par/cost model rests
on.** `cost(goal) = totalTiles − fixed(goal) − cycles(goal)` is proven for an
*injective* tile→cell goal map. With two identical tiles, "which copy goes to
which cell" is a free choice, and `fixed` and `cycles` **both depend on that
choice** — the two pairings can give different move counts, so par becomes a
*minimum over pairings*, not a single evaluation.

This is the one place where m=2 is not a mechanical find-and-replace, and it is
the step most likely to be underestimated. It gets its own session (Step 6) and
its own proof obligation. If `d` = number of duplicated (value, colour) pairs in
a puzzle, the naive fix is minimising over 2^d pairings; the principled fix is a
min-cost bipartite matching. **Neither should be assumed correct without a fresh
BFS cross-check at the scale the original cost model got (265 instances).**

### 0.5 Honest scope estimate

**13 sessions**, of which 3 are genuine open-reasoning design work (Steps 2, 6,
9) and the rest are mechanical-to-moderate. Steps 6 and 9 are the ones that can
overrun; Step 6 is the one that could force a redesign.

---

## Phase A — foundations

### Step 1 — `types.ts`: add `Tile.id` (+ a mint helper)
**Session size:** small. **Risk:** low, but touches everything downstream.

- Add `id: string` to `Tile`. Keep `n` and `c` exactly as they are.
- Add a `makeTile(n, c)` helper minting a unique id, and a `TILE_COPIES = 2`
  constant so the copy count is named in one place, not scattered as literal 2s.
- **Decision to make explicitly and record in CLAUDE.md:** is `id` opaque
  (`crypto.randomUUID()` / counter) or structured (`${n}_${c}_${copyIndex}`)?
  Recommendation: **structured**, because it stays readable in the verify
  harnesses' printed output and survives a JSON round-trip without a remap
  table, which matters for Step 8.
- Nothing else changes yet; the codebase will not compile until Step 2+. Expect
  `tsc --noEmit` to report a large error list at the end of this step — that
  list IS the deliverable, since it enumerates every remaining call site.

**Verification:** paste the full `tsc --noEmit` error list. It should name only
construction sites (`{ n: ..., c: ... }` literals), not logic.

### Step 2 — `solver.ts`: add `solveBagM2` alongside `solveBag`
**Session size:** medium. **Risk:** LOW — already prototyped and verified (§0.3).
**Open-reasoning session** (it is DP design), but with a proven design to follow.

- Do NOT modify the existing m=1 `solveBag`. Add `solveBagM2` beside it; the
  existing archetypes keep calling `solveBag` until Step 7 retires it.
- Per-colour state becomes an **unordered pair** of saturating run lengths
  (0,1,2,3), giving 10 states. State = 4 colours × 10 = 10,000 per value.
- Transition at value `v`: choose a group multiset (0, 1, or 2 groups; each a
  distinct-colour subset of size 3-4; a colour may appear in at most `count_c`
  of them), then the remaining `r_c = count_c − groupUses_c` copies extend runs.
  For `r=0` both runs must terminate legally (length 0 or 3+); for `r=1` one
  extends and the other must terminate (try both, dedupe); for `r=2` both extend.
- Terminal condition at `v > 13`: every run in every colour is 0 or 3+.
- Reject >2 copies of any (value, colour) up front, exactly as the m=1 version
  rejects >1.
- **`assignment` must be keyed by `tile.id`, not `${n}_${c}`** — with duplicates
  the old key collides and silently loses a tile.

**Verification:** rebuild the same evidence the prototype produced — hand-traced
cases including two simultaneous same-colour runs, the red 1-8 + dup 3 + dup 6
example, and a differential fuzz sweep against an independently-written brute
force at 10,000+ instances with real match counts.

### Step 3 — `validator.ts`: confirmation only, expect zero changes
**Session size:** small. **Risk:** very low.

Add duplicate-aware cases to the validator's tests and prove the existing code
already handles them: `isValidRun([3r,3r,4r]) === false`, `isValidGroup` with two
reds `=== false`, `validateGrid` on a board holding two identical tiles in
different valid runs `=== true`. **If this step needs code changes, something in
the audit was wrong — stop and re-audit before continuing.**

---

## Phase B — construction layer

### Step 4 — `mixedGoalPlanner.ts`: id-keyed goals
**Session size:** medium. **Risk:** medium.

- `tileKey` becomes `t => t.id`.
- `windowsPartitionBag` currently **rejects any duplicate outright**
  (`duplicate tile ${k} in bag`) — that check must become a *count* check
  (≤ `TILE_COPIES`) rather than a presence check.
- `windowTiles(w)` currently *fabricates* tiles from a spec. Under m=2 it must
  either take ids as input or be paired with a resolver that binds each spec slot
  to a concrete available tile id. **This is the subtle one:** a window says
  "red 4", and under m=2 there are two red 4s. Do not let this silently bind to
  whichever is first.
- `mixedLayoutMoves`'s goal-cell lookups switch to ids.

**Verification:** re-run the existing mixed-planner harness unchanged (it must
still pass on m=1-shaped inputs), then add duplicate-bearing instances with BFS
cross-checks.

### Step 5 — `archetypes.ts` part 1: id-keyed plumbing, no behaviour change
**Session size:** medium. **Risk:** low-medium. **Split from Step 6 deliberately.**

Mechanical only: `tileKey` → `t.id`; every `{ n, c }` literal → `makeTile(n, c)`;
`GoalPlan.goal` and every `goal.set(...)` keyed by id. Builders still produce
m=1-shaped puzzles (no duplicates yet). Every existing harness must still pass
**with identical par values** — this step is a refactor, and any par change is a
bug.

**Verification:** `verifyEngine.ts`, `decoy.verify.ts`, `redherring.verify.ts`,
`composed.verify.ts` all green, and par values identical to the numbers recorded
in CLAUDE.md (easy 11 / medium 16 / hard 20 / decoy 22,25 / red herring 21,24 /
composed 24,27).

### Step 6 — `archetypes.ts` part 2: the cost model under duplicates ⚠️
**Session size:** LARGE — expect to split further. **Risk: HIGHEST IN THE PLAN.**
**Open-reasoning / plan-mode session. Do not schedule this as mechanical work.**

This is §0.4. `makeCostCtx` and the `cost = tiles − fixed − cycles` identity
assume an injective tile→cell map. With duplicates, par is a **minimum over
which copy lands in which cell**.

Sub-steps, each independently testable:
- **6a.** Prove or disprove, on small instances against move-BFS, that the two
  pairings of a duplicate pair can actually give different costs. *If they can't,
  the rest of Step 6 collapses to nothing — establish this first, it is cheap.*
- **6b.** If they can: implement minimisation over pairings (2^d enumeration
  first, since d is small in practice; min-cost matching only if 2^d proves too
  slow — measure, don't assume).
- **6c.** Re-prove the cost identity at the original scale: ≥265 instances
  against unrestricted move-BFS, 0 mismatches, per the standard the m=1 model
  was held to.

**Do not proceed to Step 7 until 6c produces real output.** Every par number the
game displays depends on this.

### Step 7 — retire `solveBag`, switch builders to `solveBagM2`
**Session size:** small-medium. **Risk:** low, given Steps 2 and 6.

Swap the call sites in `archetypes.ts`. All existing archetypes are m=1-shaped
bags, which are a strict subset of m=2 bags, so **every existing invariant must
still hold and every par must be unchanged**. Any diff here is a regression.

---

## Phase C — UI and persistence

### Step 8 — `storage.ts` + `useEditor.ts`: ids through serialization
**Session size:** small-medium. **Risk:** low, one real trap.

- `SEED_PUZZLES` literals need ids.
- `useEditor`'s `setTileAt` / `addRackTile` / `updateRackTile` must mint ids.
- **The trap:** puzzles already saved in `localStorage` under
  `puzzikub_library` have NO ids. `loadLibrary()` must detect and migrate
  legacy puzzles (mint ids on load) rather than returning tiles that fail every
  downstream lookup. A structured id scheme (Step 1) makes this a pure function
  of `(n, c, occurrenceIndex)`.
- The editor must also stop allowing more than `TILE_COPIES` of any tile.

**Verification:** round-trip a legacy (id-less) library blob through
`loadLibrary()` and confirm real ids appear and the puzzle still loads and plays.

### Step 9 — components: React keys and duplicate rendering
**Session size:** medium. **Risk:** medium — this is the one UI step with real
design content, not just prop threading.

- `Rack.tsx` uses `key={i}`. Index keys with duplicates present are *correct*
  but cause avoidable remounts on reorder; switch to `key={tile.id}`.
- **The genuine design question:** two copies of a tile are *visually identical*
  and the player must be able to drag either one independently. Confirm by
  actually playing a duplicate-bearing puzzle that dragging one copy does not
  visually "select" or dim the other. This is exactly the class of bug the
  `dimmed={draggingRackIdx === i}` prop would produce if it were ever switched
  from an index to a value+colour comparison — **it must stay positional.**
- Decide whether duplicates need any visual distinction at all. Recommendation:
  **no** — real Rummikub tiles are indistinguishable, and marking them would leak
  puzzle structure.

**Verification:** run the app, load a duplicate-bearing puzzle, drag each copy
separately, screenshot. Not a typecheck.

---

## Phase D — re-verification

### Step 10 — re-verify all three trap modifiers under m=2
**Session size:** medium. **Risk:** medium — expect real findings here.

Re-run `decoy.verify.ts`, `redherring.verify.ts`, `composed.verify.ts` unchanged.
All three build their traps on `solveBag`-unsolvability of a reduced bag. Under
m=2 the tile universe is strictly larger, so **a bag that was unsolvable under
m=1 may become solvable under m=2** — which would silently defuse a trap.

This is a real risk, not a formality: the decoy/red-herring/composed traps all
work by stranding tiles, and a second copy of a colour gives stranded tiles a new
home. Budget for the possibility that trap parameters need retuning.

### Step 11 — the payoff: a duplicate-requiring archetype
**Session size:** LARGE, open-reasoning. **This is the actual point of the
migration** and should be scheduled as its own design session, not tacked on.

Build the cut-point archetype from the original idea: board run of one colour
spanning `s..s+L-1`, rack carrying second copies at chosen interior values, where
the player must find cut points leaving every piece ≥3 long.

The prototype already mapped the solution space for red 1-8, and it is richer
than first assumed — worth reading before designing:

> With duplicates at `d1 < d2` added to a run of 1..8, the solvable pairs are
> **(2,3) (3,4) (3,5) (3,6) (4,5) (4,6) (5,6) (6,7)** — 8 of 28. Two distinct
> shapes produce these:
> - **Two runs** `[1..p]` + `[q..8]` overlapping on `[q..p]`, which forces
>   `d2 = d1+1` with `2 ≤ d1 ≤ 6` → (2,3) (3,4) (4,5) (5,6) (6,7)
> - **Three runs** `[1..d1] [d1..d2] [d2..8]`, each ≥3 → `d1≥3, d2≥d1+2, d2≤6`
>   → (3,5) (3,6) (4,6)
>
> The owner's (3,6) is a three-run split. A *single* duplicate at `d` is solvable
> for `d ∈ {3,4,5,6}` via `[1..d] + [d..8]`.

Design note: adjacent duplicates (`d2 = d1+1`) admit a **two**-run answer, while
spread duplicates admit a **three**-run answer. Those are different puzzles for
the player, and the difficulty gap between them is worth measuring before
choosing parameters.

### Step 12 — end-to-end + CLAUDE.md
**Session size:** small.

Full harness sweep, real playthrough of a duplicate puzzle in the browser,
CLAUDE.md updated with the m=2 model, the new cost-model rules from Step 6, and
the retirement of `solveBag`.

---

## Appendix — per-file audit

| File | Assumes (value,colour) is unique? | Change needed |
|---|---|---|
| `types.ts` | `Tile` has no identity beyond `{n,c}` | **Add `id`**, `makeTile`, `TILE_COPIES` |
| `solver.ts` | **Yes, explicitly** — rejects any duplicate; `tileKey` = `${n}_${c}`; `assignment` keyed by it | Add `solveBagM2`; assignment keyed by id |
| `validator.ts` | **No** — run/group checks reject duplicates structurally | **None** (confirm only) |
| `archetypes.ts` | **Yes** — `tileKey` (l.361), goal maps, `makeCostCtx` injectivity, `planColorRunGoal`/`planValueGroupGoal` one-tile-per-(value,colour) maps | id keys **+ the Step 6 cost-model work** |
| `mixedGoalPlanner.ts` | **Yes** — `tileKey` (l.51), `windowsPartitionBag` rejects duplicates, `windowTiles` fabricates tiles from specs | id keys; count-based duplicate check; spec→tile binding |
| `generator.ts` | No | None |
| `usePlayState.ts` | **No** — fully positional | None |
| `useEditor.ts` | No (positional), but constructs tiles | Mint ids; cap at `TILE_COPIES` |
| `storage.ts` | No, but serializes tiles and ships id-less seeds | Seed ids + **legacy-blob migration** |
| `Board.tsx` | No — cell-keyed | None |
| `Rack.tsx` | No — `key={i}`, positional `dimmed` | `key={tile.id}`; **keep `dimmed` positional** |
| `DragPreview.tsx` / `TileFace.tsx` | No — render `{n,c}` | None |
| `useDrag.ts` | No | None |
| `verifyEngine.ts` | **Yes** — 3 inlined `${t.n}_${t.c}` (l.225, 267, 374) | id keys |
| `decoy/redherring/composed.verify.ts` | **Yes** — each has a local `key()` helper | id keys + Step 10 re-verification |
