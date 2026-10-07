# Atlas SVG / Leaflet SVG / Leaflet Canvas — 2026-10-06

Benchmark-only step, implemented for mini review before Atlas invalidation/SVG
optimization. The engine, public API, tests, publishing and CI are unchanged.
The [original Atlas baseline](BASELINE.md) and its exports remain historical data;
the initial comparison reran Atlas together with both Leaflet renderers.
The tables below retain that historical run; the Canvas follow-up adds functional
evidence without replacing those measurements.
No numerical gates or renderer-selection decision are introduced.

## Reproduce

```sh
npm ci
npm test
npm run check
npm run build
npm run bench:build
npm run bench:preview -- --port 8083
```

Open <http://127.0.0.1:8083/examples/comparison.html> in a visible production
browser. Keep the entire 800 × 480 CSS-pixel stage inside the browser viewport.
The recorded run uses an explicit 1100 × 1100 browser viewport, DPR 1. Fill
device/OS/power notes, run the full suite, export CSV and metadata, then run
instrumentation separately. Never overlap builds, browser tests or other heavy
tasks with timing. Use a different port if an existing preview owns 8081.
Development results are explicitly marked development; use production for comparison.

Preview selects one renderer; timing always compares all three sequentially.
The sparse smoke fixture is separate, untimed, and uses one gutter point,
two independent lines and a three-vertex route. The last line overlaps the
last vertex to reveal composition order. Check this fixture and the dense scenes
visually; no pixel-perfect equivalence across renderers is claimed.
Every selected/full/instrumented run now automatically executes seven separate
Canvas renderer controls before any sample or intrusive counter is started.
Use **Check Canvas drawing and fault recovery** for the separate functional
diagnostic; its results are in run metadata and never add timing CSV rows.

## Version and public API basis

Leaflet and its declarations are exact devDependencies: `leaflet@1.9.4` and
`@types/leaflet@1.9.21`. No Leaflet import occurs in `src/`; library mode excludes
the examples. The [official download page](https://leafletjs.com/download.html)
identifies 1.9.4 as stable. Because the live web reference now describes 2.0 alpha,
the API documentation used here is the official API comments pinned to the
[1.9.4 source tag](https://github.com/Leaflet/Leaflet/tree/v1.9.4/src):
[Map options and camera methods](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/map/Map.js),
[CRS.Simple](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/geo/crs/CRS.Simple.js),
[Polyline options](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/layer/vector/Polyline.js),
[CircleMarker](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/layer/vector/CircleMarker.js),
[SVG](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/layer/vector/SVG.js), and
[Canvas](https://github.com/Leaflet/Leaflet/blob/v1.9.4/src/layer/vector/Canvas.js).
Leaflet itself is not patched, subclassed or instrumented through private members.

## Shared workload and coordinate controls

All measured scenes consume unchanged `stress.scene.ts` definitions/additions:
seed `0x41544c53`, deterministic IDs, original root order, positions, line endpoints,
route vertices, and mutation sequence. The Factory SVG is the same external image,
130.81831 × 141.23242 map units; embedded image-internal nodes are excluded from
surface node counts. The stage background is the same `#edf2f8` for all renderers.

| Scene       | Roots: points / lines / routes | Owned points | Route symbols | Visual primitives |
| ----------- | -----------------------------: | -----------: | ------------: | ----------------: |
| points-3000 |                   3000 / 0 / 0 |            0 |             0 |              3000 |
| points-5000 |                   5000 / 0 / 0 |            0 |             0 |              5000 |
| mixed-3000  |               1800 / 600 / 600 |         5400 |          4200 |              7200 |
| mixed-5000  |             3000 / 1000 / 1000 |         8996 |          6996 |             11996 |

`CRS.Simple` maps longitude to x and reverses latitude for screen y; Atlas
`(x,y)` therefore becomes Leaflet `[latitude,longitude] = [-y,x]`.
Atlas scale is CSS pixels per map unit; Leaflet zoom is `log2(scale)`.
Initial center is `(width/2,height/2)` and scale is
`min(800/width,480/height)`. Independent controls `(0,0)`, `(10,20)` and
`(100,40)` compare Leaflet screen coordinates with the analytical formula
`(viewport/2) + (position-center)*scale`. These controls do not reuse the
adapter's conversion helper. Leaflet's native projected coordinate/image-edge
rounding remains; controls allow 1.5 CSS px, camera center 1.1 CSS px. Atlas
model controls are exact within floating-point tolerance and its displayed
viewBox is checked separately. These are correctness tolerances, not performance gates.

Points use 11 CSS px radius, opaque `#2775d9` fill and 2 px white stroke.
Independent lines/routes use opaque `#d95012`, 4 CSS px stroke, round caps/joins.
Every route vertex has a point symbol immediately after its route path; independent
line endpoints have no symbol. Leaflet uses `CircleMarker`, not geographic circles
or icon markers; lines and routes are polylines. One concrete adapter groups the
Leaflet path and vertex layers for each input root, without adding an engine abstraction.
Route replacement removes interior symbols, keeps endpoints, installs the new
interior, then uses public `bringToFront` calls to restore root/path/vertex order.
That ordering work belongs to the Leaflet route-update timing boundary.

Leaflet uses `zoomSnap: 0`, disabled camera/fade/marker animations and inertia,
polyline `smoothFactor: 0`, `noClip: true`, and renderer `padding: 0`. Paths are
noninteractive as in Atlas's current SVG. Native map input handlers remain attached.
Leaflet retains circle viewport culling and Canvas redraw-region/layer behavior;
these public settings do not disable all internal culling. Atlas retains every
primitive and clips at its outer SVG surface. The original no-layer/no-z/no-label
scope remains. Real 3D, heavy backgrounds, materials and mobile are separate work.

## Samples and timing boundaries

Each actual timing sample gets a fresh host/map, fresh runtime scene, initial camera
and decoded background. Deterministic input generation, root snapshots, mutation
definitions and correctness oracles are prepared outside operation spans.
One warmup and five measured repeats run for each scene/scenario/available variant.
Scene order reverses every other repeat. Engine order rotates and alternately reverses
through `A,S,C`; `A,C,S`; `C,A,S`; `C,S,A`; `S,C,A`; `S,A,C` including warmup.
Only one engine runs at a time; this reduces order bias without eliminating device drift.

| Metric                              | Boundary and comparability                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_to_raf_opportunities_ms`    | Common start before host/adapter construction and connection; two RAF opportunities for connected sizing; engine setup; two more RAF opportunities. Completion requires decoded background, installed primitives and camera. Validation follows the timed end. Navigation/module download and one pre-run image-cache warmup are excluded. |
| `atlas_load_promise_ms`             | Only call to resolution of `MapElement.load`: validation/copying, model/SVG/image preparation, installation/subscriptions and fit. Host construction and sizing are outside this metric.                                                                                                                                                   |
| `leaflet_scene_setup_ms`            | Leaflet map construction/sizing, camera, overlay/path installation, image load and decode. The plain host div is already connected. This is not a Leaflet readiness event and is not interchangeable with Atlas load-promise timing.                                                                                                       |
| `operation_sync_ms`                 | Prepared synchronous mutation API call/series including required adapter translations and per-100 checkpoint bookkeeping. Atlas rendering is generally deferred; Leaflet SVG setters can project/write paths immediately; Canvas can schedule redraw. These boundaries describe API work, not equal backend completion.                    |
| `operation_to_raf_opportunities_ms` | Same mutation start through two subsequent RAF callbacks. Scheduling observation, not pixel presentation or paint completion.                                                                                                                                                                                                              |
| `camera_api_sync_ms`                | One Atlas center/scale setter or public Leaflet `panTo`/`setView`, animation disabled. Backend scheduling differs, so report alongside RAF intervals.                                                                                                                                                                                      |
| `frame_interval_ms`                 | Consecutive RAF timestamps during the same 1500ms wall-clock trajectory from `cameraAt`; actual elapsed motion and camera-update counts are also exported. No claim that each interval is renderer/paint time.                                                                                                                             |
| `svg_element_nodes`                 | Actual surface elements including SVG root; Factory image internals excluded. Canvas is N/A.                                                                                                                                                                                                                                               |
| `owned_element_nodes`               | Host plus renderer-owned descendants. Atlas shadow elements and Leaflet light-DOM elements have the same ownership scope; text nodes are not included.                                                                                                                                                                                     |

Pan: center offsets `15*sin(2πt)` and `10*(1-cos(2πt))`; zoom:
initial scale multiplied by `2^(1-cos(2πt))`. Both return to the initial camera.
One midpoint correctness observation checks actual camera/display outside the setter
span; its small verification cost can affect a following RAF interval and is not
subtracted from the data. Faster engines get more updates along the same continuous
trajectory. A common fixed-frame workload is not substituted for this original scenario.

Mutations preserve position-single, first-100-root position series, independent-point
additions of 100/500/1000, exact-first-root removals of 100/500/1000 and first-route
interior replacement with `(60,65)`/`(62,67)`. Checkpoints occur every 100 mass operations.
Point-only route updates are N/A.

Leaflet 1.9.4 has no public synchronous query with Atlas `Spatial.hitTest` semantics.
The Canvas event handler's internal scan is not a public equivalent. Leaflet hit/miss
is N/A; there is no benchmark-owned scan presented as Leaflet picking. Atlas's
200-call hit/miss distributions and ten synthetic wheel dispatches remain separate
diagnostics. Leaflet wheel-input is N/A because native debounce/input and zoom rules
differ. Event delivery latency is not substituted for synchronous query cost.

## Correctness and exclusion

Before accepting a sample, compare actual state with a definition/scenario oracle:
all root membership/order, positions, line endpoints, route vertex membership/order,
removed roots/vertices and absence of extra installed paths. Initial scenes are also
checked, not only mutated scenes. Actual loaded background and camera are required.

Atlas reuses the original deep checker for runtime/model, retained spatial view,
SVG group/shape order, coordinates, symbol sizes and picking. Additional checks cover
background dimensions/source, computed colors, caps/joins and displayed viewBox.
Leaflet SVG checks public installed layers and coordinates, actual path-node composition,
all path data and style attributes, circle size/culling, and independent camera controls.
There are no adapter getters that return saved expected positions as verification.

**Each dense Canvas sample** retains public layer membership, all coordinates,
route vertex identity/order, removed layers, no extra paths, loaded background,
independent CRS/camera/background-position controls, and the gutter RGBA pixel.
The gutter is unchanged by mutations and cannot prove a changed object's redraw.
Dense scenes may fully occlude that object, so bitmap change is not required.
These checks alone still accept a frozen bitmap with a correct public model.

**Sparse Canvas renderer preflight** separately uses seven deterministic fixtures:
independent point movement, line-endpoint movement, route-vertex movement including
its connecting segment, addition over a line, point removal under a surviving line,
whole-route removal, and interior route replacement under a later overlapping line.
Movement uses the original `(+1,+1)` operation, not a larger test-only displacement.
Replacement uses the original two `(60,65)`/`(62,67)` vertices. Each fixture is a fresh
real Leaflet Canvas map. Expected before/after definitions come from the existing
pure definition/operation oracle; actual output is read from the renderer's own
Canvas, not from layer getters or an SVG replacement.

`comparison.canvas.ts` draws those definitions on detached native Canvas references
in input root/path/vertex order, using the fixed benchmark appearance. Projection
uses the public `latLngToContainerPoint` on input positions; independent analytical
CRS checks remain separate. This is a concrete example-local helper, not a new runtime
contract or a general visual-test framework. The background ImageOverlay is outside
the vector Canvas and retains its separate checks.

Probes compare stable reference interiors and transparent cleared regions. Expected
output must have a flat palette/alpha in a diamond neighborhood with an axial
radius of about one CSS pixel; fractional edges are skipped. At backing scale 1
this is the center plus its four axial neighbors, not the corners of a 3 x 3 square. The old reference classifies each
probe itself, so eroding both images does not erase the narrow moved-circle crescents.
Checks cover new blue fill, new orange segments, and cleared old symbols/segments;
checking only the center of overlapping old/new circles would be insufficient.
The whole stable after-reference is checked, including unchanged surviving paths
and orange-over-blue overlap order. Route replacement covers both new circles'
exclusive output, visible connecting segments, removed interior circles/old path,
and the later line crossing the replacement vertices.

Backing coordinates/scales come from the actual Canvas size and CSS bounds;
Leaflet 1.9.4 uses a backing scale of 1 or 2 rather than arbitrary DPR. A reference
pixel must be exactly opaque blue/orange/white or transparent. Actual opaque probes
allow RGB channel error <=24 and alpha >=239; cleared probes require alpha <=8.
These bounded tolerances accommodate native clipped-damage antialiasing and remain
well below palette separation. Every fixture must have nonzero probes for each
required new/old symbol/path category. A successful model with stale drawing therefore
fails output validation, instead of passing because a fixture has no changed probes.

Preflight metadata records definitions, expected definitions, required categories,
probe/mismatch counts and backing scales for every attempted case. Failure retains
its case/reason, sets the run failed and stops before `executeSamples`; all partial
rows are discarded. Reference drawing, pixel readback and preparation happen before
timing/sample instrumentation. Measured workloads/styles/camera trajectories and
operation boundaries are unchanged; no fixture is substituted for a 3000/5000 scene.

The separate diagnostic first runs all fixtures normally. It then verifies initial
output on fresh maps, replaces only that Canvas instance's public 2D-context
`clearRect`, `fill` and `stroke` methods with no-ops, and executes the same operations.
It requires an unchanged complete bitmap and failures in every required changed
probe category while public model checks still pass. Methods are restored in `finally`,
including exceptional paths. A public `panTo` camera round-trip then refreshes the
whole Canvas, returns to the initial camera and must pass the same after-operation
oracle on the same mutated model. `Path.redraw` on surviving layers alone cannot
clear removed objects' old pixels, which is why recovery refreshes the full surface.
The in-page fault injector is only reachable from this diagnostic, never a timing
or preflight mode. No Leaflet source, private member, Canvas prototype, or Atlas API
is patched by the harness. A separate external review driver tests drawing-fault
propagation through normal preflight, as recorded in the 2026-10-07 follow-up below.

Remaining limits: sparse controls do not certify every dense mutation's pixels,
fully occluded segments, or every antialiased boundary. They validate this fixed
appearance/order and mutation set, not arbitrary clipping/layers/materials or picking.
Projection shares a public Leaflet map API with the renderer, so it is not an entirely
independent camera implementation. Current verification covers DPR 1 in headless
Chromium 153 and embedded Chromium 154; other DPRs, physical mobile devices and other
browser engines are unvalidated. Suppression
was tested for the three draw methods together, not each method in isolation. Readback
and two RAF callbacks prove bitmap contents at validation, not pixel presentation time.

Rows are buffered until correctness and visibility/viewport checks pass. A mismatch,
hidden page, stage/window resize, DPR change or trusted user input invalidates the
run; all its partial rows are discarded and a reason is retained in metadata.
Reloading loses the in-memory run; an interrupted run is not exported as complete.
Warmups never enter measured CSV rows. N/A rows are explicit unavailable slots and
are excluded from numerical summaries.

## Intrusive counters — separate run

Timing has no patched DOM methods. The separate instrumentation run wraps SVG
`setAttribute`/`removeAttribute` and observes renderer-owned DOM child-list mutations,
including Atlas's shadow root. Counter reset precedes setup for load and follows
preparation/oracle creation for mutations. Snapshot precedes result validation and
disposal. DOM additions/removals count **observed nodes in child-list records**, not
all detached allocations or browser layout/paint work; moving a node contributes
both removal and addition. Neither callback duration nor Canvas draw cost is inferred.
Canvas SVG/DOM-work counters are N/A, never zero. The original Atlas-only deeper
instrumentation remains available in `stress.html`; its historical counters are
separate from this run.

## Historical environment and results — before strengthened Canvas checks

Recorded on MacBook Pro Mac14,7, Apple M2, 16 GiB, macOS 26.6.2 (25G83),
AC power/battery 100%. Codex's embedded Chromium reports Chrome/154.0.0.0
(underlying app framework path reports 154.0.8037.98). Browser viewport override
1100 × 1100, stage 800 × 480, DPR 1, 8 reported logical cores. UA MacIntel/10_15_7
are compatibility strings. Normal desktop applications remain running; this is not
an isolated or thermal-controlled machine. Native UI inventory reported a locked
macOS session before measurement; these are automated, browser-visible RAF samples,
not proof of an unlocked desktop's pixel presentation. Display frequency, power mode
and thermal state are unknown. No physical phone measurement was performed.

- Timing: `comparison-timing-2026-10-06T15-01-04.731Z` (18:01 Riga),
  [raw CSV](leaflet-2026-10-06-150104-timing.csv), **27,338 rows**.
  Five independent measured repeats per available scenario/variant: 750 actual
  samples and 150 scenario N/A slots; metadata's 900 count explicitly counts slots.
  There are 170 N/A rows: 150 unavailable scenarios plus 20 Canvas SVG-node counts.
- [Compact timing summary](leaflet-2026-10-06-150104-summary.csv): **776 groups**,
  with n, median, nearest-rank p95 and max. Per-100 cumulative checkpoints are grouped
  by checkpoint number rather than pooled together. N/A is excluded from statistics.
- Separate counters: `comparison-instrument-2026-10-06T15-51-13.379Z` (18:51 Riga),
  [intrusive CSV](leaflet-2026-10-06-155113-instrument.csv), **5,302 rows**,
  one repeat, no warmup, 150 actual samples plus 30 unavailable scenario slots.
  This CSV also retains the instrumented scheduling/API observations, explicitly
  identified by its runId; they are not used in timing tables below.
- [Browser run manifests](leaflet-2026-10-06-runs.json) preserve raw environment,
  versions, dirty snapshot, settings, boundaries, scene counts and all **57 SHA-256
  input hashes**. Each hash was verified against the saved workspace. The source
  commit is `f393bc3bb2ad7d0b2cf6afc98904aab7c179ae33`; `src/` is unchanged.
  [Built-asset hashes](leaflet-2026-10-06-build.json) additionally identify the
  exact production output. Documentation/results were added after measurement and
  are outside the hashed build inputs; dirty is the build-time snapshot.
- An earlier intrusive attempt at 15:08 UTC was discarded when export work stalled
  the browser long enough to miss the motion midpoint control. Its failure reason
  remains in manifests; **none of its rows enter the saved CSVs**. Exports were
  moved entirely after the successful intrusive run.
- A separate [resize rejection check](leaflet-2026-10-06-exclusion-check.json)
  deliberately changed the viewport during an additional warmup. It recorded
  `window resized`, discarded every row of that run and kept the accepted CSV
  at exactly 4,543,102 bytes. It is not a numerical performance result.

Every reported actual sample passed the checks available in that original build.
Those Canvas checks included the unchanged gutter pixel and public layer state;
**none of the historical samples ran the new sparse preflight**. The original
CSV/manifests and tables are preserved byte-for-byte, without retroactive certification. Sparse smoke and
mixed-5000 dense previews were visually inspected for all three variants. Screenshots
are temporary files outside Git. Colors/primitive counts and composition match;
Leaflet's native coordinate rounding remains visible at subpixel edges.

Cells below are **median / p95 in milliseconds**. Load/mutation cells have **n=5**;
nearest-rank p95 equals max at this small sample size. Do not infer stable tail
probabilities from five repeats. Frame intervals pool correlated callbacks from
five independent motion runs; their n is shown explicitly. Short API values can
quantize to 0.0 ms; this is not zero work.

### Common creation to RAF opportunities

| Scene       | Atlas SVG     | Leaflet SVG   | Leaflet Canvas |
| ----------- | ------------- | ------------- | -------------- |
| points-3000 | 60.3 / 62.1   | 70.1 / 75.7   | 51.9 / 60.6    |
| points-5000 | 66.2 / 81.1   | 76.0 / 110.8  | 61.7 / 77.0    |
| mixed-3000  | 102.4 / 110.0 | 106.9 / 118.8 | 69.0 / 79.1    |
| mixed-5000  | 176.3 / 196.1 | 153.3 / 182.3 | 92.3 / 110.0   |

Only this creation boundary is shared. The following engine setup metrics have different start/work boundaries and are deliberately named separately.

### Engine-specific setup (do not treat as equal phases)

| Scene       | Atlas load promise | Leaflet SVG scene setup | Leaflet Canvas scene setup |
| ----------- | ------------------ | ----------------------- | -------------------------- |
| points-3000 | 11.4 / 13.0        | 32.4 / 33.1             | 4.1 / 4.4                  |
| points-5000 | 16.6 / 20.4        | 50.5 / 53.4             | 6.4 / 6.7                  |
| mixed-3000  | 27.0 / 33.0        | 75.9 / 78.7             | 9.6 / 9.9                  |
| mixed-5000  | 47.0 / 53.4        | 123.7 / 128.9           | 18.9 / 31.7                |

### Consecutive RAF intervals during motion

| Scene / motion     | Atlas SVG           | Leaflet SVG         | Leaflet Canvas      |
| ------------------ | ------------------- | ------------------- | ------------------- |
| points-3000 / pan  | 16.7 / 16.8 (n=447) | 16.7 / 16.8 (n=448) | 16.7 / 18.0 (n=435) |
| points-3000 / zoom | 16.7 / 17.0 (n=442) | 16.7 / 16.8 (n=448) | 16.7 / 17.6 (n=443) |
| points-5000 / pan  | 16.7 / 33.3 (n=410) | 16.7 / 16.8 (n=450) | 33.0 / 33.4 (n=297) |
| points-5000 / zoom | 16.7 / 33.4 (n=344) | 16.7 / 33.4 (n=354) | 16.7 / 33.4 (n=380) |
| mixed-3000 / pan   | 33.3 / 34.0 (n=272) | 16.7 / 17.8 (n=433) | 33.3 / 50.1 (n=232) |
| mixed-3000 / zoom  | 33.4 / 49.9 (n=234) | 33.4 / 50.0 (n=238) | 16.7 / 50.1 (n=304) |
| mixed-5000 / pan   | 50.0 / 66.7 (n=159) | 33.3 / 34.6 (n=253) | 16.8 / 83.4 (n=178) |
| mixed-5000 / zoom  | 50.1 / 83.3 (n=138) | 50.1 / 83.3 (n=135) | 33.3 / 83.4 (n=220) |

These are scheduler intervals, not actual pixel-rendering times. Setter durations and actual elapsed motion/update counts remain in raw CSV and summary.

### Synchronous bulk API work

| Scene / operation         | Atlas SVG     | Leaflet SVG | Leaflet Canvas |
| ------------------------- | ------------- | ----------- | -------------- |
| points-3000 / add-1000    | 28.9 / 30.7   | 4.4 / 4.5   | 0.9 / 0.9      |
| points-3000 / remove-1000 | 84.3 / 85.7   | 1.3 / 1.3   | 0.6 / 0.8      |
| points-5000 / add-1000    | 41.8 / 42.1   | 4.5 / 4.7   | 1.0 / 1.1      |
| points-5000 / remove-1000 | 150.1 / 150.2 | 1.2 / 1.5   | 0.6 / 0.7      |
| mixed-3000 / add-1000     | 29.5 / 33.2   | 4.7 / 5.2   | 0.8 / 1.0      |
| mixed-3000 / remove-1000  | 85.8 / 90.1   | 2.7 / 2.8   | 1.2 / 1.3      |
| mixed-5000 / add-1000     | 43.4 / 45.4   | 4.5 / 4.9   | 1.0 / 1.0      |
| mixed-5000 / remove-1000  | 146.4 / 150.7 | 3.0 / 3.1   | 1.3 / 1.4      |

### All mixed-5000 edits: sync → two RAF opportunities

| Operation       | Atlas SVG                     | Leaflet SVG               | Leaflet Canvas          |
| --------------- | ----------------------------- | ------------------------- | ----------------------- |
| position-single | 0.0 / 0.0 → 55.5 / 58.4       | 0.0 / 2.2 → 16.8 / 19.3   | 0.0 / 0.1 → 7.6 / 8.4   |
| position-series | 0.1 / 0.1 → 45.9 / 48.8       | 0.3 / 0.5 → 19.0 / 19.6   | 0.1 / 0.1 → 70.1 / 72.6 |
| add-100         | 10.3 / 14.1 → 60.0 / 66.2     | 0.5 / 0.6 → 18.1 / 18.6   | 0.2 / 0.2 → 70.6 / 71.0 |
| add-500         | 24.8 / 112.0 → 83.2 / 186.4   | 2.4 / 2.5 → 19.0 / 19.3   | 0.5 / 0.5 → 72.7 / 73.5 |
| add-1000        | 43.4 / 45.4 → 107.0 / 110.7   | 4.5 / 4.9 → 30.8 / 34.5   | 1.0 / 1.0 → 76.4 / 76.7 |
| remove-100      | 21.5 / 23.2 → 72.4 / 75.1     | 0.5 / 0.7 → 16.5 / 17.7   | 0.3 / 0.4 → 68.3 / 73.9 |
| remove-500      | 80.0 / 167.3 → 130.8 / 222.2  | 1.6 / 1.9 → 17.9 / 19.6   | 0.7 / 0.8 → 64.5 / 68.9 |
| remove-1000     | 146.4 / 150.7 → 189.0 / 194.8 | 3.0 / 3.1 → 16.4 / 20.0   | 1.3 / 1.4 → 57.1 / 63.0 |
| route-update    | 0.0 / 0.1 → 54.6 / 60.6       | 15.5 / 17.1 → 77.3 / 85.1 | 1.3 / 3.4 → 71.0 / 73.6 |

In this table each side of the arrow is median / p95, n=5. The right side observes scheduling opportunities, not backend-completion-equivalent time. Other scene/edit distributions and all checkpoints are in the summary.

### Actual DOM: surface SVG elements / owned elements

| Scene       | Atlas SVG     | Leaflet SVG   | Leaflet Canvas |
| ----------- | ------------- | ------------- | -------------- |
| points-3000 | 6002 / 6004   | 3002 / 3016   | N/A / 15       |
| points-5000 | 10002 / 10004 | 5002 / 5016   | N/A / 15       |
| mixed-3000  | 14402 / 14404 | 7202 / 7216   | N/A / 15       |
| mixed-5000  | 23994 / 23996 | 11998 / 12012 | N/A / 15       |

All n=5 counts were stable within each engine/scene. Different DOM counts are part of the result; Canvas N/A does not mean no rendering work.

### Atlas-only diagnostics; Leaflet is N/A

| Scene       | Hit (n=1000) | Miss (n=1000) | Synthetic wheel dispatch (n=50) |
| ----------- | ------------ | ------------- | ------------------------------- |
| points-3000 | 0.0 / 0.1    | 0.4 / 0.5     | 0.0 / 0.1                       |
| points-5000 | 0.0 / 0.1    | 0.8 / 0.9     | 0.0 / 0.1                       |
| mixed-3000  | 0.0 / 0.1    | 2.3 / 2.4     | 0.0 / 0.1                       |
| mixed-5000  | 0.1 / 0.2    | 3.8 / 4.0     | 0.0 / 0.1                       |

### Single-point SVG counters (separate run, n=1)

| Scene       | Atlas writes / removals | Leaflet SVG writes / removals | Leaflet Canvas |
| ----------- | ----------------------- | ----------------------------- | -------------- |
| points-3000 | 6003 / 3000             | 1 / 0                         | N/A            |
| points-5000 | 10003 / 5000            | 1 / 0                         | N/A            |
| mixed-3000  | 15003 / 7200            | 1 / 0                         | N/A            |
| mixed-5000  | 24995 / 11996           | 1 / 0                         | N/A            |

### Mixed-5000 intrusive motion totals (n=1)

| Motion / engine       | Camera updates | SVG writes | SVG removals |
| --------------------- | -------------- | ---------- | ------------ |
| pan / Atlas SVG       | 23             | 574885     | 275908       |
| pan / Leaflet SVG     | 38             | 455886     | 0            |
| pan / Leaflet Canvas  | 18             | N/A        | N/A          |
| zoom / Atlas SVG      | 22             | 549890     | 263912       |
| zoom / Leaflet SVG    | 18             | 647820     | 0            |
| zoom / Leaflet Canvas | 22             | N/A        | N/A          |

Totals reflect different update counts under intrusive wrappers, so they must not
be compared as equal-frame workloads. For mixed-5000 position-series, Atlas wrote
24,995 attributes and removed 11,996; Leaflet SVG wrote 120 with no removals.
For route-update, Atlas observed 2 DOM additions/1 removal, while Leaflet SVG
observed 11,991 additions/11,990 removals, mainly public composition reordering.
This adapter cost explains why Leaflet SVG's route update is a poor proxy for
Atlas's identity-preserving route operation; the difference is exposed rather
than omitted from its timing. No Canvas work count is inferred.

### Implications for the next Atlas optimization

1. Single-object invalidation/affected SVG updates remain the clearest bounded
   target: the separate counters show full-scene Atlas writes after one point moves,
   against one changed Leaflet SVG path. This is evidence of avoidable broad work,
   not a promised speedup or a full browser-paint cost breakdown.
2. Atlas bulk root operations have much higher synchronous costs in this run.
   Investigate collection copying and repeated scene/membership scans as planned;
   Leaflet lacks Atlas's validation/copying/model semantics, so its faster add/remove
   API is an external reference rather than proof that equivalent validation is free.
3. SVG remains plausible: Leaflet SVG performs better on several pan/edit workloads
   while retaining the same defined primitives. Its mixed-5000 zoom RAF distribution
   is similar to Atlas's, and its route-order adaptation is expensive. The comparison
   does not justify choosing a new renderer from this single desktop run.
4. Canvas is workload dependent. It has lower setup/API costs and very fast isolated
   point edits here, but full redraws/damage regions make series, bulk changes and
   routes more expensive than their synchronous setter times suggest. For mixed-5000
   pan its 16.8ms median hides an 83.4ms p95; it is not uniformly smoother.
5. Re-run the same fresh-scene harness after an approved Atlas change. Preserve all
   dated files, compare current runs under equal conditions, and treat the older
   baseline separately. Physical phones, native input delivery, pixel presentation,
   thermal drift, heap/GC attribution, other browsers, layers/z/clipping/labels and
   a heavy background remain unvalidated.

## Canvas functional follow-up — 2026-10-06

Production functional run `canvas-functional-2026-10-06T20-06-49.091Z`
(23:06 Riga) used embedded Chromium, an 1100 x 1100 window, 800 x 480 stage,
DPR 1 and Leaflet 1.9.4. Hardware/power/thermal conditions are not independently
controlled. [Functional metadata](leaflet-canvas-2026-10-06-200649-functional.json)
contains **60 build-input SHA-256 hashes**, all fixture definitions and raw probe
results. It produced zero timing rows (CSV header only).

| Fixture                     | Normal output | Frozen bitmap mismatched probes | Restored output |
| --------------------------- | ------------- | ------------------------------: | --------------- |
| Independent point           | pass          |                              56 | pass            |
| Line endpoint               | pass          |                              87 | pass            |
| Route vertex and path       | pass          |                             134 | pass            |
| Add over line               | pass          |                             208 | pass            |
| Remove under line           | pass          |                             248 | pass            |
| Remove route                | pass          |                            2218 | pass            |
| Route replacement and order | pass          |                            2588 | pass            |

All 14 initial scenes passed. All seven suppressed bitmaps remained byte-identical;
public model checks passed, every required changed category failed pixel comparison,
and method identity was restored before the seven successful recovery checks.
Counts above are unique mismatched probes, not sums of overlapping color categories.

Selected harness acceptance runs `20:07:11.659Z` (points-5000 position-single) and
`20:07:40.509Z` (mixed-3000 route-update) each passed all seven normal preflight
fixtures, one warmup and five repeats for **all three variants**: 15 accepted samples
per run. Their [metadata](leaflet-canvas-2026-10-06-200649-selected-runs.json) and
[60 timing rows](leaflet-canvas-2026-10-06-200649-selected-timing.csv) are separate
acceptance evidence; they do not update the historical performance tables or combine
new Canvas observations with old SVG observations.

A [preflight rejection check](leaflet-canvas-2026-10-06-200649-preflight-rejection.json)
resized the browser during a third run's sparse checks. It retained the failed
preflight/reason after three attempted cases, accepted zero samples and added zero
rows; the previously accepted 9110-byte CSV remained byte-identical. This tests
preflight failure propagation, not a drawing-method fault inside a timing run.

[Production asset/input hashes](leaflet-canvas-2026-10-06-200649-build.json) identify
the exact final build. The [verification manifest](leaflet-canvas-2026-10-06-200649-verification.json)
records checks and the 63 preserved hashes: original exports, stress source,
Atlas src/tests and package/lockfile are unchanged from the start of this follow-up.
All 60 current input hashes matched the saved worktree. Documentation/exports were
added after the production build and are outside these inputs; dirty remains the
build-time snapshot. No full-suite performance rerun was required for this functional
follow-up. Source edits are limited to three new example-local helpers, the concrete
Leaflet checker, benchmark run/UI, input hashes, and this documentation.

## Diagonal Canvas probe follow-up — 2026-10-07

The [before-fix reproduction](leaflet-canvas-2026-10-07-probes-before.json)
confirmed the review in headless Chromium **153.0.8010.12**, DPR 1, window
1100 x 1100, stage 800 x 480, production preview on port 8187. The normal
independent point passed, and line-endpoint had pixel agreement (`output.passed=true`,
zero mismatches) but **zero orange-new probes**. Mandatory coverage rejected the
functional run and normal Run selected before any samples/rows. Fault injection
was off. Pixel agreement and sufficient changed-geometry coverage are distinct;
`output.passed` describes the former, and `requireOutput` requires both.

The square flat-color neighborhood was the cause. Its corner samples can extend
outside the fully opaque core of a 4 CSS-pixel diagonal stroke. In Chromium 153
no newly orange pixel survived that filter, whereas the prior embedded 154 run
had 11 such probes. A correct bitmap was therefore rejected because the checker
had no new-stroke coverage, rather than because it found incorrect output.

The only functional source change replaces the square erosion with a diamond:
`abs(dx) + abs(dy) <= margin`. The axial CSS radius, exact reference palette,
old-reference classification at radius zero, bounded actual RGB/alpha tolerances,
independent definition-based reference, and mandatory nonzero coverage remain.
Every retained probe still has a fully flat expected neighborhood; diagonally
irrelevant square corners no longer erase the thin stroke's interior. No adaptive
fallback, skipped fixture, weakened coverage assertion, altered displacement,
style change or larger test stroke is introduced. The original diagonal line
and all other fixtures are byte-identical to the preceding step.

| Environment / selection         | orange-new probes | orange-old probes | clear-new probes | Normal line mismatches |
| ------------------------------- | ----------------: | ----------------: | ---------------: | ---------------------: |
| Chromium 153, square before fix |                 0 |                67 |               67 |  0 (coverage rejected) |
| Chromium 153, diamond           |                79 |               121 |              121 |                      0 |
| Embedded Chromium 154, diamond  |                93 |               133 |              133 |                      0 |

[Headless results](leaflet-canvas-2026-10-07-probes-headless.json) record browser
version 153.0.8010.12 directly from Playwright, all seven normal cases, all seven
suppressed cases and all seven successful recovery checks. [Embedded results](leaflet-canvas-2026-10-07-probes-embedded.json)
record the same **7 normal / 7 frozen detections / 7 recovery** outcome. Embedded
Chromium's UA reports Chrome/154.0.0.0; running framework helper paths identify
**154.0.8037.98**. Both runs use DPR 1 and window 1100 x 1100. Each has 14 successful
initial scenes, zero normal/recovery mismatches, nonzero probes in every required
changed category, and mismatches in every such category under suppression.
For line-endpoint, all 79/121/121 headless and 93/133/133 embedded required probes
mismatch under frozen drawing. Functional diagnostics produce zero timing rows.

The existing user-provided Playwright driver and installed Chromium were reused;
no package, Atlas source, regression test, or browser-test configuration changed.
The headless production Run selected (mixed-3000 route-update) passed the seven-case
preflight and accepted **15 samples**, with one warmup and five repeats for all
three variants. Its [30 timing rows](leaflet-canvas-2026-10-07-probes-headless-timing.csv)
are isolated acceptance evidence; performance tables and previous exports stay historical.

The same driver then deliberately froze drawing in the normal preflight's first
independent-point Canvas after its initial painting. It intercepts public
`getContext` to patch only connected Canvas contexts; detached reference canvases
keep drawing. The mutation's output had **45 mismatched probes** (20 blue-new,
25 symbol-cleared), and preflight rejected it with `Sparse Canvas actual output`.
Metadata retained that failed case and reason, `failed=true`, preflight status failed,
`completedSamples=0`, and zero rows for the rejected run. The prior accepted CSV
remained byte-identical. This is actual drawing-error propagation, unlike the older
resize rejection evidence. Getter/context methods are restored in the driver's
`finally`; no fault can reach measured samples in this rejected run.

[Build provenance](leaflet-canvas-2026-10-07-probes-build.json) records all 60 current
input hashes plus production asset hashes. [Verification](leaflet-canvas-2026-10-07-probes-verification.json)
records the required commands, coverage counts, fault rejection and preserved
starting files. Earlier CSV/manifests are unchanged and are not claimed to have
passed the diamond checker retroactively. Limitations remain: two desktop Chromium
builds at DPR 1 do not establish all-browser/DPR/mobile robustness; fully occluded
dense output and skipped antialiased boundaries are not certified. Suppression
still tests clearRect/fill/stroke together, not each method independently.

## Integration and validation

`package.json` adds only two exact devDependencies; `package-lock.json` adds their
locked packages (including the declarations' GeoJSON type dependency). These files
may intersect the parallel browser-regression task: merge both dependency sets and
regenerate the lockfile together rather than replace either branch's whole file.
No test/configuration file from that task is edited. Benchmark config adds the
comparison HTML entry and hashes all relevant `src`/harness/package/background inputs;
it remains separate from test infrastructure. New comparison files are example-local.

Documentation navigation/platform-stage updates may intersect that task's status edits.
Preserve both statuses during integration. The new performance document/dated exports
are additive; original baseline documents/exports are not overwritten. Temporary build
outputs, screenshots and traces remain outside Git. Changes remain uncommitted in
`chore/leaflet-comparison` for mini review.

All requested commands completed successfully: `npm ci`, `npm test` (77 tests,
5 files), `npm run check`, `npm run build`, and `npm run bench:build`.
The final check has one example-local duplicate-string lint warning and no errors;
library declaration generation retains the existing API Extractor TypeScript
5.9.3-versus-6.0.3 warning. npm ci reports five audit findings (4 moderate, 1 high);
no unrelated automatic dependency upgrades were made. A final source/build input
hash audit confirms that measured code still matches the saved worktree.
