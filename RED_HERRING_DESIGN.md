# Red herring — feasibility finding + scoped brief

*Written July 2026. A session attempted a "red herring" modifier: two rack tiles
that each look equally plausible for the same visual opportunity, where only one
is correct and placing the wrong one first blocks the true solution. Following
the same feasibility-first discipline as `DECOY_DESIGN.md` and
`COUPLED_DESIGN.md`, the hypothesis was tested with real probes BEFORE any build.
Finding: red herring hits the SAME wall as the other two — it needs a mixed
(hybrid run+group) goal the existing pure planners cannot represent. No engine
code shipped. This documents exactly why, with real numbers.*

---

## The hypothesis that was tested

The brief flagged a hopeful framing: unlike decoy/coupled, a red herring MIGHT
stay within a PURE goal shape and be checkable purely with `solveBag` — "two
tiles, both locally plausible, only one is part of the single valid PURE-runs
(or PURE-groups) partition," with no new goal-shape representation needed. Both
walls below were probed on 10 real puzzles per direction per difficulty
(hard + extreme).

## WALL A — the direct framing ("two tiles, one visible opportunity") has no pure home

The only place a valid dual-block board offers ONE visible spot with TWO distinct
plausible tiles is a board run's two ends (a group-of-3 has a unique 4th colour;
a run gap has a unique filler; groups-to-runs boards are FULL groups with no
extension at all). Real probe output:

```
                          sameOppPairs   pairTilesWithPureHome
runs-to-groups / hard          24                 0
groups-to-runs / hard           0                 0
runs-to-groups / extreme       21                 0
groups-to-runs / extreme        0                 0
sample (r2g): row=5a 6a 7a 8a 9a 10a 11a  plausible extenders = 4a / 12a  pureHome each: false, false
```

- `groups-to-runs` offers **zero** such opportunities (full-group board — nothing
  to extend), exactly as with decoy.
- `runs-to-groups` offers plenty (a board run's low/high extenders), but
  **none** of those tiles has a pure-planner home (`pairTilesWithPureHome = 0`):
  the extenders sit at values `s-1` / `s+L`, outside the group block, so
  `planValueGroupGoal` returns `null`. Their true home is a **hybrid** short-run
  + groups layout — the identical mixed-goal wall documented in
  `DECOY_DESIGN.md` (these extenders ARE the decoy tiles).

## WALL B — pure shape-ambiguous tiles exist, but their "wrong" move never blocks

Loosen "same opportunity" to any candidate tile with genuine shape ambiguity —
BOTH a run-home and a group-home available in the bag. These exist and the pure
planner DOES home them. But a red herring needs the tempting alternative to
BLOCK; committing each such tile to its non-pure-home shape was checked:

```
                          versatilePure   BLOCKING-herring   alternateWin(no block)
runs-to-groups / hard          20                0                   20
groups-to-runs / hard          40                0                   40
runs-to-groups / extreme       20                0                   20
groups-to-runs / extreme       40                0                   40
```

**`BLOCKING-herring = 0` everywhere.** Every pure shape-ambiguous tile's tempting
"wrong" placement leads to an *alternate valid win*, not a dead end — because the
Latin-rectangle duality means the same tiles solve as runs AND as groups, so the
"wrong" reading still reaches a valid `validateGrid` win (and is freely
recoverable via undo besides). It is not a trap, so it is not a herring.

## Root cause (the third independent convergence)

A genuine red herring needs a tempting move that is a real DEAD END while the
correct tile keeps a computable pure goal + par. On these dual blocks:

- Every tempting move that IS a dead end (a board-run extension in a board
  colour) has a hybrid true home → no pure par (WALL A).
- Every ambiguity that stays PURE has both readings winning → no dead end
  (WALL B).

So red herring cannot exist within the pure-planner infrastructure. This is the
same missing capability that `DECOY_DESIGN.md` and `COUPLED_DESIGN.md` reached
independently: **a planner that represents MIXED goal shapes (some rows runs,
some rows groups, in one solution) and re-proves par under the swap-move cost
model.** Three modifier ideas, three routes, one wall.

---

## What a future session would need

1. **The mixed-goal planner** (shared prerequisite with decoy and coupled). See
   `DECOY_DESIGN.md` "Par for the mixed goal": `makeCostCtx` can already score
   any injective tile→cell goal, so the work is constructing the hybrid goal
   layout, validating it, and proving par via real move-sequence simulation
   (`simulatePlan`) — not new cost math.
2. **Then** a red herring is expressible: tile A = the correct extender whose
   true home is the hybrid short-run; tile B = a second plausible extender whose
   only home is elsewhere, so committing B to A's spot strands A. Both must be in
   the rack with real homes (invariant (b)), and exactly one must fit the shared
   opportunity — verify with `solveBag` at the bag level PLUS the mixed planner
   for par/(e).
3. Do decoy first — red herring is a strict superset of that machinery. If the
   mixed-goal planner lands, decoy and red herring likely share ~all of it.

Until the mixed-goal planner exists, red herring should not be attempted as a
bolt-on. Do NOT pursue it on `groups-to-runs` (no opportunity exists there at
all).

---

## Model & effort

If revisited: strong reasoning model + plan mode, building the mixed-goal planner
first (see `DECOY_DESIGN.md`), then layering red herring on top, proving
non-triviality + par with real executed output per the anti-illusion rule.
