# Atlas SVG baseline — 2026-10-06

Step one of the requested benchmark: current Atlas only, before architecture changes.
Implemented for mini review. Leaflet comparison is the next separately approved step.
These flat scenes do not validate layers, z, labels, zones, or volumetric clipping.
No performance budget or pass/fail threshold has been selected.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run check
npm run bench:build
npm run bench:preview
```

Open <http://127.0.0.1:8081/examples/stress.html> in a foreground browser. The
production benchmark uses the same ES2022 target and unminified transformation as
Atlas's current production library build. It is a separate Vite application; the
library entry and exports are untouched. `npm run build` clears `dist/`, so build
and preview the benchmark after the library. `npm run bench:dev` serves source
through Vite; any results from it are explicitly marked development.

Use **Preview scene** for visual inspection. Select roots, composition, and one
scenario for **Run selected**, or run the full four-scene suite. Each timing run
has one warmup and five measured repeats **per scene and scenario**. The warmup
repeat visits points-3000, points-5000, mixed-3000, mixed-5000; the next reverses
that order (the first measured repeat therefore starts with mixed-5000). Scenario
order is fixed as displayed. Every sample creates a fresh
component and scene, then disconnects and releases it. There is one engine at a
time. The full suite skips route editing in point-only scenes (N/A).

Keep the tab visible, viewport fixed, and device conditions comparable. Backgrounding
or resizing invalidates a run and removes its partial CSV rows. Download the CSV
and JSON metadata. Run **Instrument all four scenes** separately; never combine its
intrusive measurements with timing results. Exports append runs in memory; reloading
starts a fresh session. Store future results with new dated filenames; preserve
these original files. `sample = measuredRepeat * 10000 + withinRepeatIndex`;
checkpoint indices are the cumulative number of affected roots.

For an actual phone on a trusted local network, run
`npm run bench:preview -- --host 0.0.0.0`, open the host's LAN address at port 8081,
and run the same suite. Record device, OS, browser version, DPR, actual viewport,
display frequency if known, battery/power/thermal state, and image cache state. The
stage narrows on screens below 800 CSS pixels; record that change and compare engines
at the same dimensions. Desktop emulation is not a mobile measurement. No reachable
phone was supplied in this session; actual mobile performance remains unmeasured.

## Data and visual workload

Source: [shared generator](../../examples/stress.scene.ts). Seed `0x41544c53`
(decimal `1096043603`), unsigned 32-bit LCG: `state = (1664525 * state + 1013904223)
mod 2^32`. Explicit deterministic root and vertex IDs avoid UUID variance. Every
engine in step two will consume these same definitions and additional points.

Background: the existing `Factory-ground-floor.svg`, 130.81831 × 141.23242 map
units, embedded as one external SVG image. Its internal SVG nodes are not children
of the renderer surface and are excluded from surface DOM counts. This 20 KB
background is the current example, not a newly constructed heavy-background test.
Initial viewport: 800 × 480 CSS pixels. Center: background midpoint; initial scale
`min(800 / 130.81831, 480 / 141.23242)` CSS pixels per map unit. Coordinates are x
right and y down. No layers, z, labels, simplification, or viewport culling are added.
The component clips output at its SVG surface. Input handlers remain connected,
`clickTrigger = release`, and primitives have Atlas's current `pointer-events: none`;
Atlas picking comes from Spatial rather than per-primitive DOM listeners.

Points: radius 11 CSS pixels, white 2 px stroke, blue `#2775d9` fill. Lines/routes:
orange `#d95012`, 4 CSS pixel non-scaling stroke, round caps and joins, no fill.
Independent lines have two owned points **without endpoint symbols**. Routes have
one polyline plus a visible circle at every vertex, immediately after their path
in composition order. Each Atlas primitive is a `<g>` plus a shape.

Mixed scenes use each block of ten roots in order: six points, two lines, two routes.
Route vertex counts cycle 3, 6, 12, starting at 3. Route steps are +0.8 x and
`sin(vertexIndex) * 3` y relative to a random origin, clamped inside the background.
Lines connect two independent random positions. Generated origins/points occupy
x in [35, width−8), y in [8, height−8). One point at root index roots−5 is placed at
(20, 70) in the reserved gutter for repeatable picking; (-30, 70) is an in-viewport
miss. Route lengths here mean vertex/segment counts, not equal physical path lengths.
Routes are short local polylines; lines can cross the entire background. The large
screen-sized symbols make these deliberately dense synthetic scenes.

| Scene       | Root points | Root lines | Root routes | Owned points | Visible route vertices | Visual primitives | Surface SVG element nodes |
| ----------- | ----------: | ---------: | ----------: | -----------: | ---------------------: | ----------------: | ------------------------: |
| points-3000 |        3000 |          0 |           0 |            0 |                      0 |              3000 |                      6002 |
| points-5000 |        5000 |          0 |           0 |            0 |                      0 |              5000 |                     10002 |
| mixed-3000  |        1800 |        600 |         600 |         5400 |                   4200 |              7200 |                     14402 |
| mixed-5000  |        3000 |       1000 |        1000 |         8996 |                   6996 |             11996 |                     23994 |

The 600-route scene has 200 routes of each length (4200 vertices minus 600 routes = 3600
segments). The 1000-route scene has 334/333/333 routes of length 3/6/12 (5996
segments). Semantic roots, owned points, primitives, shadow element nodes, and all
shadow DOM nodes (including text nodes) are exported separately. Counts are measured
in each load sample, not inferred from the phrase “5000 objects”.

## Scenario boundaries

All non-load scenarios start after a fresh load, fit, and two subsequent rAF
callbacks, with unchanged initial geometry. Generation, root snapshots, and scene
setup are excluded from their operation spans. No batching API is invented.

| Scenario                | Action and timing boundary                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| load                    | `load_promise_ms`: call to resolution of `map.load`; includes validation/copying, model creation, asynchronous image decode, SVG preparation, scene installation, subscriptions, fit. `create_to_raf_opportunities_ms`: component construction/connection, viewport scheduling, load, then two rAF callbacks. |
| pan                     | 1500 ms continuous cycle: center x offset `15*sin(2πt)`, y offset `10*(1−cos(2πt))`; fixed initial scale. One camera setter per rAF.                                                                                                                                                                          |
| zoom                    | 1500 ms continuous cycle at the fitted center: scale multiplier `2^(1−cos(2πt))`, range 1×–4×–1×; one zoom setter per rAF.                                                                                                                                                                                    |
| hit / miss              | 200 synchronous calls to internal `Spatial.hitTest` per repeat at the fixed gutter coordinates. The Spatial view uses the displayed root collection, with its own prepared geometry view outside timing. Hit root identity and miss are checked.                                                              |
| position-single         | Move the first independent point by (+1,+1) map units.                                                                                                                                                                                                                                                        |
| position-series         | One synchronous series moving the first point of each of the first 100 roots by (+1,+1): independent points or the first owned point of a line/route.                                                                                                                                                         |
| add-100 / 500 / 1000    | Add that many deterministic independent point definitions through `map.objects.add`, synchronously. Root count increases; no prior additions survive into another sample.                                                                                                                                     |
| remove-100 / 500 / 1000 | Remove the first N original roots by exact instance through `map.objects.remove`, synchronously. Mixed roots include their owned vertices. No add-before-remove preparation.                                                                                                                                  |
| route-update            | First route (3 vertices): replace [1,2) with two fixed points (60,65), (62,67), producing 4 vertices while keeping endpoints. N/A for points-only.                                                                                                                                                            |
| wheel-input             | Extra Atlas input-path diagnostic: ten synthetic cancelable WheelEvents with deltaY −50 CSS px at the fitted client center, separated by two rAF callbacks. Dispatch construction/client anchor lookup are outside synchronous dispatch timing; native input delivery and trusted-user latency are excluded.  |

Pan/zoom export actual motion duration, number of camera updates, setter duration,
and every consecutive rAF timestamp interval. The SVG viewBox must actually change;
idle callbacks are not substituted for camera work. Setter and query timings use
`performance.now()`; sub-resolution values can be zero. Checkpoints every 100 mass
operations report cumulative API cost and include the checkpoint bookkeeping.

Mutation `operation_sync_ms` ends after the synchronous call/series. A separate
`operation_to_raf_opportunities_ms` includes waiting for two subsequent rAF callbacks.
Those callbacks are scheduling observations: they prove neither paint completion
nor pixel presentation. Likewise, load resolution does not mean the image has
appeared on screen. Renderer callback duration is available only in the separate
instrumented run; it excludes browser layout/paint/compositing and is not frame time.
Engine-specific `prepare` promise duration is likewise instrumented and includes
asynchronous decode and SVG node creation; it is not a cross-library “load” event.

Median is the ordinary middle value (average of the two middle values for even n).
p95 uses nearest rank `ceil(0.95*n)`. With only five independent operation repeats,
p95 equals max and the sample is explicitly small. Hit/miss and frame distributions
pool many correlated samples from five repeats; they are not independent device runs.
No confidence interval or arbitrary FPS target is implied.

## Instrumentation interpretation

[Local instrumentation](../../examples/stress.instrument.ts) temporarily wraps SVG
attribute writes/removals, renderer callbacks/preparation, root iterator creation
and `next` calls, route membership getters, renderer scene-entry reads/array changes,
and `getBoundingClientRect`. Originals are restored in `finally`. Runtime files and
public diagnostics contracts are unchanged. Timing results have none of these wrappers.

Counts after setup belong to the selected action; load includes its setup. Root
iterator `next` counts measure observed iteration work, not every operation in
Array.includes/filter or WeakMap. Renderer scene-array changes identify synchronization
triggers, not separate timings of private `#syncObjects`. Route membership reads are
observed getter calls, not necessarily structural comparisons. Geometry preparation
for internal hit tests is counted by instrumentation but excluded from query timing.
Rect reads are method-call counts, not proof of forced browser layout. Wheel counters
also include two rect reads for the untimed client anchor. Disconnected scenes are
moved after cleanup in instrumentation; renderer activity and stage child count must
remain zero. Stable load node counts plus fresh component disposal check logical
cleanup; retained JS heap/memory and native listener collection are not quantified.

## Recorded environment and results

Device: MacBook Pro Mac14,7, Apple M2 (8 CPU / 10 GPU cores), 16 GB.
OS: macOS 26.6.2 (25G83). Display frequency is not available from the environment.
Other normal desktop applications are running; this is not an isolated device.
No dev-mode, physical-phone, heap, or pixel-presentation measurement is claimed.

Browser: Codex's visible in-app Chromium, UA reports Chrome/154.0.0.0. The UA's
MacIntel/10_15_7 strings are compatibility values; actual OS/hardware are listed
above. Browser window 1100 × 900, map 800 × 480, DPR 1, 8 reported logical cores.
No viewport/device emulation was used to claim a phone result. Display frequency,
power mode, thermal state, and full embedded-browser build suffix are unknown.
The raw rAF cadence often starts near 16.7 ms; this does not identify panel Hz.
Factory image decode/cache was explicitly warmed; page navigation/module download
and cold network loading are outside the scene-creation span.

Atlas source commit: `10690f7a47263983fc1cb50665cada91bc6da3a1` (merged regression tests).
No `src/` changes were present. At build capture, modified files were
`eslint.config.mts`, `package.json`; untracked files were `benchmark.config.mts`,
`examples/stress.bench.ts`, `examples/stress.html`, `examples/stress.instrument.ts`,
`examples/stress.scene.ts`, `tsconfig.examples.json`. Metadata includes SHA-256
hashes of the harness, config, package/lockfile, and background; all matched the
workspace when results were copied. Documentation and result files were added/edited
during/after measurement and are not build inputs. The recorded dirty field is the
**build-time** snapshot, not a claim that documentation stayed unchanged while the
browser ran. No commit or push was performed for this step.

- Timing run: `timing-2026-10-06T13-44-06.144Z` (16:44 Riga),
  [original samples](atlas-2026-10-06-timing.csv), 14,378 rows.
- [Compact timing summary](atlas-2026-10-06-summary.csv): 672 rows for all 168
  scene/scenario/metric groups. Metric suffixes `_n`, `_median`, `_p95`, `_max`
  denote aggregate values; sample 0 denotes the whole group. Counts/checkpoints also
  have summaries; read checkpoint raw rows for cumulative per-100 growth.
- [Timing build/environment metadata](atlas-2026-10-06-runs.json).
- Instrumentation run: `instrument-2026-10-06T13-47-55.237Z` (16:47 Riga),
  [separate samples/counters](atlas-2026-10-06-instrument.csv), 3,605 rows, and
  [both run manifests](atlas-2026-10-06-all-runs.json). One repeat, no warmup;
  durations are intrusive, descriptive samples only.

Original sample CSV values retain the browser's floating-point numbers. The compact
summary rounds to six decimal places; tables below round to one decimal place. All
files are dated initial results; add future runs under distinct filenames.

### Load and bulk operations

All cells are median / p95 / max in ms. n=5 per cell: **small independent sample**;
nearest-rank p95 equals max. Creation ends at rAF opportunities, not paint.

| Scene       |       Load promise | Creation to rAF opportunities | Add 1000 synchronous | Remove 1000 synchronous |
| ----------- | -----------------: | ----------------------------: | -------------------: | ----------------------: |
| points-3000 | 11.3 / 11.6 / 11.6 |            65.0 / 76.3 / 76.3 |   25.1 / 57.6 / 57.6 |      82.3 / 98.9 / 98.9 |
| points-5000 | 16.9 / 22.9 / 22.9 |            75.7 / 96.5 / 96.5 |   38.6 / 40.7 / 40.7 |   145.8 / 149.1 / 149.1 |
| mixed-3000  | 27.4 / 28.2 / 28.2 |         102.8 / 109.2 / 109.2 |   29.2 / 30.1 / 30.1 |      85.3 / 94.2 / 94.2 |
| mixed-5000  | 44.6 / 45.4 / 45.4 |         148.3 / 166.6 / 166.6 |   41.4 / 69.2 / 69.2 |   152.4 / 157.3 / 157.3 |

### Camera frame intervals

Pooled rAF intervals from five continuous runs per cell. Motion runs actually last
1501.2–1534.7 ms across this sample; individual durations and update counts are in CSV.
These intervals include the browser's scheduling consequences of rendering work,
without assigning that entire interval to a renderer callback.

| Scene       | Motion | Interval samples | Median / p95 / max (ms) |
| ----------- | ------ | ---------------: | ----------------------: |
| points-3000 | pan    |              450 |      16.7 / 16.8 / 17.6 |
| points-3000 | zoom   |              449 |      16.7 / 16.9 / 33.4 |
| points-5000 | pan    |              403 |      16.7 / 33.4 / 50.0 |
| points-5000 | zoom   |              329 |     16.7 / 33.4 / 200.3 |
| mixed-3000  | pan    |              281 |      33.3 / 33.4 / 83.4 |
| mixed-3000  | zoom   |              248 |      33.3 / 34.3 / 50.1 |
| mixed-5000  | pan    |              168 |     50.0 / 66.0 / 100.0 |
| mixed-5000  | zoom   |              151 |      50.1 / 66.8 / 83.4 |

### Internal picking and edits

| Scene       | Hit median / p95 / max (ms) | Miss median / p95 / max (ms) |
| ----------- | --------------------------: | ---------------------------: |
| points-3000 |             0.0 / 0.1 / 0.2 |              0.4 / 0.5 / 7.8 |
| points-5000 |             0.1 / 0.1 / 2.2 |              0.8 / 0.9 / 5.1 |
| mixed-3000  |             0.0 / 0.1 / 0.2 |              2.3 / 2.4 / 9.2 |
| mixed-5000  |             0.1 / 0.2 / 6.5 |              3.9 / 4.4 / 9.6 |

Each hit/miss distribution has 1000 calls (5 × 200) and is specific to the reserved
gutter/top-of-composition target and complete miss. It does not represent every
possible object position or path hit. Very short calls quantize to 0.0 ms; this
is not zero work. A cross-library click measurement is deferred to step two.

Synchronous single/100-position/route edits mostly have medians 0.0–0.1 ms, below
useful precision at this timer resolution. The route edit has n=5 and is N/A for
point-only scenes. On mixed-5000, median operation-to-rAF opportunities was 55.8 ms
for one point, 51.2 ms for 100 root-coordinate edits, and 58.1 ms for route replacement.
These spans include scheduling and rendering, not just synchronous mutations.
Wheel dispatch has 50 samples per scene; medians quantize to 0.0 ms and p95 is 0.1 ms.
Native event delivery, drag/pinch latency, and trustworthy input-to-presentation
time remain unmeasured. Full edit distributions are in the compact summary.

### Measured counters and code interpretation

Camera pan and zoom rewrite the same number of attributes per renderer callback.
No scene-array membership change was observed during these motions.

| Scene       | Attribute writes / render | Attribute removals / render | Root iterator next calls / render | Route membership reads / render |
| ----------- | ------------------------: | --------------------------: | --------------------------------: | ------------------------------: |
| points-3000 |                      6003 |                        3000 |                              3000 |                               0 |
| points-5000 |                     10003 |                        5000 |                              5000 |                               0 |
| mixed-3000  |                     15003 |                        7200 |                              3000 |                            1800 |
| mixed-5000  |                     24995 |                       11996 |                              5000 |                            3000 |

For mixed-5000 pan, 26 renderer callbacks wrote 649,870 attributes and removed
311,896 visibility attributes; zoom's 23 callbacks wrote 574,885 and removed
275,908. Callback medians were 17.3 ms (pan) and 19.5 ms (zoom) **under intrusive
wrappers** (pan: n=26, p95=22.4, max=33.3 ms; zoom: n=23, p95=23.8, max=25.0 ms). These are not the uninstrumented camera frame interval distribution.
Single point movement also caused 24,995 writes and 11,996 removals in one callback.
Source inspection explains the broad work: `SvgRenderer.render` traverses all
primitives, applies geometry and point screen scale, and removes visibility each
time; the `prepareSceneGeometry.objects` getter scans roots and route membership.
The counter facts support investigating bounded invalidation; they do not isolate
browser paint cost or establish a projected speedup.

Mixed-5000 mass operations show the following synchronous medians (n=5) and observed
root iteration work (one separate instrumented sample, including the untimed root
snapshot and later scene synchronization):

| Operation   | Timing median (ms) | Root iterator next calls | Renderer scene-array changes |
| ----------- | -----------------: | -----------------------: | ---------------------------: |
| Add 100     |                3.6 |                   515152 |                            1 |
| Add 500     |               22.7 |                  2635752 |                            1 |
| Add 1000    |               41.4 |                  5511502 |                            1 |
| Remove 1000 |              152.4 |                  4509502 |                            1 |

Code inspection identifies repeated collection membership scans in component
add/remove handlers and array copying/filtering in the collection. The iterator
counters do not measure includes/filter directly, so assigning a percentage of
cost to copying would need profiling. Removal is already materially costly in
this sample before waiting for rendering (mixed-5000: 152.4 ms median synchronous,
196.4 ms median to rAF opportunities). Bulk operations have one later renderer
scene-array change each; route replacement also triggers one scene-array change.

Rect-read counters were zero during direct camera and mutation scenarios. Ten wheel
inputs caused 52 rect reads on every scene: two for the untimed client anchor and
five inside each dispatch. Source inspection explains those five reads through
availability checks and two coordinate conversions. This establishes repeated
reads, not five forced layouts. Its impact on native interaction needs a profiler
trace; it is a secondary candidate, not an established cause of the 50 ms intervals.

Instrumented renderer `prepare` promise samples were 6.9 / 8.6 / 13.5 / 19.9 ms
for points-3000 / points-5000 / mixed-3000 / mixed-5000 respectively (**n=1 each**).
Their asynchronous decode/SVG preparation boundary differs from complete load and
from any future Leaflet readiness event. They must not be subtracted from independent
load medians to invent a validated phase breakdown.

All 20 measured load scenes kept identical node counts per scene. Shadow DOM node
counts were 6006 / 10006 / 14406 / 23998 (same scene order), including style/text,
excluding host and ShadowRoot themselves. Add two to include those owned DOM nodes.
All 58 instrumented cleanup checks reported zero renderer callbacks after moving a
retained detached root and zero stage children. No heap or garbage-collection proof
is claimed. The instrumentation run has one sample per scenario; its callback counts
differ from timing because the wrappers affect cost.

### Priority candidates for a later approved change

1. Bound geometry/screen-scale updates and remove unchanged SVG writes on pan and
   single-object edits; rerun these exact scenes afterward. Camera frame intervals
   and per-render counters make this the strongest measured candidate.
2. Review repeated root membership scans and immutable collection copy cost for
   add/remove. Use concrete production consumers when selecting a model boundary;
   changing ownership or introducing a headless model is not part of this benchmark.
3. Review full-scan miss picking and repeated input rect reads, then measure their
   contribution separately before selecting an index or coordinate cache.

These are proposals, not implemented optimizations. Actual mobile/browser matrix,
clipped/layered/z scenes, labels, heavier backgrounds, memory, cold cache, and paint
latency remain separate validation work. Leaflet SVG is the pending primary comparison;
Canvas will be reported separately after approval.
