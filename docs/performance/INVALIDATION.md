# Atlas explicit invalidation — 2026-10-07

Implemented in `feat/scene-invalidation` and prepared for PR after mini review.
The measurements and correction checks below were captured before committing.
The combined base is `1c2e54b` (PR #24): DOM-independent MapModel from PR #23,
browser regressions, and the existing Atlas benchmark are already merged.
This comparison uses that base, not the historical 2026-10-06 baseline.
Leaflet code/checkers/results are unchanged and are not a dependency or comparison.
No numerical performance target has been agreed.

**Measurement scope:** all timing tables and the ten before/after CSV/manifest
files below describe the implementation **before the reattachment review fix**.
Their source hashes do not describe the current corrected tree. They remain
unchanged. The [review correction](#review-correction-reattachment-before-raf) has
separate functional/counter evidence; the full benchmark has not been rerun.

## Method and reproduction

Use the existing [baseline method](BASELINE.md) and production harness:
`npm ci`, `npm run bench:build`, `npm run bench:preview`. Before uses the clean base;
after used the initial reviewed source tree before the reattachment correction. Run the full suite, then instrumentation
separately. No tests, builds, or other benchmark runs run during either measurement.
Each timing phase has one warmup and five measured repeats per scene/scenario;
instrumentation has one repeat and no warmup. Scene order reverses on alternating
repeats. The seed is `0x41544c53`; scenes, input generator, background, viewport,
scenario order, timing boundaries, and mutation checker are unchanged.
The only harness change forwards the internal `takeChanges` method through its
instrumentation facade; counters still wrap the same actual operations.

Capture used Playwright 1.63.0 with its headless Chromium 153.0.8010.12,
window 1100 × 900, stage 800 × 480 CSS pixels, DPR 1, 8 reported logical cores.
Both phases use the same settings. This is a headless desktop comparison; the
historical baseline used the visible Codex Chromium 154 and is not directly compared.
The manifest preserves the full UA, browser version, scene counts, seed, build-time
Git state, input SHA-256 hashes, and SHA-256 hashes of every `src/` file.
Node v20.19.6/npm 10.8.2 build and serve only. Tool versions are fixed by the lockfile
(Vite 8.3.1, TypeScript 6.0.3, Vitest 4.1.11).

Device: MacBook Pro Mac14,7, Apple M2 (8 CPU cores), 16 GB; macOS 26.6.2 (25G83).
Other normal desktop applications were running. Power mode, thermal state, panel
refresh rate, and scheduling load are unknown. Image decoding/cache is explicitly
warmed; cold networking/module download are outside these operation spans.

For the exact headless capture settings, create a Playwright page as follows, then
click `#suite`, wait for `#controls.disabled` to become false, export `#results.value`
and `#metadata.value`, and repeat with `#instrument`. Require `#status` to begin with
`Complete:` before keeping data. The existing page also supports interactive export.

```js
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1100, height: 900 },
  deviceScaleFactor: 1,
});
await page.goto('http://127.0.0.1:8081/examples/stress.html');
```

All four scenes preserve their baseline composition: 3000/5000 independent roots
in point scenes; mixed roots are 60% points, 20% lines, 20% routes with 3/6/12 vertices.
Mixed scenes have 5400/8996 owned points and 7200/11996 visual primitives.
Every measured load in both phases retained identical SVG/shadow node counts.

## Saved results

- **before**: [timing](atlas-2026-10-07-invalidation-before-timing.csv), 14,352 rows; [timing summary](atlas-2026-10-07-invalidation-before-summary.csv); [instrumentation](atlas-2026-10-07-invalidation-before-instrument.csv), 3,725 rows; [instrumentation summary](atlas-2026-10-07-invalidation-before-instrument-summary.csv); [build/environment manifests](atlas-2026-10-07-invalidation-before-runs.json).
- **after**: [timing](atlas-2026-10-07-invalidation-after-timing.csv), 15,250 rows; [timing summary](atlas-2026-10-07-invalidation-after-summary.csv); [instrumentation](atlas-2026-10-07-invalidation-after-instrument.csv), 3,967 rows; [instrumentation summary](atlas-2026-10-07-invalidation-after-instrument-summary.csv); [build/environment manifests](atlas-2026-10-07-invalidation-after-runs.json).

Run IDs: before timing `timing-2026-10-07T06-35-17.382Z`, instrumentation
`instrument-2026-10-07T06-37-50.292Z`; after timing
`timing-2026-10-07T06-44-06.261Z`, instrumentation
`instrument-2026-10-07T06-46-37.937Z` (UTC; Riga is UTC+3 on this date).
Original floats are preserved in raw CSVs; summaries round to six decimals and
these tables to one. Median is the ordinary middle value; p95 is nearest rank
`ceil(0.95*n)`. Summary suffixes `_n`, `_median`, `_p95`, `_max` match the baseline
format. With five independent operation repeats, p95 equals max; this is a small
sample. Frame and hit/miss samples are pooled correlated observations, not
independent device runs.

## Timing: load and camera

Cells are median / p95 in ms, before → after. Load and creation have n=5 each;
frame sample counts are shown separately. Creation ends at two RAF opportunities,
not paint completion. A renderer callback likewise excludes layout/paint/compositing.

| Scene       |              Load promise | Creation to RAF opportunities |          Pan RAF interval |         Zoom RAF interval |
| ----------- | ------------------------: | ----------------------------: | ------------------------: | ------------------------: |
| points-3000 |     5.8 / 6.9 → 7.5 / 8.9 |     63.1 / 66.4 → 65.2 / 81.6 | 16.7 / 16.8 → 16.7 / 16.8 | 16.7 / 16.7 → 16.7 / 16.7 |
| points-5000 |  9.4 / 10.9 → 11.4 / 14.5 |     59.8 / 74.7 → 72.7 / 77.8 | 16.7 / 33.4 → 16.7 / 16.7 | 16.7 / 33.4 → 16.7 / 16.8 |
| mixed-3000  | 15.2 / 22.7 → 21.4 / 31.1 |   75.7 / 102.9 → 98.1 / 115.6 | 33.3 / 50.0 → 16.7 / 33.4 | 33.3 / 50.0 → 16.7 / 33.4 |
| mixed-5000  | 32.0 / 36.2 → 38.1 / 40.3 | 141.0 / 200.2 → 139.6 / 171.8 | 50.0 / 66.7 → 33.3 / 50.0 | 50.0 / 66.8 → 33.3 / 50.1 |

| Scene       | Pan interval n, before → after | Zoom interval n, before → after |
| ----------- | -----------------------------: | ------------------------------: |
| points-3000 |                      450 → 448 |                       452 → 454 |
| points-5000 |                      396 → 445 |                       354 → 447 |
| mixed-3000  |                      263 → 323 |                       247 → 376 |
| mixed-5000  |                      159 → 219 |                       145 → 203 |

Load promise medians increased on all four scenes: +1.7, +2.0, +6.2, +6.1 ms
in table order (approximately +29%, +21%, +41%, +19%). This is a measured regression
in this sample. Source inspection identifies extra dependency/link construction;
its exact share is not isolated by profiling. Mixed-5000 total creation did not
increase in median, but independent scheduling spans cannot be subtracted to
invent a phase breakdown. Pan no longer rewrites geometry, yet mixed-5000 RAF
intervals still have a 33.3 ms median. Remaining browser rendering/scheduling costs
are not isolated; fewer attributes do not prove a target frame rate or paint latency.

## Timing: edits, membership, picking

All cells are median / p95 in ms, before → after. Edit/membership cells have n=5;
hit/miss have 1000 calls per phase (5 × 200). Single and 100-position synchronous
medians quantize to 0.0–0.1 ms, not zero work. The table uses operation-to-two-RAF
opportunities for geometry edits, and synchronous API spans for membership.
Raw and summary files also contain all add/remove-100/500 scenarios, cumulative
checkpoints, camera setter costs, motion duration, and wheel-input diagnostics.

| Scene       |       One position to RAF |      100 positions to RAF |              Add 1000 sync |              Remove 1000 sync |       Route update to RAF |              Hit sync |             Miss sync |
| ----------- | ------------------------: | ------------------------: | -------------------------: | ----------------------------: | ------------------------: | --------------------: | --------------------: |
| points-3000 | 30.1 / 31.9 → 31.4 / 31.5 | 30.9 / 32.8 → 31.3 / 32.1 |  30.1 / 30.6 → 30.5 / 32.7 |     84.7 / 86.7 → 85.4 / 85.9 |                       N/A | 0.0 / 0.1 → 0.0 / 0.0 | 0.4 / 0.5 → 0.4 / 0.5 |
| points-5000 | 25.3 / 37.3 → 19.1 / 32.4 | 26.4 / 37.7 → 24.6 / 25.0 |  48.6 / 49.1 → 46.2 / 49.8 | 154.1 / 159.7 → 153.4 / 154.8 |                       N/A | 0.1 / 0.1 → 0.0 / 0.0 | 0.8 / 0.9 → 0.8 / 0.9 |
| mixed-3000  | 31.8 / 36.7 → 15.8 / 30.2 | 28.5 / 37.8 → 14.2 / 25.4 |  36.1 / 75.6 → 36.4 / 38.8 |     87.5 / 89.6 → 87.8 / 90.8 | 33.1 / 38.1 → 14.9 / 16.4 | 0.0 / 0.1 → 0.0 / 0.0 | 2.3 / 2.5 → 2.3 / 2.5 |
| mixed-5000  | 50.6 / 54.2 → 14.8 / 29.1 | 49.1 / 61.3 → 23.8 / 59.4 | 55.6 / 122.3 → 51.7 / 62.1 | 160.8 / 162.0 → 159.6 / 184.6 | 47.6 / 50.9 → 20.4 / 39.1 | 0.1 / 0.2 → 0.0 / 0.0 | 3.9 / 4.9 → 3.8 / 4.5 |

Synchronous membership cost is largely preserved: collection copying/filtering and
model membership scans are unchanged. Mixed-5000 removal p95 rose from 162.0 to
184.6 ms despite a similar median; membership latency has not been solved. The
100-coordinate series has a similar 0.1 ms synchronous median in both phases;
mixed-5000 operation-to-RAF p95 remains noisy at 59.4 ms after (61.3 before).
Picking misses still traverse the flat scene and remain approximately unchanged.
The hit target is the fixed reserved gutter near the top of composition; timer
quantization and this specific workload prevent a general picking-speed claim.

## Separate instrumentation: actual SVG writes

One intrusive run per phase. Counts below normalize pan/zoom by their measured
renderer callback count; each single-point action has one callback. Timing-table
results have none of these wrappers. `svg_attribute_removals` counts calls to
`removeAttribute`, including redundant calls in the base. It is **not DOM-node
removal**. Completed instrumented actions omit a counter key when its wrapper
was never called; zeros here use that documented reset/increment behavior.

| Scene       | Pan attribute writes/render, before → after | Zoom attribute writes/render, before → after | One point writes, before → after | Attribute removals/render for these actions, before → after |
| ----------- | ------------------------------------------: | -------------------------------------------: | -------------------------------: | ----------------------------------------------------------: |
| points-3000 |                                    6003 → 1 |                                  6003 → 3001 |                         6003 → 1 |                                                    3000 → 0 |
| points-5000 |                                   10003 → 1 |                                 10003 → 5001 |                        10003 → 1 |                                                    5000 → 0 |
| mixed-3000  |                                   15003 → 1 |                                 15003 → 6001 |                        15003 → 1 |                                                    7200 → 0 |
| mixed-5000  |                                   24995 → 1 |                                 24995 → 9997 |                        24995 → 1 |                                                   11996 → 0 |

Pan's only write is `viewBox`; unchanged dimensions, placements, paths, and screen
scales have no writes. Zoom's writes are `viewBox` plus circle screen compensation;
all unchanged map-space coordinates and non-scaling strokes stay untouched.
Mixed-5000 instrumented pan had 27 → 39 callbacks and 674865 → 39 attribute writes;
zoom had 25 → 30 callbacks and 624875 → 299910 writes. Different callback counts
are consequences of this intrusive run and must not be compared as timing samples.

The 100-position action writes 100 attributes in point scenes and 140 in mixed
scenes (60 point placements, 20 changed line endpoints × 2 coordinates, 20 route
paths and 20 vertex placements), with zero attribute removals. Mixed-5000 previously
wrote 24995 and removed 11996. The route replacement writes 17 attributes and removes
2 visibility attributes on its two new symbols, versus 25009 writes/11997 removals
before. Surviving vertices keep placement, scale, groups, and primitives.
Add-1000 writes 8000 attributes and removes 1000 visibility attributes on new nodes;
remove-1000 writes/removes zero attributes while actually retiring SVG groups.
The existing counters do not count retired DOM nodes. Browser MutationObserver
tests separately verify child-node removals, preserving this distinction.

No root iteration or route membership getter reads occur in pan/zoom after.
Position-single after includes only the benchmark's untimed root snapshot
(5001 iterator next calls for a 5000-root scene), with zero route membership reads.
Before it additionally traversed the roots and read routes in the renderer.
Add/remove-1000 still have 5511502/4509502 iterator next calls on 5000-root scenes;
those counts include model event checks, untimed snapshots and later synchronization,
not Array.includes/filter work. Route-update after still rebuilds the flat array,
with 10002 root iterator next calls and 1002 route membership reads in mixed-5000.
The latter includes the harness route lookup and the changed polyline view refresh.
Wheel-input rect reads remain 52 per scene, including the two untimed anchor reads.

Both instrumented phases passed all 58 cleanup checks: zero renderer callbacks
after disconnected edits and zero stage children. All 20 measured load samples per
phase retained the same node counts. This checks logical cleanup/identity, not
retained heap size or collection timing.

## Mechanism, checks, and remaining work

The selected internal membership flag + changed-source set is described in
[the renderer contract](../design/RENDERER_AND_COMPONENT.md#explicit-scene-invalidation--implemented-for-review-2026-10-07).
Mutation marks precede existing public notifications and survive `unobserve`;
spatial reads never consume pending display updates. Weak links handle shared
objects without retaining their maps. Entry/owner identity preserves duplicate IDs
and all appearances. SVG maintains separate pending geometry/new-node sets and
cached dimensions/viewBox/scale. No public event system, scheduler, index, renderer,
ownership change, or package was added.

Before: 103 Node and 29 real-browser tests passed on the combined base. Model
invalidation substep: 106 Node/29 browser and typecheck passed. Final: 106 Node and
35 browser tests, `npm run check`, library build and benchmark build passed at that measurement stage. The review correction below has newer checks.
The existing API Extractor warning about bundled TS 5.9.3 versus project TS 6.0.3
remains; builds succeed. New tests inspect actual mutation records, output, identities,
and picking: pan/zoom/resize, one point/endpoint, shared appearances/maps, route
membership, root add/remove before RAF, and disconnected queries/reconnect.
Existing duplicate-ID, reentrant remove/reattach, stale-click, atomic loading,
resource failure, and zero-viewport behavior remain covered.

Remaining full walks are intentional in this bounded step:

- Initial runtime/entry/link/SVG creation and root subscription setup visit the scene.
- Explicit membership reconciliation rebuilds the flat ordered entry/dependency arrays;
  SVG synchronization walks that order to preserve surviving nodes and composition.
- Zoom visits all point symbols whose screen compensation changes.
- A changed route serializes its whole polyline; a retained polyline rebuilds its
  coordinate array only after that route's membership changes.
- Miss picking still scans entries and segments; no spatial index was introduced.
- Model `hasObject` still scans roots in synchronous membership handlers. Collection
  arrays still copy/filter per operation. Their quadratic bulk cost remains visible.

These results validate fewer SVG writes and preserved behavior in this workload.
They do not establish mobile/browser support, heap limits, physical paint completion,
input-to-presentation latency, or agreed numerical performance targets.

## Changed files for mini review

- Model/geometry marks: `src/objects/map-point.ts`, `src/objects/map-route.ts`,
  `src/objects/map-object-collection.ts`, `src/spatial/scene-invalidation.ts` (new),
  `src/spatial/scene-geometry.ts`.
- Affected SVG output: `src/renderers/svg/svg-renderer.ts`,
  `src/renderers/svg/svg-renderer.utils.ts`.
- Regression checks: `tests/scene-invalidation.test.ts` (new),
  `tests/browser/svg-renderer.browser.test.ts`, `tests/browser/map-element.browser.test.ts`.
- Instrumentation facade: `examples/stress.instrument.ts` (one internal-method forwarding line).
- Current design/status: `docs/DESIGN_MAIN.md`, `docs/TOOLING.md`,
  `docs/design/PROTOTYPE.md`, `docs/design/RUNTIME_AND_LOADING.md`,
  `docs/design/RENDERER_AND_COMPONENT.md`.
- This report and the ten new dated CSV/manifest files linked above.

`MapModel`, `Spatial`, camera, component lifecycle/load code, public exports,
definitions, package/lockfile, and the mutation checker have no source changes.
At the initial mini review, the primary and prerequisite worktrees were unchanged
and no changes were staged, committed, pushed, or opened as a PR. The reviewed
changes have since moved to the primary repository for PR preparation.

## Review correction: reattachment before RAF

The P2 sequence is remove → synchronous picking/membership reconciliation → detached
coordinate edit → attach the same instance → render. Reconciliation correctly released
tracking and pruned retired pending sources. Detached edits therefore had no scene
notification; reattachment reused cached entries and still-present SVG nodes without
queuing their current geometry. Picking read live coordinates while SVG stayed stale,
even after pan. The original regression suite did not cover this sequence.

The production correction is one `invalidation.changed.add(source)` in the existing
new-tracking branch of `scene-geometry.ts`. Every newly tracked source queues its
current dependent entries, including cached entries restored before renderer
synchronization. Surviving entries/groups/primitives keep identity. Retired sources
still go through the unchanged `untrackScene`/tracked-set cleanup. No full geometry
pass is added to ordinary render or pan; initialization/reattachment queue current
sources once.

New Node point/line/route scenarios and browser point/line/route plus native
MapElement scenarios failed before correction (3 Node and 4 browser failures).
All pass after correction. They check current picking, pending output, actual SVG
attribute mutations, composition, and surviving group/primitive identity. An
additional detached-route check proves membership reads stay unchanged without root
iteration; an additional shared-root/vertex reattachment check updates only its path
and two appearances. Existing shared-map tests also pass.

The independent user-provided `/private/tmp/atlas-scene-invalidation-review.mjs`
was rerun against the dev server at `http://127.0.0.1:8191`, writing a new output
path. Its exit status was supplemented with assertions of actual states:
point/line/route `after` and `afterPan` equal `expected`; removed picking is absent,
returned picking is current, and SVG groups are retained. Native capture removal →
internal picking → press edit/reattachment now yields `translate(90 80)` after RAF;
the following click identifies that same point. No page errors were observed.

[Separate correction evidence](atlas-2026-10-07-reattach-checks.json) preserves
functional states, actual SVG method-call records, browser/environment settings,
all current source hashes, and the verified hashes of all ten unchanged result files.
This is a small dev-mode functional fixture, with no timing claim: headless Chromium
153.0.8010.12, window 1000 × 800, map 320 × 240, DPR 1.

| Action                 | SVG attribute writes | Attribute removals | Actual changed output                              |
| ---------------------- | -------------------: | -----------------: | -------------------------------------------------- |
| Pan                    |                    1 |                  0 | surface viewBox                                    |
| Move independent point |                    1 |                  0 | its group transform                                |
| Move shared point      |                    3 |                  0 | route polyline + vertex transform + root transform |

Attribute removals remain distinct from DOM-node removals. These targeted counters
confirm the correction preserves affected updates; they do not replace the previous
full benchmark or provide new performance timings.

`src/spatial/scene-geometry.ts` SHA-256 in the previous after manifest:
`a73493f51cb0b175c4aeb6ffe45445d7afe26d2edad964e4d4aeac8bc2743fb4`.
Corrected SHA-256:
`721447b4bd9ea344b555e9273322b66769211d04602165e7beb6df2afd3c3f19`.
This is the only changed library source since those measurements. Old tables/manifests
must be read as evidence of that prior source version, not the corrected tree.

Final correction checks: **110 Node tests, 40 browser tests, check, library build,
and benchmark build passed**. The existing API Extractor TypeScript-version warning
remains. The correction added no package or renderer change and did not rerun the
full benchmark. PR preparation preserves all ten measurement files byte for byte;
the scoped `.gitattributes` rule prevents CSV line-ending normalization in Git.
The incremental correction touches only scene geometry, the three regression-test
files, current design/test status documentation, this report, and the new evidence JSON.

PR preparation on 2026-10-08 integrated `master` at `9f4500a` with a merge commit.
The corrected library sources and all ten stored measurement files remain byte-identical.
The integrated tree passed check, 110 Node tests, 40 browser tests, both builds, and
the newly merged built-example smoke test. The existing Leaflet lint warning and
API Extractor TypeScript-version warning remain; neither fails the checks.
