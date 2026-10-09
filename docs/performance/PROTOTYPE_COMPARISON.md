# Prototype before/after comparison — 2026-10-09

The bounded route-topology correction removes global root-collection iteration and
unrelated polygon-state reads from the measured route edits. Route-membership getter
reads fall by about 75%, with the same SVG-write counts and identical scene/DOM
composition. Shared dependency and appearance-list walks remain. Functional checks
pass; this is not an O(changed-route) path or a completed prototype/platform gate.

Route-edit SVG-delivery medians are lower in this session. Other scenarios have mixed
timing and several worse tails. The substantially higher OS load in the after session
prevents strict causal timing attribution. No functional or measured-work regression
outside route topology was found in these workloads. This does not establish the
absence of timing regressions under controlled conditions.

**Recommendation:** proceed with the agreed batch/minimal-materials slice in separate
reviewable steps. There is no reproduced functional failure or extra deterministic
work that justifies another runtime correction first. Before selecting any further
performance optimization or asserting a timing regression, collect the focused
profiles and paired measurements described below. Numerical acceptance targets remain
open, so this recommendation is not a performance-gate decision.

## Evidence

- Historical [baseline report](PROTOTYPE_BASELINE.md) and
  [before manifest](prototype-2026-10-09-before-manifest.json), unchanged.
- [After manifest: build, hashes, environment and functional results](prototype-2026-10-09-after-manifest.json).
- After [raw timing](prototype-2026-10-09-after-timing.csv) and
  [timing summary](prototype-2026-10-09-after-timing-summary.csv).
- After [raw instrumentation](prototype-2026-10-09-after-instrument.csv) and
  [instrumentation summary](prototype-2026-10-09-after-instrument-summary.csv).
- Independently computed [timing comparison](prototype-2026-10-09-comparison-timing.csv)
  and [instrumentation comparison](prototype-2026-10-09-comparison-instrument.csv).
  Every comparable field includes unit, counts/repeats, before/after median/p95/max,
  and absolute/relative differences for all three statistics. Instrumented timing is
  explicitly diagnostic and never pooled with primary timing.
- [Verification and scope audit](prototype-2026-10-09-comparison-verification.json):
  per-input differences, summary recalculation, preservation hashes, sample identities,
  load differences, validation and the known CI-trace defect.
- [Supplemental native checks at 5000 roots](prototype-2026-10-09-after-native-5000.json).

## Integrated base and preserved checkout

The shared checkout remains on `feat/synchronous-batch`, HEAD
`bc874494e3c1d1030b03fb593b1ea25a16a6c8d3`. It was already dirty, with staged
benchmark/doc/test work and unstaged runtime corrections. HEAD alone therefore does
not describe the measured runtime. All 66 recorded runtime/harness/config/lockfile
inputs were verified byte-for-byte against the existing local `origin/master` at
`a5a542a` and rechecked against the frozen-build manifest. That merged reference
contains the benchmark (`d355bba`, baseline `91b9033`, PR #32), route correction
(`998a76f`, PR #33), and gesture correction (`bba1833`, PR #34). The conclusion is
based on merge ancestry and actual bytes, not PR review approval. No remote fetch
or CI-status query was performed.

The runner records dirty state at build/capture, full input SHA-256 values, and HEAD
before/after. The audit additionally records the initial checkout/index state. No
branch switch, staging, commit, push, PR creation or source edit was performed.
Six existing design documents changed externally during this task; their initial and
observed hashes are recorded in the audit. None is a benchmark input, and they were
left as found. The shared index, all recorded inputs and every preexisting performance
file, including the historical baseline report, were verified unchanged by this task.

## Comparability

| Input                                   | Comparison and meaning                                                                                                                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene generator, seed, operations/order | Identical source hashes; seed `0x50524f54`; same 18 scenarios, deterministic rotation, three warmups, 20 timing repeats, three instrumentation repeats, 24 motion updates and 40 picks per repeat.                                                                                |
| Scene-definition SHA-256                | 3000: `3cbcf22362bae0afb22fbb6ff69b468e0b15bc84524832cccca5528838721908`; 5000: `5dda11390a56452fe39b4f1fe4c814d80a2094df752bbf578df3a43054d2ab0a`, identical before/after. Blob URL normalized to the stable background name.                                                    |
| Background                              | Identical `ca3701551b18a5d9b17d798781f3bcb58d1762b672fa373df9972d3e8b80491b`; 1200 × 800, 42,640 UTF-8 bytes, 1551 SVG elements, same fallback-font behavior.                                                                                                                     |
| Harness/config/lockfile                 | Every non-runtime input hash matches, including all six harness files, benchmark config, package/lockfile and both tsconfigs. Aggregate `dea70a2567c58d8ff88a1bc72ae3c87221c54e7035ddd261ece83c8eb6f8e47e`, identical.                                                            |
| Runtime                                 | Six expected files differ, listed below. Aggregate before `cb4132c7dc7a88f2ac8cdcc6094e79bd4c07bcf7fc10e3f4fe07df678a6a43ad`; after `235bc9e82448de2836a6492e9a7e2f66af638e6de882c3ca9eb7ec8fb8d62310`.                                                                           |
| Hardware/OS                             | Identical Apple M2, 8 logical CPUs, 16 GiB, Darwin 25.6.0 arm64. Browser MacIntel UA remains identical and does not describe host architecture.                                                                                                                                   |
| Tooling/browser                         | Identical Node v20.19.6, Playwright 1.63.0, Chromium 153.0.8010.12. Same default Playwright headless launch; no custom browser flags, throttling or forced GC.                                                                                                                    |
| Viewport/DPR                            | Identical browser 1100 × 900 CSS pixels, map 960 × 640, DPR 1. Browser environment objects match, including visible page and crossOriginIsolated=false.                                                                                                                           |
| Build mode                              | Same ES2022, unminified Vite benchmark build. Copied frozen dist served over loopback. Build-file names/hashes change with runtime and embedded dirty/build metadata; module startup is outside operation timing. No workload/config change is hidden in those build differences. |
| Git provenance                          | HEAD remains the baseline commit; dirty/runtime bytes and integration evidence above identify the actual after input. Dirty-path metadata differs as other tasks/docs/results progress.                                                                                           |
| OS load                                 | Before start 4.06 / 9.87 / 10.84, end 5.06 / 6.85 / 9.08; after start 20.27 / 22.42 / 20.03, end 22.57 / 21.78 / 20.41 (1/5/15-minute averages). This difference is unresolved scheduling noise, not a measured runtime improvement or regression.                                |

Expected runtime changes, with full before/after hashes in the audit and manifests:

| File                                        | Change represented                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/objects/map-route.ts`                  | Dedicated route-topology invalidation for add/insert/remove/replace.               |
| `src/spatial/scene-invalidation.ts`         | Track affected routes separately from root/layer membership.                       |
| `src/objects/map-layer.ts`                  | Initialize the topology invalidation set.                                          |
| `src/spatial/scene-geometry.ts`             | Update affected appearances while retaining shared dependency/list reconciliation. |
| `src/interaction/camera-controls.ts`        | Expose whether the current press can initiate object picking.                      |
| `src/components/map-element/map-element.ts` | Guard press picking and revalidate after synchronous surface handlers.             |

Hardware/software and workload are reproducible here; background scheduling is not
matched. A strict timing comparison would need a separate quiet paired before/after
session with the recorded historical runtime and exact harness restored into isolated
inputs. It must use fresh prefixes, keep these historical files unchanged, and avoid
restoring files or switching this shared checkout. No control-before run was attempted
in this task. The present timing comparison is descriptive; deterministic work counts
and functional results support the bounded improvement independently.

## Validation and measurement window

The required sequence passed: `npm run check` (34 advisory lint warnings, no errors),
`npm test` (230), `npm run test:browser` (80), `npm run build`, `npm run test:e2e` (21),
then `npm run bench:build` as the last build. Library declaration generation warns
that TypeScript 6.0.3 is newer than its bundled 5.9.3 compiler engine; build succeeded.
The first sandboxed browser-test attempt could not bind loopback (`EPERM`); the local
run with browser/server permission passed. This was an environment restriction, not
a test failure hidden from the results.

The supplementary 5000-root native check ran between e2e and the final benchmark
build. A sanitized process inspection immediately before capture found no competing
project tests/builds/benchmark runners. No tests, builds, analysis scripts or input
edits were started by this task during capture. Background desktop/OS activity was
not controlled. The runner served its copied build and checked all 66 source hashes
and HEAD before/after each phase; all checks passed.

```sh
node examples/prototype-bench.run.mjs --warmups 3 --repeats 20 --instrument-repeats 3 --output docs/performance/prototype-2026-10-09-after
```

After timing: 12:38:21–12:42:35 UTC (15:38:21–15:42:35 Riga).
After instrumentation: 12:42:36–12:43:44 UTC (15:42:36–15:43:44 Riga).
Before timing: 11:48:27–11:52:41 UTC; instrumentation: 11:52:41–11:53:50 UTC.
All captures are on 2026-10-09. These are the full requested captures, not a smoke run.

## Functional and composition checks

The six independent analytic functional groups passed at both sizes, with no page
errors. Scene composition, definition/background hashes and initial/all-visible node
snapshots match exactly. All ten post-operation DOM/appearance snapshot metrics match
raw repeat-by-repeat for all 18 scenarios at both sizes: 360 groups, 1080 rows per
side. Root-count assertions passed for every sample, including add/remove offsets.

| Quantity, equal before/after                   | 3000 roots       | 5000 roots        |
| ---------------------------------------------- | ---------------- | ----------------- |
| Independent points / lines / routes            | 1193 / 601 / 603 | 2009 / 1009 / 995 |
| Flat / extruded polygons                       | 301 / 302        | 493 / 494         |
| Owned MapPoints / route vertices               | 5914 / 4712      | 9898 / 7880       |
| Polygon coordinate vertices                    | 3612             | 5916              |
| Layers / selected visible layers               | 13 / 5           | 13 / 5            |
| All appearances / selected visible appearances | 8035 / 2659      | 13411 / 4433      |
| SVG element nodes                              | 16085            | 26837             |
| Shadow element / all-node counts               | 16086 / 16089    | 26838 / 26841     |

Load starts with all 13 layers visible and renders 8035/13411 appearances; independent
floor selection is outside the other operation spans. Hidden floors remain in the
DOM. These counts exclude the SVG background's internal document.

**Native-check scope:** the unchanged runner's three real mouse checks use 3000 roots
only (`nativeSetup` hardcodes that size). The supplemental source-page check reloads
the same component with unmodified `createScene(5000)`, background and initial floors,
then invokes the existing native assertions for original route/layer, edited route,
and owned vertex after a floor switch. All three pass; its scene hashes and counts
match the frozen measurement. It verifies the same source bytes through Vite, not a
second frozen timing sample or physical mobile input. The 21 e2e tests also pass,
including touch-emulated pinch/cancellation; representative timing does not quantify
the gesture fix's speed.

## Statistics and independent recalculation

Bundled Python stdlib `csv` and `statistics.median` independently recomputed summaries
from all raw observations; no runner summary code was imported. p95 is sorted nearest
rank `ceil(0.95*n)`; max is the largest sample. All saved fields match to absolute
tolerance 1e-12. Sample keys, repeats, units and counts also match exactly across runs,
with no duplicate samples or missing repeat indices.

Each side has 14,280 timing rows / 190 summary groups and 4842 instrumentation rows /
1090 groups. The timing comparison has 190 rows. The instrumentation comparison has
954 rows after excluding 136 non-load groups for the four unobserved facade fields:
`renderer_scene_reads`, `renderer_entries_exposed`, `renderer_composition_changes`,
`renderer_changed_entries`. They remain usable for load only. Their non-load raw zeros
are unobserved and contribute to no delta or conclusion here. Other counters retain
their captured meanings. No instrumentation was changed.

In the tables, **M / P95 / X** means median / p95 / maximum. Δ is after minus before;
negative timing deltas are faster observed delivery. Percent is Δ / before × 100,
computed separately for each statistic. `n/a` means that statistic's before value is
zero. Raw and comparison CSVs preserve precision; tables round times to 0.01 ms and
percentages to 0.1%, so a displayed 0.00 is not a claim of no work.

## Load

Load promise includes background preparation; SVG delivery is MutationObserver
delivery from operation entry. Two RAF opportunities are scheduling/callback spans.

| Roots | Scenario / metric    | n / repeats per side | Before M / P95 / X, ms   | After M / P95 / X, ms    | Δ M / P95 / X, ms       | Δ M / P95 / X, %     |
| ----- | -------------------- | -------------------- | ------------------------ | ------------------------ | ----------------------- | -------------------- |
| 3000  | load call sync       | 20 / 20              | 56.60 / 66.00 / 122.40   | 60.35 / 81.10 / 95.30    | +3.75 / +15.10 / -27.10 | +6.6 / +22.9 / -22.1 |
| 3000  | load promise         | 20 / 20              | 69.65 / 82.60 / 139.20   | 74.55 / 95.10 / 115.00   | +4.90 / +12.50 / -24.20 | +7.0 / +15.1 / -17.4 |
| 3000  | load to SVG delivery | 20 / 20              | 100.05 / 120.10 / 169.50 | 105.95 / 134.30 / 153.10 | +5.90 / +14.20 / -16.40 | +5.9 / +11.8 / -9.7  |
| 3000  | load to two RAF      | 20 / 20              | 124.65 / 149.70 / 192.60 | 132.65 / 163.60 / 186.30 | +8.00 / +13.90 / -6.30  | +6.4 / +9.3 / -3.3   |
| 5000  | load call sync       | 20 / 20              | 99.65 / 118.50 / 142.40  | 101.65 / 113.20 / 174.70 | +2.00 / -5.30 / +32.30  | +2.0 / -4.5 / +22.7  |
| 5000  | load promise         | 20 / 20              | 123.10 / 147.10 / 174.90 | 129.65 / 146.60 / 219.00 | +6.55 / -0.50 / +44.10  | +5.3 / -0.3 / +25.2  |
| 5000  | load to SVG delivery | 20 / 20              | 179.95 / 247.90 / 257.40 | 187.85 / 299.60 / 317.60 | +7.90 / +51.70 / +60.20 | +4.4 / +20.9 / +23.4 |
| 5000  | load to two RAF      | 20 / 20              | 227.45 / 303.20 / 350.90 | 234.50 / 352.30 / 387.50 | +7.05 / +49.10 / +36.60 | +3.1 / +16.2 / +10.4 |

Load promise medians increase by 7.0% / 5.3%. Load instrumentation is identical,
including valid renderer facade counts. This harness does not separate input
validation, copying, resolution, background work and rendering, so those timing
increases do not identify a changed phase or a confirmed code regression.

## Route, polygon, root and layer edits

The following metric is `post_sync_svg_delivery_ms`: synchronous API return to the
last observed SVG MutationObserver delivery. It includes RAF scheduling and scene/
renderer work. Each operation uses a fresh scene; edits do not accumulate.

| Roots | Scenario / metric   | n / repeats per side | Before M / P95 / X, ms  | After M / P95 / X, ms   | Δ M / P95 / X, ms          | Δ M / P95 / X, %       |
| ----- | ------------------- | -------------------- | ----------------------- | ----------------------- | -------------------------- | ---------------------- |
| 3000  | floor-switch        | 20 / 20              | 10.35 / 16.50 / 16.50   | 11.15 / 17.20 / 35.00   | +0.80 / +0.70 / +18.50     | +7.7 / +4.2 / +112.1   |
| 3000  | vertex-position     | 20 / 20              | 12.80 / 16.50 / 20.40   | 8.85 / 15.60 / 25.30    | -3.95 / -0.90 / +4.90      | -30.9 / -5.5 / +24.0   |
| 3000  | route-add           | 20 / 20              | 42.10 / 71.40 / 136.80  | 15.75 / 23.00 / 51.70   | -26.35 / -48.40 / -85.10   | -62.6 / -67.8 / -62.2  |
| 3000  | route-insert        | 20 / 20              | 40.55 / 87.10 / 123.60  | 16.70 / 29.40 / 40.90   | -23.85 / -57.70 / -82.70   | -58.8 / -66.2 / -66.9  |
| 3000  | route-remove        | 20 / 20              | 41.60 / 51.80 / 80.70   | 18.90 / 65.10 / 80.10   | -22.70 / +13.30 / -0.60    | -54.6 / +25.7 / -0.7   |
| 3000  | route-replacePoints | 20 / 20              | 42.85 / 67.90 / 69.70   | 17.25 / 38.10 / 48.00   | -25.60 / -29.80 / -21.70   | -59.7 / -43.9 / -31.1  |
| 3000  | polygon-vertex      | 20 / 20              | 7.05 / 17.30 / 35.90    | 11.75 / 15.10 / 38.80   | +4.70 / -2.20 / +2.90      | +66.7 / -12.7 / +8.1   |
| 3000  | polygon-baseZ       | 20 / 20              | 16.80 / 19.40 / 75.60   | 15.35 / 18.30 / 38.80   | -1.45 / -1.10 / -36.80     | -8.6 / -5.7 / -48.7    |
| 3000  | polygon-height      | 20 / 20              | 16.30 / 19.80 / 20.10   | 17.30 / 44.90 / 55.00   | +1.00 / +25.10 / +34.90    | +6.1 / +126.8 / +173.6 |
| 3000  | root-add            | 20 / 20              | 41.70 / 54.90 / 70.90   | 41.85 / 74.90 / 94.70   | +0.15 / +20.00 / +23.80    | +0.4 / +36.4 / +33.6   |
| 3000  | root-remove         | 20 / 20              | 40.85 / 54.10 / 71.90   | 41.95 / 45.70 / 89.00   | +1.10 / -8.40 / +17.10     | +2.7 / -15.5 / +23.8   |
| 3000  | layer-direct-add    | 20 / 20              | 41.90 / 61.40 / 67.20   | 43.60 / 53.60 / 102.40  | +1.70 / -7.80 / +35.20     | +4.1 / -12.7 / +52.4   |
| 3000  | layer-direct-remove | 20 / 20              | 35.80 / 49.60 / 68.90   | 43.90 / 53.60 / 72.00   | +8.10 / +4.00 / +3.10      | +22.6 / +8.1 / +4.5    |
| 5000  | floor-switch        | 20 / 20              | 5.45 / 34.60 / 35.60    | 10.25 / 15.40 / 15.40   | +4.80 / -19.20 / -20.20    | +88.1 / -55.5 / -56.7  |
| 5000  | vertex-position     | 20 / 20              | 10.95 / 16.10 / 16.20   | 11.00 / 26.50 / 33.20   | +0.05 / +10.40 / +17.00    | +0.5 / +64.6 / +104.9  |
| 5000  | route-add           | 20 / 20              | 59.45 / 97.70 / 110.10  | 19.45 / 24.40 / 27.60   | -40.00 / -73.30 / -82.50   | -67.3 / -75.0 / -74.9  |
| 5000  | route-insert        | 20 / 20              | 61.30 / 117.10 / 119.60 | 17.85 / 24.10 / 41.00   | -43.45 / -93.00 / -78.60   | -70.9 / -79.4 / -65.7  |
| 5000  | route-remove        | 20 / 20              | 62.65 / 163.20 / 224.80 | 18.00 / 30.00 / 94.50   | -44.65 / -133.20 / -130.30 | -71.3 / -81.6 / -58.0  |
| 5000  | route-replacePoints | 20 / 20              | 60.95 / 77.70 / 79.40   | 19.85 / 29.80 / 55.20   | -41.10 / -47.90 / -24.20   | -67.4 / -61.6 / -30.5  |
| 5000  | polygon-vertex      | 20 / 20              | 9.60 / 16.50 / 27.30    | 10.05 / 15.40 / 16.20   | +0.45 / -1.10 / -11.10     | +4.7 / -6.7 / -40.7    |
| 5000  | polygon-baseZ       | 20 / 20              | 15.00 / 22.20 / 45.60   | 14.55 / 20.20 / 21.30   | -0.45 / -2.00 / -24.30     | -3.0 / -9.0 / -53.3    |
| 5000  | polygon-height      | 20 / 20              | 17.95 / 22.70 / 57.70   | 17.20 / 23.10 / 33.70   | -0.75 / +0.40 / -24.00     | -4.2 / +1.8 / -41.6    |
| 5000  | root-add            | 20 / 20              | 65.55 / 151.70 / 209.80 | 64.85 / 117.70 / 135.20 | -0.70 / -34.00 / -74.60    | -1.1 / -22.4 / -35.6   |
| 5000  | root-remove         | 20 / 20              | 60.45 / 113.50 / 120.80 | 60.90 / 158.30 / 215.40 | +0.45 / +44.80 / +94.60    | +0.7 / +39.5 / +78.3   |
| 5000  | layer-direct-add    | 20 / 20              | 61.30 / 78.40 / 110.70  | 63.05 / 72.60 / 116.20  | +1.75 / -5.80 / +5.50      | +2.9 / -7.4 / +5.0     |
| 5000  | layer-direct-remove | 20 / 20              | 62.15 / 111.90 / 115.10 | 61.95 / 66.80 / 144.10  | -0.20 / -45.10 / +29.00    | -0.3 / -40.3 / +25.2   |

Synchronous API timing remains near the timer quantum for most edits. The complete
sync comparison follows so deferred delivery improvements are not mistaken for
synchronous setter speedups. The root-remove maxima include occasional long calls.

| Roots | Scenario / metric   | n / repeats per side | Before M / P95 / X, ms | After M / P95 / X, ms | Δ M / P95 / X, ms     | Δ M / P95 / X, %      |
| ----- | ------------------- | -------------------- | ---------------------- | --------------------- | --------------------- | --------------------- |
| 3000  | floor-switch        | 20 / 20              | 0.00 / 0.00 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.10 / +0.00 | n/a / n/a / +0.0      |
| 3000  | vertex-position     | 20 / 20              | 0.00 / 0.10 / 0.20     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / -0.10 | n/a / +0.0 / -50.0    |
| 3000  | route-add           | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.20 / 0.20    | +0.00 / +0.10 / +0.10 | n/a / +100.0 / +100.0 |
| 3000  | route-insert        | 20 / 20              | 0.00 / 0.10 / 0.20     | 0.00 / 0.10 / 0.20    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 3000  | route-remove        | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 3000  | route-replacePoints | 20 / 20              | 0.05 / 0.10 / 0.10     | 0.05 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | +0.0 / +0.0 / +0.0    |
| 3000  | polygon-vertex      | 20 / 20              | 0.00 / 0.10 / 0.20     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / -0.10 | n/a / +0.0 / -50.0    |
| 3000  | polygon-baseZ       | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 3000  | polygon-height      | 20 / 20              | 0.00 / 0.00 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.10 / +0.00 | n/a / n/a / +0.0      |
| 3000  | root-add            | 20 / 20              | 0.10 / 0.20 / 0.20     | 0.10 / 0.10 / 0.10    | +0.00 / -0.10 / -0.10 | +0.0 / -50.0 / -50.0  |
| 3000  | root-remove         | 20 / 20              | 0.20 / 0.30 / 0.30     | 0.20 / 0.30 / 5.30    | +0.00 / +0.00 / +5.00 | +0.0 / +0.0 / +1666.7 |
| 3000  | layer-direct-add    | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 3000  | layer-direct-remove | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | floor-switch        | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | vertex-position     | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | route-add           | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.20    | +0.00 / +0.00 / +0.10 | n/a / +0.0 / +100.0   |
| 5000  | route-insert        | 20 / 20              | 0.05 / 0.10 / 0.20     | 0.00 / 0.10 / 0.10    | -0.05 / +0.00 / -0.10 | -100.0 / +0.0 / -50.0 |
| 5000  | route-remove        | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | route-replacePoints | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.05 / 0.10 / 0.10    | +0.05 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | polygon-vertex      | 20 / 20              | 0.10 / 0.10 / 0.30     | 0.10 / 0.20 / 0.30    | +0.00 / +0.10 / +0.00 | +0.0 / +100.0 / +0.0  |
| 5000  | polygon-baseZ       | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.20    | +0.00 / +0.00 / +0.10 | n/a / +0.0 / +100.0   |
| 5000  | polygon-height      | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | root-add            | 20 / 20              | 0.10 / 0.10 / 0.30     | 0.10 / 0.20 / 0.20    | +0.00 / +0.10 / -0.10 | +0.0 / +100.0 / -33.3 |
| 5000  | root-remove         | 20 / 20              | 0.30 / 0.30 / 0.30     | 0.30 / 0.40 / 0.70    | +0.00 / +0.10 / +0.40 | +0.0 / +33.3 / +133.3 |
| 5000  | layer-direct-add    | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |
| 5000  | layer-direct-remove | 20 / 20              | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10    | +0.00 / +0.00 / +0.00 | n/a / +0.0 / +0.0     |

## Pan, zoom and picking

Pan/zoom pool 24 frames × 20 repeats (480 observations per row); picks pool 40 queries ×
20 repeats (800). These are correlated observations within 20 runs. Picking measures
the internal numeric spatial query with prepared scene setup excluded. Native dispatch,
DOM rectangle reads and pointer-to-presentation latency are not in these time rows.

| Roots | Motion / metric               | n / repeats per side | Before M / P95 / X, ms | After M / P95 / X, ms  | Δ M / P95 / X, ms       | Δ M / P95 / X, %     |
| ----- | ----------------------------- | -------------------- | ---------------------- | ---------------------- | ----------------------- | -------------------- |
| 3000  | pan / setter sync             | 480 / 20             | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10     | +0.00 / +0.00 / +0.00   | n/a / +0.0 / +0.0    |
| 3000  | pan / post-sync SVG delivery  | 480 / 20             | 16.70 / 17.40 / 33.80  | 16.70 / 17.30 / 67.10  | +0.00 / -0.10 / +33.30  | +0.0 / -0.6 / +98.5  |
| 3000  | pan / RAF cadence             | 480 / 20             | 16.70 / 16.70 / 16.80  | 16.70 / 16.80 / 66.70  | +0.00 / +0.10 / +49.90  | +0.0 / +0.6 / +297.0 |
| 3000  | zoom / setter sync            | 480 / 20             | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10     | +0.00 / +0.00 / +0.00   | n/a / +0.0 / +0.0    |
| 3000  | zoom / post-sync SVG delivery | 480 / 20             | 16.70 / 19.10 / 290.30 | 16.70 / 19.60 / 119.10 | +0.00 / +0.50 / -171.20 | +0.0 / +2.6 / -59.0  |
| 3000  | zoom / RAF cadence            | 480 / 20             | 16.70 / 16.80 / 283.40 | 16.70 / 16.80 / 116.80 | +0.00 / +0.00 / -166.60 | +0.0 / +0.0 / -58.8  |
| 5000  | pan / setter sync             | 480 / 20             | 0.00 / 0.10 / 0.10     | 0.00 / 0.10 / 0.10     | +0.00 / +0.00 / +0.00   | n/a / +0.0 / +0.0    |
| 5000  | pan / post-sync SVG delivery  | 480 / 20             | 16.70 / 17.60 / 46.40  | 16.60 / 17.70 / 182.20 | -0.10 / +0.10 / +135.80 | -0.6 / +0.6 / +292.7 |
| 5000  | pan / RAF cadence             | 480 / 20             | 16.70 / 16.80 / 50.00  | 16.70 / 16.80 / 166.60 | +0.00 / +0.00 / +116.60 | +0.0 / +0.0 / +233.2 |
| 5000  | zoom / setter sync            | 480 / 20             | 0.00 / 0.10 / 0.20     | 0.00 / 0.10 / 0.20     | +0.00 / +0.00 / +0.00   | n/a / +0.0 / +0.0    |
| 5000  | zoom / post-sync SVG delivery | 480 / 20             | 21.70 / 32.40 / 156.40 | 23.30 / 34.10 / 324.80 | +1.60 / +1.70 / +168.40 | +7.4 / +5.2 / +107.7 |
| 5000  | zoom / RAF cadence            | 480 / 20             | 16.70 / 33.40 / 166.70 | 16.70 / 33.40 / 316.60 | +0.00 / +0.00 / +149.90 | +0.0 / +0.0 / +89.9  |

| Roots | Scenario / metric | n / repeats per side | Before M / P95 / X, ms | After M / P95 / X, ms | Δ M / P95 / X, ms      | Δ M / P95 / X, %      |
| ----- | ----------------- | -------------------- | ---------------------- | --------------------- | ---------------------- | --------------------- |
| 3000  | pick-hit          | 800 / 20             | 0.10 / 0.20 / 3.00     | 0.10 / 0.20 / 0.60    | +0.00 / +0.00 / -2.40  | +0.0 / +0.0 / -80.0   |
| 3000  | pick-miss         | 800 / 20             | 0.50 / 0.70 / 1.50     | 0.60 / 0.70 / 3.70    | +0.10 / +0.00 / +2.20  | +20.0 / +0.0 / +146.7 |
| 5000  | pick-hit          | 800 / 20             | 0.20 / 0.30 / 3.30     | 0.20 / 0.30 / 18.90   | +0.00 / +0.00 / +15.60 | +0.0 / +0.0 / +472.7  |
| 5000  | pick-miss         | 800 / 20             | 1.10 / 1.30 / 10.20    | 1.10 / 1.30 / 6.00    | +0.00 / +0.00 / -4.20  | +0.0 / +0.0 / -41.2   |

## What work was removed, and what remains

Instrumentation totals below have three repeats per side. Every shown count is
constant across those repeats: median = p95 = max. Arrows are before → after counts,
not time. Full absolute/relative deltas are in the instrumentation comparison CSV.

| Roots | Route edit          | Root iterator next | Route points reads | Polygon contour reads | SVG geometry writes | All SVG writes |
| ----- | ------------------- | ------------------ | ------------------ | --------------------- | ------------------- | -------------- |
| 3000  | route-add           | 3001 → 0           | 9650 → 2426        | 3624 → 0              | 4 → 4               | 38 → 38        |
| 3000  | route-insert        | 3001 → 0           | 9647 → 2423        | 3624 → 0              | 2 → 2               | 9 → 9          |
| 3000  | route-remove        | 3001 → 0           | 9648 → 2424        | 3624 → 0              | 1 → 1               | 1 → 1          |
| 3000  | route-replacePoints | 3001 → 0           | 9647 → 2423        | 3624 → 0              | 4 → 4               | 11 → 11        |
| 5000  | route-add           | 5001 → 0           | 15922 → 3994       | 5928 → 0              | 4 → 4               | 38 → 38        |
| 5000  | route-insert        | 5001 → 0           | 15919 → 3991       | 5928 → 0              | 2 → 2               | 9 → 9          |
| 5000  | route-remove        | 5001 → 0           | 15920 → 3992       | 5928 → 0              | 1 → 1               | 1 → 1          |
| 5000  | route-replacePoints | 5001 → 0           | 15919 → 3991       | 5928 → 0              | 4 → 4               | 11 → 11        |

For every topology edit, root-iterator creation goes 1 → 0 and terminal-inclusive
next calls go 3001/5001 → 0. Polygon contour reads go 3624/5928 → 0, and both baseZ
and height reads go 7236/11844 → 0. Route-points reads fall 74.9% at both sizes, but
remain 2423–2426 / 3991–3994. These are getter/read proxies, not counts of all arithmetic,
clipping calls or visited coordinates.

Source inspection explains the retained work in
[`scene-geometry.ts`](../../src/spatial/scene-geometry.ts): topology skips
`reconcileRoots()` and calls `updateAppearance()` only for affected roots/layers.
However `reconcileRootDependencies()` still visits the cached roots and reads owned
membership; `reconcileEntries()` walks ordered layers × cached roots, compares/collects
the complete appearance list and rebuilds entry dependencies. `syncTracking()` still
walks tracked sources. These array/map/set walks do not invoke the patched root
collection iterator. Route getter counts still scale with unrelated scene routes.

The renderer also reconciles its list if composition changes, while reusing surviving
nodes. Consequently zero root-iterator calls do not establish zero general traversal,
and the whole update is not O(changed route). The change bounds geometry recomputation,
not every bookkeeping pass. The passed route-topology regression tests additionally
assert that unrelated point-position getters are unread and surviving SVG nodes/
geometry remain intact. Those tests cover a focused fixture; the representative
counters do not individually attribute every unrelated coordinate read.

SVG geometry-write totals remain 4 / 2 / 1 / 4 for add / insert / remove / replace at
both sizes; all-attribute totals remain 38 / 9 / 1 / 11. Removing the middle vertex in
this fixture leaves a collinear projected chord, explaining the single path write.
Identical post-operation node counts and analytic geometry/native checks support
preserved update boundaries. Few writes alone would not prove little scene work.

Outside route topology, all valid non-time counters and snapshots have identical
before/after statistics in the captured repetitions. Representative examples:

| Roots | Scenario            | Root iterator next | Route points reads | Polygon contour reads | SVG geometry writes | All SVG writes  |
| ----- | ------------------- | ------------------ | ------------------ | --------------------- | ------------------- | --------------- |
| 3000  | load                | 6002 → 6002        | 9648 → 9648        | 7248 → 7248           | 11044 → 11044       | 73834 → 73834   |
| 3000  | vertex-position     | 0 → 0              | 13 → 13            | 0 → 0                 | 4 → 4               | 4 → 4           |
| 3000  | polygon-vertex      | 0 → 0              | 0 → 0              | 16 → 16               | 2 → 2               | 2 → 2           |
| 3000  | root-add            | 6003 → 6003        | 9647 → 9647        | 3624 → 3624           | 1 → 1               | 8 → 8           |
| 3000  | root-remove         | 6000 → 6000        | 9647 → 9647        | 3624 → 3624           | 0 → 0               | 0 → 0           |
| 3000  | layer-direct-add    | 3001 → 3001        | 9648 → 9648        | 3624 → 3624           | 4 → 4               | 34 → 34         |
| 3000  | layer-direct-remove | 3001 → 3001        | 9647 → 9647        | 3624 → 3624           | 1 → 1               | 10 → 10         |
| 3000  | pan                 | 0 → 0              | 0 → 0              | 0 → 0                 | 0 → 0               | 24 → 24         |
| 3000  | zoom                | 0 → 0              | 0 → 0              | 0 → 0                 | 0 → 0               | 103656 → 103656 |
| 5000  | load                | 10002 → 10002      | 15920 → 15920      | 11856 → 11856         | 18460 → 18460       | 123170 → 123170 |
| 5000  | vertex-position     | 0 → 0              | 13 → 13            | 0 → 0                 | 4 → 4               | 4 → 4           |
| 5000  | polygon-vertex      | 0 → 0              | 0 → 0              | 16 → 16               | 2 → 2               | 2 → 2           |
| 5000  | root-add            | 10003 → 10003      | 15919 → 15919      | 5928 → 5928           | 1 → 1               | 8 → 8           |
| 5000  | root-remove         | 10000 → 10000      | 15919 → 15919      | 5928 → 5928           | 0 → 0               | 0 → 0           |
| 5000  | layer-direct-add    | 5001 → 5001        | 15920 → 15920      | 5928 → 5928           | 4 → 4               | 34 → 34         |
| 5000  | layer-direct-remove | 5001 → 5001        | 15919 → 15919      | 5928 → 5928           | 1 → 1               | 10 → 10         |
| 5000  | pan                 | 0 → 0              | 0 → 0              | 0 → 0                 | 0 → 0               | 24 → 24         |
| 5000  | zoom                | 0 → 0              | 0 → 0              | 0 → 0                 | 0 → 0               | 174312 → 174312 |

Pan remains 24 viewBox writes and zero map-geometry writes. Zoom remains 24 viewBox
writes plus 103,632 / 174,288 symbol scale transforms over all 4318 / 7262 point
appearances, including hidden floors. Root/layer membership still takes the global
reconciliation path. Existing-vertex position remains 13 route-membership reads, no
root iteration or polygon-state reads, and four SVG geometry writes. Polygon vertex
editing remains 16 contour reads and two SVG geometry writes.

## Regression signals and interpretation limits

- The four route-edit delivery medians decrease 54.6–62.6% at 3000 and 67.3–71.3% at 5000. The count reduction and unchanged workload support a real reduction in work.
  The exact latency percentages are session observations, not controlled causal
  estimates. The 3000 route-remove p95 still worsens 51.80 → 65.10 ms despite its
  lower median; its after maximum is 80.10 ms (repeat 5).
- Load promise medians rise 69.65 → 74.55 and 123.10 → 129.65 ms. At 5000, load-to-SVG
  p95 rises 247.90 → 299.60 ms. Counters/outputs do not change. A paired quiet load
  profile is needed to distinguish OS/GC/scheduling effects from runtime cost.
- At 5000, zoom delivery median rises 21.70 → 23.30 ms and max 156.40 → 324.80 ms
  (repeat 18, frame 17). Pan max rises 46.40 → 182.20 ms (repeat 14, frame 15), while
  its p95 changes only 17.60 → 17.70 ms. Geometry/writes remain identical. The frozen
  timing data cannot identify main-thread, raster/compositor, GC or scheduling causes.
- Root-remove at 5000 has almost the same median (60.45 → 60.90 ms), but p95 rises
  113.50 → 158.30 and max 120.80 → 215.40 ms (repeat 11). The global path remains,
  with unchanged counters. This is a tail-regression signal requiring replication.
- Hit-pick medians/p95 are unchanged, but the 5000 maximum rises 3.30 → 18.90 ms
  (repeat 13, query 21). A single maximum cannot establish a broad query regression.
  The 3000 miss-pick median rises one timer quantum, 0.50 → 0.60 ms (+20%), while
  p95 stays 0.70 ms; the 5000 miss median/p95 remain 1.10 / 1.30 ms.
- Median-only percentages are especially misleading for scheduled short operations:
  5000 floor switching rises 5.45 → 10.25 ms (+88.1%) while p95 improves 34.60 →
  15.40 ms. At 3000 polygon-vertex delivery rises 7.05 → 11.75 ms (+66.7%) while p95
  improves 17.30 → 15.10 ms. Both preserve their work/output counts. Tables retain
  mixed/tail results rather than reducing these to a single speedup verdict.

Browser quantization produces zero and 0.05/0.10 ms sync medians. RAF cadence measures
callback opportunities, not completed GPU rendering, compositing or presentation.
MutationObserver delivery is not the exact last-write or display time. At 20 repeats,
nearest-rank p95 is the 19th sorted value, so one or two observations can move it
substantially. Three instrumentation repeats validate observed counts but do not
characterize population tails. Pooled frames/queries remain correlated; repeat
indices should be used for clustered inspection, not treated as hundreds of
independent runs. No significance test or confidence interval is asserted here.

## Recommended follow-up and separate defect

Proceed with batch/minimal materials under the existing scope and mini-review
process. Keep their API/behavior work separate from further performance optimization.
Do not promise a mobile/platform gate or general input-latency result from this
desktop headless capture.

The concrete next performance investigation, before choosing an optimization, is a
separate diagnostic session at 3000/5000 with CPU traces for route insert/replace:
attribute self/total time and allocations to `reconcileRootDependencies`,
`reconcileEntries`, `syncTracking`, affected clipping and renderer list reconciliation.
Count roots/appearances visited explicitly if needed; those would be new diagnostic
fields with no historical facade baseline. Check whether the remaining 2423/3991+
membership reads and list rebuilding are material once scheduling time is separated.

In the same quiet session, profile load validation/copy/resolution/background phases
and 5000-root zoom, separating scripting, style/layout, raster/compositor and GC.
For wheel/pan/pinch, inspect layout events around rectangle reads before proposing a
cache; this benchmark does not measure that input path and several DOM reads do not
prove several forced layouts. Use separate diagnostic artifacts and retain the
unchanged harness for any fresh paired timing run. Restore exact historical input
hashes outside the shared checkout, use separate fresh before-control/after prefixes,
and repeat on comparable low-load windows before classifying the tail signals as
runtime regressions. These profiles inform the next correction; they are not a new
unspecified performance threshold blocking the agreed product slice.

**Existing CI-trace defect:** `tests/e2e/camera-input.e2e.test.ts` writes failures to
`node_modules/.cache/e2e-camera-input`, but `.github/workflows/checks.yml` includes that
directory in neither the upload guard's `hashFiles` list nor uploaded paths. The
inspected merged PR #34 already has this omission. Reproduction by inspection: a
failure only in camera-input creates its zip there; when the other three diagnostic
directories are empty, the upload guard is false. Even when other diagnostics enable
upload, that zip path is absent. Recommend a separate workflow-only fix covering both
the guard and upload paths. No failure was injected, remote CI was not queried, and
the workflow/test files were not changed by this task.

## Mini-review scope

Only new after results, comparisons, verification/native evidence and this report
were created under `docs/performance/`. Historical results and baseline report remain
byte-identical. Runtime, harness, package/lockfile and design changes belong to the
preexisting checkout/other tasks. No commit, push or PR was made.
