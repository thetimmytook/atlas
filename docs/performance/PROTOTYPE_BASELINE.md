# Multi-building prototype baseline — 2026-10-09

This is the **before-runtime-fixes** baseline requested by the accepted
Repeat-review follow-up. It measures the current prototype with spatial clipping,
independent building floors and polygons. It establishes no numerical acceptance
threshold and does not pass the prototype load gate. The historical Atlas/Leaflet
reports retain their original workloads and interpretation; no Leaflet adapter was
added for this scene.

## Evidence and provenance

- [Build, environment and functional evidence](prototype-2026-10-09-before-manifest.json)
- [Raw timing](prototype-2026-10-09-before-timing.csv) and
  [timing summary](prototype-2026-10-09-before-timing-summary.csv)
- [Raw instrumentation](prototype-2026-10-09-before-instrument.csv) and
  [instrumentation summary](prototype-2026-10-09-before-instrument-summary.csv)
- Harness: `examples/prototype-bench.{html,ts,scene.ts,check.ts,instrument.ts,run.mjs}`;
  build entry and build manifest in `benchmark.config.mts`.

The source commit is `bc874494e3c1d1030b03fb593b1ea25a16a6c8d3`. Runtime files matched
the task's initial snapshot before capture. The checkout was dirty: this benchmark
was uncommitted, and other tasks were preparing documentation and regression tests.
The manifest records repository-relative dirty paths at build/capture time, SHA-256
for each runtime/harness/config/lockfile input, aggregate runtime/harness hashes,
generated background and scene-definition hashes, and hashes of every frozen build
file. Aggregate hashes use SHA-256 of JSON-serialized, sorted `[path, hash]` pairs.
Runtime aggregate: `cb4132c7dc7a88f2ac8cdcc6094e79bd4c07bcf7fc10e3f4fe07df678a6a43ad`. Harness/config aggregate: `dea70a2567c58d8ff88a1bc72ae3c87221c54e7035ddd261ece83c8eb6f8e47e`.
Scene-definition hashes substitute the stable source name `generated-background.svg`
for the ephemeral browser Blob URL.

The runner serves a temporary copied build, never a live Vite development tree. It
verifies input hashes and HEAD before/after each phase and rejects a mismatch. Builds
were sequential. The other two runtime tasks were waiting for this baseline; no
competing project tests/builds were active during capture. The runner does not start
any tests or builds. A build changing the shared `dist` cannot alter its copied input.
Temporary build copies are removed on successful completion. Browser pages are closed
between functional, timing and instrumentation phases.

Captured device: Apple M2, 8 logical CPUs, 16 GiB, macOS/Darwin 25.6.0 arm64;
Playwright 1.63.0, headless Chromium 153.0.8010.12, Node v20.19.6 for tooling.
Browser viewport 1100 × 900 CSS pixels, map viewport 960 × 640, DPR 1. Browser-reported
MacIntel/Intel UA is also preserved; it does not override the actual host architecture.
No CPU/network throttling or forced GC was applied. This is a desktop headless result,
not physical mobile or headed-browser validation. Background OS indexing and other
desktop applications were active; sanitized system load averages are recorded.
System load average (1/5/15 min) was 4.06 / 9.87 / 10.84 at capture start and
5.06 / 6.85 / 9.08 at its end. Host scheduling noise remains part of these samples.

## Scene and background

An unsigned 32-bit LCG with seed `0x50524f54` produces a repeatable common prefix:
the first 3000 roots of the 5000-root scene equal the smaller scene. Nine fixed roots
reserve isolated functional/picking probes and a route connecting two buildings.
Other roots approximate 40% points, 20% lines, 20% routes, 10% flat and 10% extruded
polygons. This combines screen-sized symbols, strokes, owned-point topology and
polygon decomposition instead of treating every root as an identical point.

| Quantity                                             |    3000 roots |    5000 roots |
| ---------------------------------------------------- | ------------: | ------------: |
| Independent root points                              |          1193 |          2009 |
| Lines                                                |           601 |          1009 |
| Routes                                               |           603 |           995 |
| Flat polygons                                        |           301 |           493 |
| Extruded polygons                                    |           302 |           494 |
| Owned `MapPoint` instances (lines + routes)          |          5914 |          9898 |
| Of those, route vertices                             |          4712 |          7880 |
| Polygon contour coordinate vertices (not `MapPoint`) |          3612 |          5916 |
| Appearances across all layers                        |          8035 |         13411 |
| Appearances in initially selected layers             |          2659 |          4433 |
| SVG element nodes, including surface                 |         16085 |         26837 |
| Shadow element / all-node counts                     | 16086 / 16089 | 26838 / 26841 |

**Roots are not SVG elements.** An appearance has a group and shape; clipped routes
can have several fragments and eligible owned-point symbols. Hidden floor groups
remain in the DOM. Polygon convex cells share one path per appearance. The counts
above exclude the external SVG background's internal document, which is one `<image>`
in the map DOM. Instrumentation records post-operation node/appearance counts too.

The map is 1200 × 800 map units. Four 520 × 300 buildings start at (40,40), (640,40),
(40,440), (640,440). Each has three automatic layers with x/y building bounds and
half-open z ranges [0,10), [10,20), [20,30). There are 13 layers including the shared
background. Operations start with floors `[0,1,2,0]`, hence five visible layers.
Spatial routes use 4/8/12 vertices and traverse z from -5 to 35. Lines cross floor
boundaries; six-vertex L contours include flat and 18-unit extruded polygons.
The connector traverses the gap between buildings. `probe-direct` is full direct
content in a layer that also has automatic bounds, exercising direct priority.

Loading follows the current public contract: all 13 layers initially start visible.
Its first render therefore includes every appearance. Selecting independent floors
is performed outside non-load operation timing; floor-switch measures only building
0 changing from floor 0 to 1. This distinction is retained for the repeat measurement.

The background generator is `backgroundSvg()` in `prototype-bench.scene.ts`.
Its exact UTF-8 output is **42,640 bytes**, SVG with intrinsic width/height 1200 × 800
and viewBox `0 0 1200 800`. It contains **1551 elements**: 1 svg, 389 rect, 389 g,
388 text, 384 path. There are 384 room groups, each with a room rectangle, door path
and label, plus four building groups/outlines/titles and a shared ground rectangle.
There are no filters, scripts, external resources or embedded raster images.
Fonts use the browser's sans-serif fallback, making cross-platform rasterization
a limitation. The generator and emitted SVG are hashed; no large generated fixture
is committed. SHA-256 of emitted SVG:
`ca3701551b18a5d9b17d798781f3bcb58d1762b672fa373df9972d3e8b80491b`.

## Independent functional checks

Both scene sizes run the same functional suite before measurement, without timing
or instrumentation. Expected results never call the runtime clipping implementation.

- An affine route/line from z=-10 to z=30 gives hand-calculated floor-0 endpoints;
  SVG coordinates are compared with literal expected coordinates. Direct content
  retains its complete polyline and produces exactly one root appearance.
- A rectangle crossing the building x boundary must have area 40 × 20 = 800.
  An edited trapezoid must have area 1500; a flat boundary polygon has area 600.
  The oracle parses emitted SVG cells and sums shoelace areas, comparing them to
  these known areas. Isolated inside/outside picks supplement area checks.
- Switching building 0 preserves building 1's layer node, markup, selection and
  original point pick. Clipping preserves source point array, point/position
  references, coordinates and polygon contour reference.
- Position, add/insert/remove/replacePoints edits check picking immediately after
  mutation, then exact analytic SVG fragments after RAF opportunities. Surviving
  endpoint identities and the existing route node for position edits are checked.
- Polygon contour/baseZ/height edits check current pick eligibility and actual SVG
  membership/area. Root addition, removal and same-instance reattachment check
  current SVG, original identity and picking; direct membership changes check
  complete versus clipped display/picking.
- Three actual browser mouse clicks exercise the component's production input path:
  original route/layer, route after position edit, and original owned vertex with
  route context after changing floors. No synthetic pointer-capture workaround is
  installed. This does not replace the separate gesture regression task.

The manifest preserves six named functional groups for each size and three native
input checks, plus an empty browser-error list. Assertions in the benchmark abort
capture on failed roots, incomplete SVG output, unexpected picks or hidden/resized
pages. Functional testing and the measurement page use separate browser contexts.

## Measurement method

Each phase runs three complete warmup repetitions per scene; warmup rows are discarded.
Timing has 20 repetitions per scene/scenario; instrumentation has three. Each scenario
loads a fresh map, so edits never accumulate between samples. Scenario order rotates
deterministically by repeat. Scene creation, attachment, initial sizing and non-load
setup are excluded from operation spans. Repeated decode/loading uses a shared Blob
background URL within a phase and browser caches; this is not cold network loading,
module startup or application launch time.

The 18 scenarios are load, pan, zoom, hit/miss picking, floor switch, one existing
route vertex position, route add/insert/remove/replacePoints, polygon vertex/baseZ/
height, root add/remove and direct-layer membership add/remove.

| Metric                                     | What it measures                                                   |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `load_call_sync_ms`                        | Call entry to synchronous return of `map.load()`'s promise         |
| `load_promise_ms`                          | Call entry to promise resolution, including background preparation |
| `operation_sync_ms` / `camera_api_sync_ms` | Synchronous mutation/setter time                                   |
| `svg_last_delivery_from_start_ms`          | Operation entry to SVG MutationObserver delivery                   |
| `post_sync_svg_delivery_ms`                | Synchronous return to that delivery, including scheduling          |
| `operation_to_two_raf_ms`                  | Operation entry to two subsequent RAF callback opportunities       |
| `raf_interval_ms`                          | Adjacent RAF timestamps: callback cadence                          |
| `spatial_pick_sync_ms`                     | One internal numeric `Spatial.hitTest()` call                      |

The minimal MutationObserver is present in timing for load/mutations and camera
motion. It timestamps delivery without counting work or scanning records. It adds
some observer/harness overhead and measures delivery, not exact last-write time.
Camera motion has 24 updates per repeat: a sinusoidal pan with amplitudes 60/40 map
units or zoom from 0.8 to 1.6 and back. Its observer records each delayed SVG update
separately from setter time. Single mutations wait two RAF opportunities, then
validate/count outside measured spans. No callback proves completed GPU rendering,
compositing or display presentation. No metric is input-to-presentation latency.

Picking performs 40 fixed hit or in-viewport gap-miss queries per repeat. Its separate
internal scene view shares the production runtime roots/layers and numeric picking
implementation; view preparation is excluded from both query timing and counters.
Native component clicks are functional checks only. These fixed query positions
and flat-scene traversal do not characterize arbitrary picking distributions,
pointer dispatch, rectangle reads or mobile gestures.

Instrumentation runs in a fresh page after timing. It patches prototype methods and
runtime getters exclusively in that phase; wrappers are restored before validation
and teardown. Its time rows are diagnostic and are excluded from the timing table.

- `root_iterator_*` counts collection iterator creation/next calls, including terminal
  next calls. It is not a count of every array scan or arithmetic instruction.
- `runtime_*_getter_reads` counts route membership and polygon state access. These
  are scene-work proxies, not exact clipping/validation call counts.
- `renderer_scene_reads`, `renderer_entries_exposed`, composition changes and drained
  changed entries describe renderer-facing scene work **for load only** (see the
  instrumentation scope limitation below). Exposed entries can count
  the same entry on repeated reads; they are not unique objects or picking candidates.
- SVG writes separate map geometry (`d`, `points`, line coordinates and group
  placement), circle screen-scale transforms and viewBox. Counts are actual
  `setAttribute` calls, not merely dirty entries; unchanged serialized geometry can
  avoid a write. Attribute removal is not counted as node removal.
- Live SVG/shadow node and total/visible appearance counts are snapshots after each
  operation, outside the captured work counters. No retained-heap or DOM allocation/
  retirement claim is made from these counts.

## Results

The raw and summary artifacts above are the numerical baseline. The following
tables are filled from those saved samples, without rounding the raw observations.

All times below are milliseconds. Cells show median / p95 / max unless stated otherwise. Timing ran 11:48:27–11:52:41 UTC; instrumentation 11:52:41–11:53:50 UTC (Riga UTC+3). There are 14,280 raw timing rows and 4842 instrumentation rows.

| Roots |    Load call sync, n=20 |       Load promise, n=20 | Load to SVG delivery, n=20 |    Load to two RAF, n=20 |
| ----- | ----------------------: | -----------------------: | -------------------------: | -----------------------: |
| 3000  |  56.60 / 66.00 / 122.40 |   69.65 / 82.60 / 139.20 |   100.05 / 120.10 / 169.50 | 124.65 / 149.70 / 192.60 |
| 5000  | 99.65 / 118.50 / 142.40 | 123.10 / 147.10 / 174.90 |   179.95 / 247.90 / 257.40 | 227.45 / 303.20 / 350.90 |

| Roots | Motion | Setter sync, n=480 | Post-sync SVG delivery, n=480 |     RAF cadence, n=480 |
| ----- | ------ | -----------------: | ----------------------------: | ---------------------: |
| 3000  | pan    | 0.00 / 0.10 / 0.10 |         16.70 / 17.40 / 33.80 |  16.70 / 16.70 / 16.80 |
| 3000  | zoom   | 0.00 / 0.10 / 0.10 |        16.70 / 19.10 / 290.30 | 16.70 / 16.80 / 283.40 |
| 5000  | pan    | 0.00 / 0.10 / 0.10 |         16.70 / 17.60 / 46.40 |  16.70 / 16.80 / 50.00 |
| 5000  | zoom   | 0.00 / 0.10 / 0.20 |        21.70 / 32.40 / 156.40 | 16.70 / 33.40 / 166.70 |

| Roots | Picking, n=800 per row |  Numeric query sync |
| ----- | ---------------------- | ------------------: |
| 3000  | pick-hit               |  0.10 / 0.20 / 3.00 |
| 3000  | pick-miss              |  0.50 / 0.70 / 1.50 |
| 5000  | pick-hit               |  0.20 / 0.30 / 3.30 |
| 5000  | pick-miss              | 1.10 / 1.30 / 10.20 |

Mutation cells show median / p95; each has n=20. Maxima and the two-RAF/cadence spans are in the summary/raw CSVs.

| Mutation            |   3000 sync | 3000 post-sync SVG delivery |   5000 sync | 5000 post-sync SVG delivery |
| ------------------- | ----------: | --------------------------: | ----------: | --------------------------: |
| floor-switch        | 0.00 / 0.00 |               10.35 / 16.50 | 0.00 / 0.10 |                5.45 / 34.60 |
| vertex-position     | 0.00 / 0.10 |               12.80 / 16.50 | 0.00 / 0.10 |               10.95 / 16.10 |
| route-add           | 0.00 / 0.10 |               42.10 / 71.40 | 0.00 / 0.10 |               59.45 / 97.70 |
| route-insert        | 0.00 / 0.10 |               40.55 / 87.10 | 0.05 / 0.10 |              61.30 / 117.10 |
| route-remove        | 0.00 / 0.10 |               41.60 / 51.80 | 0.00 / 0.10 |              62.65 / 163.20 |
| route-replacePoints | 0.05 / 0.10 |               42.85 / 67.90 | 0.00 / 0.10 |               60.95 / 77.70 |
| polygon-vertex      | 0.00 / 0.10 |                7.05 / 17.30 | 0.10 / 0.10 |                9.60 / 16.50 |
| polygon-baseZ       | 0.00 / 0.10 |               16.80 / 19.40 | 0.00 / 0.10 |               15.00 / 22.20 |
| polygon-height      | 0.00 / 0.00 |               16.30 / 19.80 | 0.00 / 0.10 |               17.95 / 22.70 |
| root-add            | 0.10 / 0.20 |               41.70 / 54.90 | 0.10 / 0.10 |              65.55 / 151.70 |
| root-remove         | 0.20 / 0.30 |               40.85 / 54.10 | 0.30 / 0.30 |              60.45 / 113.50 |
| layer-direct-add    | 0.00 / 0.10 |               41.90 / 61.40 | 0.00 / 0.10 |               61.30 / 78.40 |
| layer-direct-remove | 0.00 / 0.10 |               35.80 / 49.60 | 0.00 / 0.10 |              62.15 / 111.90 |

Separate instrumentation: counts below are **5000-root** per-scenario totals, n=3. Every repetition had the same counts (median = p95 = max). Pan/zoom totals cover 24 updates; other rows cover one operation.

| Scenario            | Root iterator next calls | Route points reads | Polygon contour reads | SVG map geometry writes | All SVG writes |
| ------------------- | -----------------------: | -----------------: | --------------------: | ----------------------: | -------------: |
| load                |                    10002 |              15920 |                 11856 |                   18460 |         123170 |
| pan                 |                        0 |                  0 |                     0 |                       0 |             24 |
| zoom                |                        0 |                  0 |                     0 |                       0 |         174312 |
| vertex-position     |                        0 |                 13 |                     0 |                       4 |              4 |
| route-add           |                     5001 |              15922 |                  5928 |                       4 |             38 |
| route-insert        |                     5001 |              15919 |                  5928 |                       2 |              9 |
| route-remove        |                     5001 |              15920 |                  5928 |                       1 |              1 |
| route-replacePoints |                     5001 |              15919 |                  5928 |                       4 |             11 |
| polygon-vertex      |                        0 |                  0 |                    16 |                       2 |              2 |
| root-add            |                    10003 |              15919 |                  5928 |                       1 |              8 |
| root-remove         |                    10000 |              15919 |                  5928 |                       0 |              0 |

The 3000-root topology operations each made 3001 iterator-next calls and 9647–9650 route-points reads; the 5000-root variants made 5001 and 15,919–15,922. Existing-vertex position changed four SVG geometry attributes at both sizes with no root iteration and 13 route-points reads. Polygon contour reads were zero for that position edit, versus 3624/5928 for route topology. This is measurable global scene work despite only 1–4 final geometry writes for the changed route. The four topology operations are distinct: remove leaves a collinear projected chord, so only one path attribute changes in this fixture.

Pan wrote only 24 viewBoxes and no map geometry. Zoom wrote 24 viewBoxes plus 174,288 circle scale transforms at 5000 roots: compensation visits all 7262 point appearances, including hidden floors. This identifies work, not a reason to change runtime in this task. Floor switching changes layer visibility without retiring DOM nodes. Root addition/removal remains a global membership workload; these samples measure one root, not bulk collection scaling.

**Instrumentation scope limitation:** renderer-facing facade counters (`renderer_scene_reads`, `renderer_entries_exposed`, `renderer_composition_changes`, `renderer_changed_entries`) are valid for load only. The facade wraps `prepare`, while non-load traces are installed after preparation. Their exported zero values in non-load rows mean **unobserved**, not zero scene work, and must be excluded from comparisons. Root iterator, runtime getter, renderer callback and SVG-write counters are installed for the actual operations and remain valid; node snapshots remain valid. This limitation was found during the final audit after the first capture. An attempted facade correction was reverted to the exact captured harness once other tasks began runtime changes; subsequent probes were discarded. No after-fix measurements are included. A future change to this instrumentation must be disclosed and cannot invent before values for those unavailable fields.

Median is the ordinary middle value (mean of the two middle values for even n).
p95 uses nearest rank `ceil(0.95*n)`. Every summary includes sample count and repeat
count, median, p95 and max. At n=20, p95 is the 19th observation and is still a weak
tail estimate; at n=3 instrumentation p95 equals max. RAF and picking rows pool
correlated within-repeat observations: n=480 frames or n=800 queries per scene/
scenario is not that many independent device runs. Browser timer quantization
produces zeros for short calls, which do not mean zero work. GC, OS scheduling,
indexing and browser rendering stages are not isolated. Differences in future tail
values need repeated comparable sessions before attributing them to runtime changes.

Repeated load resolution/copying/validation remains an observation for subsequent
profiling. This harness does not isolate its individual phases and does not establish
their share of load latency. No runtime validation boundary or optimization changed.

## Reproduction and the next measurement

Run from the repository root with the existing lockfile and supported tooling Node.
Reproducing the **before** input requires runtime `src/` bytes from the recorded
commit and the harness hashes in the manifest. If runtime fixes are already present
in the checkout, this command measures that current runtime; it must use a new prefix
and belongs to the subsequent measurement task, not a replacement of these files.
Install Chromium with the already declared Playwright package if its browser binary
is missing. Do not run tests/builds from other tasks during capture. Keep runtime
sources unchanged from the build until both phases complete. Builds must be serial
because the shared `dist` can be cleaned by another build.

```sh
npm ci
npm run bench:build
node examples/prototype-bench.run.mjs --warmups 3 --repeats 20 --instrument-repeats 3 --output docs/performance/prototype-2026-10-09-repeat
```

The runner creates its own loopback server and launches installed Chromium; it does
not need `bench:preview`. Browser/server permissions may be necessary in a restricted
environment. It rejects an existing output prefix to preserve evidence. For just
the independent functional/native checks, use `--check-only` and a fresh prefix.
For a short pipeline smoke check, use `--warmups 1 --repeats 1 --instrument-repeats 1`;
those samples must not be substituted for the 20-repeat baseline.

**The after-fix measurement is a separate next task/run.** After runtime integration,
coordinate an exclusive measurement window, run the appropriate project checks,
build once, then run the same command with a new `...-after` prefix. Keep scene,
background, harness/options, browser version, viewport/DPR and device unchanged.
Compare scene-definition/background/harness per-file hashes first; expected runtime,
build-config/git provenance differences must be identified explicitly. The aggregate
harness hash also covers the build config and lockfile, so inspect per-file changes
instead of assuming every aggregate difference changed workload semantics.
Compare timing to timing, instrumentation to instrumentation, with equal scenario
and metric names. Inspect functional/native results and total/visible appearances
before interpreting speed differences. Use the raw repeat indices to inspect
outliers and within-repeat correlation; do not claim GPU completion or a performance
gate from RAF cadence. Preserve these before files unchanged.

## Validation and scope

The new scenario passed type checking, scoped ESLint (advisory warnings remain),
Prettier checks, sequential benchmark build, both full-size functional suites,
native component picking and a short complete timing/instrumentation pipeline before
the main capture. The main capture also repeats functional checks and verifies the
frozen inputs before/after phases. Whole-checkout `npm run check` reached lint after
successful type checking but reported 11 errors in concurrently prepared route/
camera-input regression files outside this task; those files were left to their
owners. This is not recorded as a successful whole-project check.

During subsequent PR preparation, whole-checkout `npm run check` passed with advisory
lint warnings. That checkout includes the parallel runtime/test work; this check
does not replace validation of the recorded before-runtime input or add new timing.

The benchmark change contains only the new `examples/prototype-bench.*` files, the
benchmark entry/build manifest and this performance report/results. Runtime,
existing workloads/results, design documents and package/lockfile are outside its
scope. Baseline capture made no branch, index, commit, remote or PR changes; the
later explicit PR request authorizes publishing these scoped files. Parallel changes
remain separate, and the current checkout and shared index are preserved.
