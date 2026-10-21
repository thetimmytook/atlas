# Focused scripted zoom profile — 2026-10-20, corrected capture r2

The current evidence is **r2**, captured **17:05:13–17:07:37 Europe/Riga** after the
input-identity correction. The [initial run](ZOOM_PROFILE_2026_10_20_INITIAL.md)
checked 86 inputs and omitted both zoom scripts. Its original manifest,
checkpoints, CSVs and verification JSON remain byte-identical; no hashes have been
added retrospectively.

`benchmark.config.mts` now selects the complete `examples/prototype-` prefix from
its explicit input allowlist. The resulting embedded metadata and this capture's
manifest contain **88 inputs**, including both `prototype-zoom.run.mjs` and
`prototype-zoom.analyze.mjs`. `verify()` also rejects metadata missing either
required script, then checks their hashes at all 32 real boundaries.

[Post-build mutation tests](zoom-2026-10-20-r2-integrity-tests.json) changed each
script separately after the validation build. Both invocations of the **actual
runner** exited 1 at `capture:before`, named the changed path and started zero
measurements/captures. Original bytes were restored before smoke and the final
build. Their expected hashes match the scripts recorded in the corrected capture.
This is a repeat with corrected provenance; it is not a runtime optimization or a
controlled performance before/after comparison.

**Confirmed:** the largest recurring cost in the materials/labels traces is browser
SVG style/layout work after the camera-dependent DOM updates. At 5000 roots,
`Layout` alone occupies 307.32–314.94 ms across a complete traced sequence,
`UpdateLayoutTree` 246.90–248.70 ms and scripting callbacks 177.45–184.36 ms.
These are diagnostic main-thread wall intervals, not ordinary timing or exclusive
CPU totals. The traces also show substantial prepaint, paint and raster work.
Repeated application text measurement is not the cause: its counters stay zero,
while Chromium still performs internal SVG text layout/shaping.

**Hidden-layer hypothesis:** unnecessary updates are confirmed; a substantial
fraction of elapsed time attributable specifically to them is **not established**.
About 66% of camera-dependent writes target hidden layers. Neither that fraction
nor the sampled functions assigns a time percentage to hidden DOM. There is no
visibility intervention in this experiment.

**Proposed next step:** one bounded A/B experiment that skips camera-only symbol
and label scale updates for hidden appearances, with catch-up before their first
visible paint. Measure whether it actually reduces scripting/style/layout and RAF
tails. This is a proposal, not an accepted contract or implemented optimization.
Visible SVG layout/raster may remain the limiting cost. No engine/public API,
scene, dependencies or CI changed; no performance gate is passed.

## Evidence and identity

- [Raw timing](zoom-2026-10-20-r2-timing.csv), [timing summary](zoom-2026-10-20-r2-timing-summary.csv).
- [Manifest](zoom-2026-10-20-r2-manifest.json): commit/dirty state, all input and build
  file hashes, environment, 32 verification boundaries, 140 run records and final
  camera/scene assertions, trace IDs and artifact hashes.
- [Diagnostics](zoom-2026-10-20-r2-diagnostics.json): all 12 capture summaries, per-step
  timeline intervals, sampled self/inclusive stacks with original TypeScript
  locations, raster/compositor threads and 12 independent counter runs. Missing
  counter keys mean zero.
- [Offline analysis](../../examples/prototype-zoom.analyze.mjs) regenerates the
  CSVs/JSON from retained raw evidence. Aggregation rules appear below.
- [Independent verification](zoom-2026-10-20-r2-verification.json) records preservation,
  sample/counter reconciliation and category-overlap checks.

Main checkout `/Users/i.levkovs/projects/atlas`, no worktree. The initial profiling
task started clean; this P2 correction continues its existing unstaged branch. Fetched `origin/master` **`832b6bb61dfd956684c31fa6f7bac4dfeef28d10`**, including
platform PR #46, then created `chore/zoom-profiling`. No staging, commit, push, PR or
remote CI inspection occurred. Only the benchmark harness/config and new evidence
and current-status documentation are changed. The older
[materials/labels report](PROTOTYPE_MATERIAL_LABELS_2026_10_20.md), its CSVs/manifests,
and all preexisting performance files are preserved.

One final production benchmark build followed the functional/development checks.
All four combinations used one immutable copy of that build. Its 15 files and all
88 runtime/harness/config/package inputs matched before/after the phases and each
of the 12 trace captures. Original `dist/benchmark` also matched the frozen copy.
The retained build contains unminified ES2022 JavaScript, source maps and embedded
source content. Dirty documentation is recorded but is not a build input.

SHA-256 aggregates use JSON-serialized, path-sorted `[path, hash]` pairs:

| Group                         | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| Runtime                       | `7f9b9af5647ad97db6c79d0194f8b380e21b6fa68aed52a4c81d926f63502285` |
| Harness/config/package inputs | `1f8eea2dccbb8b2e14e74f59ae03e5b87b43012951b53e365538706baf5fb02c` |
| Frozen build                  | `f916613d89dc702b6abc264a879f1ad5a16f4e0c320b2711ae03522f6fd2a54f` |

Runtime identity matches the historical material/label run; harness and conditions
have changed. The old 33.2/50 ms enriched medians are historical callback intervals.
They are not an unchanged before/after experiment and imply no optimization gain.

## Environment and boundaries

Apple M2, 8 logical CPUs, 16 GiB; macOS 26.6.2 / Darwin 25.6.0 arm64; Node v20.19.6,
Playwright 1.63.0, headless Chromium 153.0.8010.12. Browser viewport 1100 × 900 CSS
px, map 960 × 640, DPR 1. Playwright default launch, no custom flags, CPU/network
throttling or forced GC. No concurrent tests, builds or other profilers were run by
this task during capture. OS/desktop background work was not controlled: start/end
load averages were **2.88/3.52/4.54** and **2.60/3.10/4.20**. These are noisy single-host
evidence, not a controlled device comparison.

Final capture: **17:05:13–17:07:37 Europe/Riga** (14:05:13–14:07:37 UTC).
Measured timing sequences: 17:05:19–17:06:41; traces: 17:06:46–17:07:12;
counters: 17:07:17–17:07:36. Phase warmups precede those measured ranges.

The original scene generator is untouched: seed `0x50524f54`, same 3000/5000 roots,
nine reserved probes, common geometry, materials, SVG/PNG icons, seven-character
labels and monospace fonts, four buildings/three floors and deterministic heavy
background. Selected floors remain `[0,1,2,0]`; 5 of 13 layers are visible. Camera
center remains `(600,400)`, initial zoom `0.8`. See the historical report for the
full composition/resource specification; current inventories below verify it.

The shared 24-step function is extracted from the ordinary benchmark without
changing its default observation. This runner invokes that same function without
its MutationObserver. Zoom is `initialZoom * 2 ** ((1 - cos(angle)) / 2)` for angles
`(step + 1) / 24 * 2π`, followed by the original two settling RAF callbacks.
This is **scripted camera zoom**. No native wheel/input-to-presentation latency,
displayed FPS or physical-screen presentation is measured.

The three observation modes use separate pages, sequentially:

1. **Timing:** 3 warmup repetitions and 20 measured repetitions per size/profile;
   profile order alternates each repetition. No profiler, marks, monkey patches or
   MutationObserver. RAF timestamps and synchronous camera setter durations only.
2. **Trace:** 3 clean warmup repetitions and 3 captures per size/profile. CDP
   `Tracing` plus `Profiler`, 1000 µs sampling, no instrumentation patches. Trace
   categories: `devtools.timeline,v8,blink.user_timing,blink,cc,gpu,toplevel,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame`.
   `atlas-zoom-start`, `atlas-zoom-step-0` … `atlas-zoom-step-23`, `atlas-zoom-end`
   bound the sequence and steps. Only the operation is traced; setup and final
   assertions are excluded.
3. **Counters:** 3 clean warmups and 3 instrumented sequences per size/profile,
   no CPU/browser tracing. Existing instrumentation counts renderer/attribute/text
   work. An additional local wrapper classifies writes by their prepared visible or
   hidden layer, plus tag, observes child-list changes, and counts computed-style
   and client-rectangle calls. Patches are restored before validation/cleanup.

Every repetition loads a fresh map. Scene creation, decoded background/icons,
`document.fonts.load/ready`, selected floors, initial label metrics, inventory and
initial SVG snapshot precede the sequence. Browser-internal decode/raster tasks
that zoom itself schedules remain observable; warming assets does not eliminate
future raster work. After the sequence, all 140 runs restore the exact initial
camera and complete SVG markup, retain every original SVG node, keep the expected
root count and remain visible/unresized. These reads are outside measurement.

## Ordinary timing

Each metric/cell has **480 samples from 20 repetitions**. Median is the average of
the middle pair; p95 is nearest rank `ceil(0.95*n)`; max includes every sample.
Samples within a repetition are correlated. Camera setter resolution is quantized;
a reported zero does not mean zero work.

| Roots | Profile          | RAF median / p95 / max, ms | Camera setter median / p95 / max, ms |
| ----- | ---------------- | -------------------------- | ------------------------------------ |
| 3000  | control          | 16.70 / 16.70 / 33.40      | 0.00 / 0.10 / 0.10                   |
| 3000  | materials-labels | 16.70 / 33.40 / 50.10      | 0.00 / 0.10 / 0.10                   |
| 5000  | control          | 16.70 / 33.30 / 50.00      | 0.00 / 0.10 / 0.20                   |
| 5000  | materials-labels | 33.40 / 50.10 / 116.70     | 0.00 / 0.10 / 0.90                   |

Raw CSV has 3840 rows (two metrics), with roots/profile/repeat/step preserved.
The original sampling alignment is retained: sample 0 is the interval before the
first camera change; sample i>0 follows change i−1. It is not a measurement of the
work initiated by change i. The final render is settled and checked, but there is
no extra 25th timing sample. Trace windows cover the final work separately.

Representative largest RAF samples, zero-based repeat/step: control 3000 **15/2**, materials-labels 3000 **2/15**, control 5000 **0/16**, materials-labels 5000 **19/7**. All maxima and ties remain in CSV.
These ordinary runs were not traced, so their exact causes remain unassigned.
Do not attribute them to a GC or event from a different diagnostic run. No samples
or diagnostic captures were discarded.

## Browser phases and long steps

All numbers below are **ms over a complete diagnostic sequence**, not normal speed.
Capture ID is `trace-{roots}-{profile}-{repeat}`. Values are unions of clipped
complete `X` events on the marker's renderer main thread, by event name. They avoid
nested duplicate events within a column. `FunctionCall` includes native SVG DOM
methods and any nested GC; it is a scripting envelope, not pure JS self time.
GC is the union of `MajorGC`, `MinorGC` and `V8.GC*` intervals across the disjoint
step windows. It may overlap callbacks. **Do not add these columns.**

| Roots | Profile          | Repeat | Marker window | FunctionCall | Style  | Layout | PrePaint | Paint | Layerize | GC    |
| ----- | ---------------- | ------ | ------------- | ------------ | ------ | ------ | -------- | ----- | -------- | ----- |
| 3000  | control          | 0      | 433.45        | 31.63        | 73.97  | 46.53  | 51.33    | 18.29 | 26.57    | 0.00  |
| 3000  | control          | 1      | 417.56        | 29.31        | 71.87  | 43.77  | 50.60    | 17.20 | 25.91    | 0.00  |
| 3000  | control          | 2      | 433.74        | 33.28        | 80.90  | 43.55  | 57.24    | 16.80 | 29.75    | 0.00  |
| 3000  | materials-labels | 0      | 685.09        | 133.84       | 152.21 | 192.33 | 78.75    | 35.30 | 36.06    | 27.15 |
| 3000  | materials-labels | 1      | 677.66        | 125.03       | 153.96 | 194.56 | 80.16    | 36.12 | 36.28    | 18.70 |
| 3000  | materials-labels | 2      | 707.57        | 132.87       | 163.18 | 199.05 | 80.68    | 36.40 | 36.53    | 25.81 |
| 5000  | control          | 0      | 475.09        | 54.98        | 130.41 | 79.83  | 84.87    | 30.28 | 45.28    | 0.00  |
| 5000  | control          | 1      | 464.18        | 48.92        | 126.40 | 80.56  | 84.64    | 30.27 | 44.30    | 0.00  |
| 5000  | control          | 2      | 489.87        | 65.03        | 133.60 | 85.75  | 88.31    | 34.12 | 49.82    | 0.00  |
| 5000  | materials-labels | 0      | 1027.56       | 177.45       | 246.90 | 311.58 | 132.27   | 59.32 | 57.12    | 0.00  |
| 5000  | materials-labels | 1      | 1025.06       | 184.36       | 248.70 | 307.32 | 132.62   | 59.64 | 56.95    | 2.70  |
| 5000  | materials-labels | 2      | 1042.56       | 177.98       | 248.52 | 314.94 | 132.98   | 61.75 | 59.75    | 0.00  |

Style is `UpdateLayoutTree`; layout is `Layout`. Internal
`InlineNode::FindSvgTextChunks`, `InlineNode::ShapeTextIncludingFirstLine` and
`SvgTextLayoutAlgorithm::Layout` appear in every enriched capture. At 5000 their
respective unions are **35.51–35.80**, **16.26–17.23** and **21.72–22.14 ms**;
they are nested browser work and must not be added to `Layout`. Their absence in
control does not isolate text from icons or other material differences.

No `Layout` or `UpdateLayoutTree` interval overlaps a main-thread `FunctionCall`
in these captures. Separate counters show 48 `getComputedStyle` calls per sequence
(two per render), zero `getBoundingClientRect`, zero application text `getBBox`
and zero text-content writes. Thus the evidence does not show repeated synchronous
layout flushes inside the scripting callbacks. Computed-style reads still occur;
zero detected overlap is not proof that every platform/layout-related read is free.
Internal browser SVG text layout is distinct from application text-metric caching.

Concrete long diagnostic intervals, using step-marker windows (not single frames):

- `trace-3000-materials-labels-0`, step **6**, **55.96 ms**: GC union **26.33 ms**
  overlaps the **28.45 ms** scripting envelope; layout is **10.99 ms**.
- `trace-3000-materials-labels-2`, step **5**, **54.71 ms**: GC union **24.84 ms**,
  scripting **26.67 ms**, style **10.08 ms**, layout **10.50 ms**. These columns
  overlap and are not a sum of exclusive costs.
- `trace-5000-materials-labels-2`, step **1**, **48.55 ms**: scripting **7.46 ms**,
  style **12.03 ms**, layout **12.78 ms**, prepaint **5.66 ms**; no GC slice.
- `trace-5000-materials-labels-1`, step **19**, **43.76 ms**: scripting **10.06 ms**,
  layout **12.72 ms** and a **2.70 ms** GC union.
- Final step **23** includes both original settling callbacks and is not directly
  comparable to the others. Enriched 5000 repeat 2 ends with **77.81 ms**, including
  style **20.49 ms**, layout **26.31 ms**, scripting **7.10 ms** and no GC.

`LayerTreeHost::WaitForCommitCompletion` totals only **0.09–0.13 ms per sequence**
in this corrected capture. The exceptional commit wait from the initial run was
not reproduced here; it is retained with that run and is not used to explain new
timing tails. These task wall times may include OS descheduling; no thread CPU
scheduler trace establishes why each slice has its observed duration.

`mainBusyUnionMs` in diagnostics is the union of all main-thread complete events.
Despite its field name, this is a **task wall-time envelope**, including nested
waits and possible descheduling. It is not measured core CPU utilization.

### Raster and compositing

Raster is visible on worker threads. For repeat 0, each comma-separated value is
the union of `RasterTask` intervals on **one distinct worker**, in ms. Worker order
and PID:TID identities are retained in JSON. Threads overlap each other and main;
these values are not added to sequence/step duration.

| Roots | Profile          | Per-worker raster, ms              | Renderer Compositor / Viz thread envelope, ms |
| ----- | ---------------- | ---------------------------------- | --------------------------------------------- |
| 3000  | control          | 58.54, 59.41, 59.42, 59.67         | 14.55 / 23.29                                 |
| 3000  | materials-labels | 105.40, 84.22, 93.37, 22.38, 83.28 | 25.56 / 24.38                                 |
| 5000  | control          | 90.99, 85.32, 87.08, 87.13         | 19.38 / 23.11                                 |
| 5000  | materials-labels | 123.96, 138.69, 125.02, 109.53     | 33.28 / 24.05                                 |

All three repeats remain in diagnostics. The largest individual worker raster
union is **149.11 ms** in `trace-5000-materials-labels-2`. `Layerize` in the main
table is observable main-thread compositing preparation; main `Commit` ranges from
**0.75 to 1.53 ms**. Other-thread envelopes contain all recorded complete events on
the named threads, not exclusively Atlas compositing. GPU hardware time, display
scan-out and presentation deadlines are not established. `RasterTask` is worker
wall time, not a GPU timer or a complete raster critical path. Some browser/GPU/OS
work is absent from these categories; absence of an event does not imply absence
of cost.

## JavaScript and SVG update path

Sampled stacks consistently identify
`MapElement RAF → SvgRenderer.render → applyScreenScale` for symbols and
`render → #applyChanges → ObjectLabels.forEntry / applyLabel → setChangedAttribute`
for labels. Source maps resolve these to the unchanged original TypeScript:

- [renderer scale loop](../../src/renderers/svg/svg-renderer.ts#L125) and
  [label application](../../src/renderers/svg/svg-renderer.ts#L195);
- [symbol transform write](../../src/renderers/svg/svg-renderer.utils.ts#L208),
  [label transform construction](../../src/renderers/svg/svg-renderer.utils.ts#L30)
  and [changed-attribute read/write](../../src/renderers/svg/svg-renderer.utils.ts#L201);
- [cached label lookup](../../src/components/map-element/object-labels.ts#L140) and
  [computed typography refresh](../../src/components/map-element/object-labels.ts#L126).

For `trace-5000-materials-labels-0`, sampled estimates over the marked sequence:

| Frame / call context                        | Exclusive self, ms | Inclusive with descendants, ms |
| ------------------------------------------- | ------------------ | ------------------------------ |
| render                                      | 5.55               | 151.69                         |
| applyScreenScale                            | 6.08               | 51.35                          |
| #applyChanges                               | 24.72              | 90.25                          |
| applyLabel                                  | 10.55              | 57.05                          |
| setChangedAttribute                         | 13.63              | 46.50                          |
| setAttribute under symbol scale             | 45.27              | 45.27                          |
| setAttribute under changed label attributes | 26.56              | 26.56                          |
| getAttribute under changed label attributes | 6.32               | 6.32                           |

A parent includes its descendants: summing these inclusive rows would count the
same samples repeatedly. Built-in frames have no TypeScript location; their mapped
parents establish the call context. Full native layout/raster cannot be attributed
from V8 `(program)` samples, which dominate the profile but are not a JS function.
The timeline, rather than `(program)`, supplies the browser-phase evidence.

These are statistical self/inclusive **sampled stack-time estimates**, not exact
function timers. The analyzer reconstructs absolute timestamps from `timeDeltas`,
sorts them (28–44 negative deltas/capture in this Chromium/V8 build), attributes
forward intervals to each sampled stack and clips to the marks. Duplicate timestamps
contribute zero time. Coverage equals each marker window. CPU profiles, trace clocks
and main-thread markers share CDP monotonic timestamps. Sampling, tracing overhead,
native-frame visibility and OS descheduling limit precision. The compact JSON keeps
the union of top 40 self and top 40 inclusive nodes; full profiles remain outside Git.

## Visibility and work counters

All three independent counter runs per cell agree exactly. Counts below apply to
one complete 24-step sequence. Visibility means layer `display`, not viewport or
occlusion culling; 5 layers are visible and 8 hidden in every cell.

| Roots | Profile          | Appearances visible / hidden | Circles visible / hidden | Icons visible / hidden | Text visible / hidden |
| ----- | ---------------- | ---------------------------- | ------------------------ | ---------------------- | --------------------- |
| 3000  | control          | 2659 / 5376                  | 1477 / 2841              | 0 / 0                  | 0 / 0                 |
| 3000  | materials-labels | 2659 / 5376                  | 1325 / 2505              | 152 / 336              | 434 / 935             |
| 5000  | control          | 4433 / 8978                  | 2479 / 4783              | 0 / 0                  | 0 / 0                 |
| 5000  | materials-labels | 4433 / 8978                  | 2224 / 4216              | 255 / 567              | 716 / 1549            |

| Roots | Profile          | Circle transforms visible / hidden | Image transforms visible / hidden | Text transforms visible / hidden | All attributes visible / hidden / surface |
| ----- | ---------------- | ---------------------------------- | --------------------------------- | -------------------------------- | ----------------------------------------- |
| 3000  | control          | 35448 / 68184                      | 0 / 0                             | 0 / 0                            | 35448 / 68184 / 24                        |
| 3000  | materials-labels | 31800 / 60120                      | 3648 / 8064                       | 10416 / 22440                    | 45864 / 90624 / 24                        |
| 5000  | control          | 59496 / 114792                     | 0 / 0                             | 0 / 0                            | 59496 / 114792 / 24                       |
| 5000  | materials-labels | 53376 / 101184                     | 6120 / 13608                      | 17184 / 37176                    | 76680 / 151968 / 24                       |

Each inventoried circle/image/text gets 24 transform writes. Surface attributes
are exactly **24 viewBox writes**. Other map geometry writes, group transforms,
new/removed nodes (including child-list events), text-content/style-attribute writes,
client-rectangle reads and text `getBBox` measurements are **zero**. Every sequence
has 24 renderer callbacks and 48 computed-style calls. Total SVG attribute writes
are **103656 / 136512 / 174312 / 228672** in the table's order. Symbols and labels
in hidden floors are therefore positively observed work; metric-cache reuse does
not prevent native SVG text layout after transform changes.

## One proposed change and required experiment

Test **only camera-induced SVG updates of hidden appearances** as the next bounded
change. Keep geometry/material/text state and immediate picking current through the
existing mechanisms. Do not introduce LOD, clustering, another renderer, a public
refresh API, general invalidation framework or delayed model edits.

The necessary correctness rule is: **before a hidden layer becomes paint-visible,
bring its current circle/image/text output to the current camera scale**. Reapply
using current appearance, label metrics/attachment and current shape, even when the
renderer-wide camera scale has not changed in that render. Hidden objects may have
moved, changed text/material/font, switched circle↔image, been removed/reattached,
or gained/lost clipped appearances during several zooms. Replaying an old cached
transform or waiting for the next zoom would leave stale visible output. Catch-up
must precede the first visible paint, including a floor show inside batch, and use
the latest source/label position rather than a snapshot from when the floor hid.

The follow-up must compare baseline and that single intervention with the same
scene, warmups, interleaved profile order, 20 clean timing repetitions and separate
three diagnostic captures/counter runs. Verify hidden scale writes disappear and
first-show writes restore every current output. Compare browser style/layout and
scripting, RAF distributions and first-show cost; retain GC/commit-wait tails.
No speedup percentage is predicted from write counts. If style/layout persists
unchanged, record that result before considering any different optimization.

Required regressions for a future implementation:

- Hide → several zooms → show without another zoom; independently selected floors
  and shared direct/clipped appearances use the current scale on their first paint.
- Hidden position, text, typography/material inheritance and circle/image changes;
  appearance creation/removal, empty labels, route fragments and polygon labels.
- Hidden changes inside nested batch, immediate picking when made visible before
  RAF, shared objects, removal/reattachment, reconnect and resize recovery.
- Surviving SVG node identity, geometry and source identity, stable screen size,
  label attachment/outline/picking and unaffected other buildings.

The current data supports that **experiment**, not a confident claim that hidden
updates dominate elapsed time. Per-layer browser costs, exclusive native DOM cost,
allocation origins, physical/headed presentation and exact causes of ordinary
outliers remain unestablished. No allocation or scheduler/GPU hardware trace was
collected. Single-host uncontrolled background work, three diagnostic captures, short ASCII
labels and tiny repeated icons constrain generalization. Platform/device,
keyboard/focus and numerical acceptance gaps from the
[cross-browser report](../validation/CROSS_BROWSER_2026_10_20.md) remain open.

## Publication authorization — 2026-10-21

The user authorized commits and PR publication on 2026-10-21. The saved capture
metadata retains its actual 2026-10-20 source commit and dirty state; publication
does not rewrite the original or corrected run's hashes/checkpoints.

## Checks, retained artifacts and reproduction

For this P2 correction, `npm run check` passes (**zero errors, 71 advisory
warnings**). Both post-build script mutation probes pass, the representative
functional/native checks pass, and the directed smoke passes all three modes and
four cells (3 warmups, 1 measured repetition/capture per cell). Offline smoke
analysis confirms 88 actual inputs and valid timing/trace results.

All these checks and analyses completed before **the final `npm run bench:build`**
and the corrected capture. No tests, builds or other profilers ran concurrently
with the final measurement. Subsequent work was offline recomputation,
preservation review and report formatting. The earlier full regressions from this
task remain recorded: **468 Node**, **323 browser**, **23 E2E**; those broad suites
were not rerun for this config/integrity-only correction. Runtime, scene and public
API remain unchanged.

Existing functional checks passed six analytic groups for each size/profile and
five additional visual groups for each enriched size. Native checks passed five
cases per cell: original owner/layer, label-only hit or control miss, gutter miss,
post-edit hit and owned-vertex/route context after floor switching. The smoke ran
all three modes and four cells, with three warmups and one measured repetition or
capture per cell. Its analyzer verified timestamps/source-map resolution and raw
sample integrity. All corrected capture/post-sequence checks pass; browser errors and failed
diagnostic captures are **zero**. The two expected integrity rejections above are
separate negative tests and are excluded from measurements.

Large artifacts stay outside Git:

- Corrected final raw evidence and frozen build:
  `/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-zoom-f9se4B`
  (`raw.json`, `build/`, all `trace-{3000|5000}-{control|materials-labels}-{0|1|2}.trace.json`
  and matching `.cpuprofile`). Traces/profiles total about **134 MiB**.
- P2 directed smoke: same temp parent, `atlas-zoom-zQWSL2`; it contributes no final
  measurements. Offline smoke results: `/private/tmp/atlas-zoom-p2-smoke-recomputed-*`.
- Expected integrity rejections: same temp parent, `atlas-zoom-DgwCn3` (runner
  mutation) and `atlas-zoom-OBzynx` (analyzer mutation). Each retains its unmodified
  failed `raw.json` and screenshot; no measured run or trace was started.
- Independent verifier: `/private/tmp/atlas-zoom-p2-verify.py`; evidence in the
  linked verification JSON includes both mutation tests, 88 inputs, independent
  timing summaries, all counters, trace unions, source maps and preservation.
- P2 functional manifest: `/private/tmp/atlas-zoom-p2-functional-manifest.json`.
  Logs: `/private/tmp/atlas-zoom-p2-{mutations,check,functional,smoke,build-final,capture-final}.log`.
- Initial run and its original artifacts are preserved separately in
  [the incomplete-input-coverage record](ZOOM_PROFILE_2026_10_20_INITIAL.md).

Import a `.trace.json` into a Chromium DevTools Performance trace viewer or Perfetto;
import the matching `.cpuprofile` as a V8 CPU profile. These are CDP JSON artifacts,
not Playwright trace ZIP files. Source maps and sources are retained in `build/`;
the offline analyzer maps sampled call frames without a live server. To restore
the exact recorded script URLs for inspection, serve the frozen build on its
original loopback port **58933** (when free):

```sh
python3 -m http.server 58933 --bind 127.0.0.1 --directory /var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-zoom-f9se4B/build
```

Reproduce a fresh run with no concurrent tests/builds or input edits. Keep the
required regression and functional checks before the final build/capture:

```sh
npm ci
npm run check
npm test
npm run test:browser
npm run test:e2e
npm run bench:build
node examples/prototype-bench.run.mjs --check-only --output docs/performance/zoom-functional-FRESH
# Move the check-only manifest outside Git; inspect its functional/native results.
node examples/prototype-zoom.run.mjs --smoke
# Analyze the printed smoke directory; perform both script-mutation probes below.
# Restore source bytes, then make the final benchmark build last.
npm run bench:build
node examples/prototype-zoom.run.mjs
```

Before the last build, reproduce the real-runner mutation probes with the retained
local script and a fresh output path:

```sh
python3 /private/tmp/atlas-zoom-p2-mutations.py /private/tmp/zoom-fresh-integrity-tests.json
```

It appends a valid comment to each script separately, invokes the actual runner,
requires exit 1 at `capture:before` naming that script, requires zero measured runs
or captures, and restores the original bytes in `finally`. The output records the
expected/mutated SHA-256 values and unmodified failure-manifest paths/hashes. Run
it without concurrent builds or captures. Its negative-test output is distinct
from profiling results.

`--smoke` changes only measured counts (one per cell); its warmups remain three.
The final command builds nothing, prints a unique evidence directory, alternates
profiles and preserves failed-run metadata/screenshots/partial profiles if needed.
Use `--check-only` with a fresh prefix to preserve earlier evidence.

Recompute these artifacts from the saved raw directory without launching a browser:

```sh
node examples/prototype-zoom.analyze.mjs /var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-zoom-f9se4B /private/tmp/zoom-r2-recomputed > /private/tmp/zoom-r2-recomputed-analysis.json
```

The analyzer checks raw success, trace/profile hashes, unique complete timing keys,
24 unique step markers and CPU window coverage. It writes the timing CSV/summary,
manifest and diagnostic JSON. Compare JSON values and CSV rows with the saved
files; formatting alone may differ after Prettier. Browser tables above use each
capture's `perName` unions directly; GC is `sum(step.gcMs)`, raster/other-thread
values come directly from their thread arrays, and the self/inclusive table uses
the named mapped nodes of enriched 5000 capture 0. Counter tables use any of the
three identical runs per cell, treating absent keys as zero. No inaccessible
spreadsheet or undocumented manual tail filtering is needed to obtain the claims.
