# Representative materials/labels measurements — 2026-10-20

Both profiles pass the representative functional checks, including native component input. The selected visual content increases load-to-SVG time and zoom callback intervals. Text metrics remain local and are reused for geometry, pan/zoom and color/offset updates. Batch and no-batch perform the same observed work in the specified synchronous turn.

**Recommendation:** proceed with functional platform runs and collect platform-specific performance evidence, carrying zoom as a priority risk. No reproduced runtime defect requires a correction before those runs. Before choosing a zoom optimization, run a focused CPU/layout/raster profile of this exact visual workload, especially updates of labels and symbols in hidden floors. The present data identifies a scaling cost but does not attribute all elapsed time. Performance acceptance remains open until numerical targets and representative device/browser evidence are agreed. Completing this benchmark does not pass a performance gate.

## Evidence

- [Manifest: exact build, environment, functional/native checks and seven verification boundaries](prototype-2026-10-20-material-labels-manifest.json).
- [Raw timing](prototype-2026-10-20-material-labels-timing.csv) and [timing summary](prototype-2026-10-20-material-labels-timing-summary.csv).
- [Raw instrumentation](prototype-2026-10-20-material-labels-instrument.csv) and [instrumentation summary](prototype-2026-10-20-material-labels-instrument-summary.csv).
- [Same-runtime profile differences](prototype-2026-10-20-material-labels-profile-delta.csv): absolute/relative median, p95 and max, counts and repetitions for common metrics. These are descriptive differences for the whole chosen visual content.
- [Independent summary/work/preservation verification](prototype-2026-10-20-material-labels-verification.json) and [standalone summary recomputation](prototype-2026-10-20-material-labels-recompute.py).

Historical [baseline](PROTOTYPE_BASELINE.md), [comparison](PROTOTYPE_COMPARISON.md) and all 57 preexisting performance files remain byte-identical. No historical timing percentage is inferred: the runtime, harness, registration setup and workload inputs have changed since those captures. No Leaflet comparison was run.

## Exact input and environment

The shared checkout is `chore/material-label-validation`, based on fetched `origin/master` **`69c00062c9baecc3bc6940f5d053b5883237bb0b`**, the merge of polygon-label PR #43. The initial working tree was clean. No worktree, staging, commit, push or PR was created. Runtime, public API, dependencies, lockfile and CI match HEAD. Only this harness/config and the new performance evidence belong to this task. Concurrent changes in `docs/validation/PLATFORM_ACCEPTANCE_PLAN.md` and `docs/design/PLATFORMS_AND_PERFORMANCE.md` belong to the documentation task; they are recorded in dirty metadata and excluded from build-input hashes.

- Runtime aggregate SHA-256: `7f9b9af5647ad97db6c79d0194f8b380e21b6fa68aed52a4c81d926f63502285`.
- Harness/config aggregate SHA-256: `98c9724928c73e5b8c84448b0ed1cdbacfbe9ab8fa038457e45c0694dc11dfe6`.
- Aggregates use SHA-256 of JSON-serialized sorted `[path, hash]` pairs. Individual input and frozen-build hashes are in the manifest.
- All **84** runtime/harness/config/package/resource-bearing source inputs and HEAD matched before/after functional, timing and instrumentation, then before saving. Every frozen-build file also matched. Inline icon bytes are protected by the scene-source and scene-definition hashes; decoded payload hashes are in verification.
- Production Vite benchmark build: ES2022, unminified, source maps, existing config. The runner copies `dist/benchmark` to a temporary directory and serves that immutable copy over loopback. It never builds during capture.
- Apple M2, 8 logical CPUs, 16 GiB; Darwin 25.6.0 arm64; Node v20.19.6, Vite 8.3.1, TypeScript 6.0.3, Playwright 1.63.0, headless Chromium 153.0.8010.12.
- Browser viewport 1100 × 900 CSS pixels; map 960 × 640; DPR 1. Default Playwright launch, no custom flags, CPU/network throttling or forced GC. Visible-page/resize assertions remained valid. Browser MacIntel UA does not override host arm64.
- System load average (1/5/15 min): **1.79 / 2.73 / 4.10** at start, **4.68 / 4.06 / 3.93** at end. Desktop/OS work was not controlled. This task ran no competing tests, builds or browser workloads during final capture; the other task was limited to static documentation.
- Timing: **06:12:19–06:27:22 UTC / 09:12:19–09:27:22 Europe/Riga**. Instrumentation: **06:27:23–06:31:51 UTC / 09:27:23–09:31:51 Europe/Riga**, all on 2026-10-20.

Before the final build, checks ran sequentially: `npm run check` (zero errors, 52 advisory warnings), 468 Node tests, 323 browser tests, library build and 23 built-example E2E tests. API Extractor retained its existing bundled-TypeScript 5.9.3/project-6.0.3 advisory. The last build was `npm run bench:build`. Earlier functional/smoke outputs were moved outside Git and do not contribute samples here.

## Workload

`control` preserves the existing generated geometry, materials (`vertex` circles), explicit point pickability and symbols. `materials-labels` decorates that same input. Both run in the same page/runtime and share the application registration configured before first load: optional `benchVisual`, read by the application from `data.visual`, applicable to all four kinds. The engine has no special knowledge of that field. Control objects have no such data; strict registration overhead applies consistently to both profiles.

Seed `0x50524f54`, nine reserved probes, four buildings, three floors each, automatic XY/Z clipping, direct membership priority, cross-building connector, routes and flat/extruded polygons are retained. Functional input checks assert repeatability, the exact common 3000-root prefix in both profiles, and identical normalized geometry and layer input between profiles. The map remains 1200 × 800, buildings 520 × 300, with 13 layers. Load initially displays all layers; other samples select floors `[0,1,2,0]` outside their measured span.

| Geometry, identical in both profiles     | 3000 roots | 5000 roots |
| ---------------------------------------- | ---------- | ---------- |
| Root points                              | 1193       | 2009       |
| Lines                                    | 601        | 1009       |
| Routes                                   | 603        | 995        |
| Polygons, total                          | 603        | 987        |
| Flat polygons                            | 301        | 493        |
| Extruded polygons                        | 302        | 494        |
| Owned points, lines + routes             | 5914       | 9898       |
| Route vertices, included above           | 4712       | 7880       |
| Contour vertices, separate from MapPoint | 3612       | 5916       |

The enriched input has ten named materials, including a common `typography` parent; point/image, line/route, polygon and probe descendants explicitly inherit. Kind rules select base appearances; the registered `benchVisual` selects SVG/PNG point variants. Source index modulo seven distributes the two icon variants. Probes use explicit material assignment. All source owned points remain pickable; selected route midpoints additionally receive an explicit material/symbol, label and `pickable: true`.

All nine probe roots plus each four-index block where `floor(index/4) % 4 === 0` have labels. Each generated label is exactly seven ASCII characters: kind initial plus six decimal digits; selected route midpoint labels use `O` plus six digits. This gives 757/1257 labelled roots (25.23%/25.14%) and 151/251 labelled owned points. One labelled owned point is in the connector's ineligible gap, so only 907/1507 distinct owners obtain text metrics during full load. The font set is **monospace, normal, 12px**; the font-edit scenario uses **16px** with the same family. No font files are downloaded. Generic monospace maps to platform fonts and does not guarantee cross-platform glyph metrics.

Default origins/offsets apply to ordinary objects; probe labels use top-left origin with `(40px,-20px)`, and the selected probe-owned label uses `(-60px,-20px)`. Labels are single-line, horizontal and retain the runtime white outline. There is no label collision avoidance or zoom visibility policy. No combination matrix was added.

| Roots | Profile          | Appearances all / selected | Labelled root / owned objects | Text nodes all / selected / viewport | Icons all / selected / viewport | SVG elements | Shadow elements / all nodes |
| ----- | ---------------- | -------------------------- | ----------------------------- | ------------------------------------ | ------------------------------- | ------------ | --------------------------- |
| 3000  | control          | 8035 / 2659                | 0 / 0                         | 0 / 0 / 0                            | 0 / 0 / 0                       | 16085        | 16087 / 16091               |
| 3000  | materials-labels | 8035 / 2659                | 757 / 151                     | 1369 / 434 / 434                     | 488 / 152 / 152                 | 17454        | 17458 / 18832               |
| 5000  | control          | 13411 / 4433               | 0 / 0                         | 0 / 0 / 0                            | 0 / 0 / 0                       | 26837        | 26839 / 26843               |
| 5000  | materials-labels | 13411 / 4433               | 1257 / 251                    | 2265 / 716 / 716                     | 822 / 255 / 255                 | 29102        | 29106 / 31376               |

“Selected” means layer-visible after independent floor selection; “viewport” additionally intersects the surface rectangle. These fixed initial positions happen to have the same selected and intersecting counts. This counts DOM text rectangles, not unobscured glyph pixels. Nodes in hidden floors remain in the DOM. SVG counts include the main surface; shadow counts also include measurement/probe helpers. The external background document is excluded from main/shadow DOM counts. Per-scenario snapshots are in instrumentation.

Control has one background image and zero icon resources. Enriched has the same background plus two inline resources: **177-byte SVG, intrinsic 16 × 16 and displayed 16 × 16 CSS px; 70-byte PNG, intrinsic 1 × 1 and displayed 14 × 14 CSS px**. The PNG is a deliberately simple square marker, so this workload does not characterize decoding detailed/large raster assets. Repeated appearances share two declared resources. The deterministic background is **42,640 bytes**, intrinsic/viewBox 1200 × 800, with 1551 elements including 388 text elements. Its text is embedded background content and is never counted as runtime labels. Background SHA-256 remains `ca3701551b18a5d9b17d798781f3bcb58d1762b672fa373df9972d3e8b80491b`.

## Correctness and input paths

Functional testing is separate from timing/instrumentation. Six existing analytic functional groups pass in each of the four size/profile cells, using literal affine clipping endpoints, independent shoelace areas, reserved geometry hits/misses, identity checks, topology edits, floor selection, source preservation and direct membership. Five additional visual groups pass at both sizes. Expected label anchors use independently known point positions, clipped segment midpoints and rectangle centroids; actual browser glyph boxes must start at the prescribed offset. They do not use runtime clipping/layout helpers as expected rectangles.

Visual checks cover actual inherited font/text and image attributes, kind/data icon selection, label-only hits outside owner geometry, flat/extruded/clipped labels, owned-point pickability and route/layer context, same-turn text/offset/font changes, stale hit removal inside batch before RAF, owner/text node preservation, one route label across two clipped fragments, direct membership, removal/reattachment and identical final complete SVG/runtime group state for batch/no-batch. Existing browser regressions retain the broader typography/geometry cases.

The runner additionally performs **five trusted native mouse checks in every size/profile cell**: original route, label-only point position (control miss), verified gutter miss, edited route and owned vertex after floor switch. These execute normal component input. No synthetic `objectclick` or capture-method stub is used.

Three query paths have different meanings:

1. `pick-hit/miss`: the preserved numeric `Spatial(prepareSceneGeometry(map.objects, map.layers))` fixture. Scene preparation resolves `getCollectionMaterials(objects)` to this map's existing `MapMaterials`, so numeric picking uses the current profile materials, including effective symbol sizes and image hit rectangles. At the hit probe `(670,480)`, control uses a circle with a 22 CSS-pixel diameter and materials-labels uses a 16 × 16 CSS-pixel image; the miss position is `(600,380)`. No ObjectLabelView is supplied, so label rectangles and their browser layout are excluded. The timed span contains only `Spatial.hitTest()`; scene/view preparation, component input and client-coordinate conversion remain outside it.
2. `label-query-hit/miss`: standard synthetic pointerdown/up through the actual component, CameraControls, current materials and browser ObjectLabels. A native mouse pointer is held active outside the query span so native pointer capture works without patches. The span includes both event dispatches, conversion/queries and successful objectclick/revalidation. Forty queries run synchronously. The label-only probe is at its literal `(670,80)` attachment plus `(44,-16)` CSS px divided by zoom; it is outside owner geometry. This same position is a validated miss in control. The gutter miss is `(600,380)`. This is a component query benchmark, not a directly timed raw label-aware Spatial call.
3. `native-label-hit/miss`: one real Playwright mouse click per repeat at those same fixed positions. Capture begins in a trusted pointerup capture listener and ends after the component's pointerup handler; successful objectclick also has its own timestamp. This covers native release processing but excludes native down processing, OS/browser queueing before pointerup, application work after the harness listener, paint and presentation. Functional native clicks also cover the original geometry path.

Functional failure aborts capture before timing. There are zero recorded page errors and no reproduced runtime defect in this workload. Synchronous component probes use the standard pointer event path through CameraControls and were fully revalidated before final capture.

## Method and metric boundaries

Three complete warmup repetitions precede **20 timing repetitions** and, on a separate page, **three instrumentation repetitions**, for every size/profile. Each scenario loads a fresh map; scene creation/attachment, non-load resource preparation, initial floor selection and settled metric-cache setup are excluded from the operation span. Sizes run 3000 then 5000. Scenario order rotates deterministically by repeat; profile order alternates by repeat to reduce fixed order bias. This adds two profiles and new scenarios to the existing method; it does not pair every scenario at the same wall-clock instant.

Before warmups, the background and both icon sources are decoded, `document.fonts.load` is awaited for 12px and 16px monospace, and `document.fonts.ready` completes. Modules and system fonts are warm. Each fresh map still performs runtime image-resource fetch/validation/Blob allocation/decode and starts with a fresh per-map text metric cache. Load promise includes resource preparation; initial glyph measurements occur in the following render and are included in load-to-SVG/two-RAF spans. Other scenarios start after those measurements. Browser/internal decode caches and repeated resources may be reused. These are repeated warm loads, not cold startup or network launch measurements.

| Metric                                 | Boundary                                                               |
| -------------------------------------- | ---------------------------------------------------------------------- |
| load_call_sync_ms                      | map.load entry → synchronous promise return                            |
| load_promise_ms                        | map.load entry → API promise resolution; first label render can follow |
| operation_sync_ms / camera_api_sync_ms | synchronous setter/action entry → return                               |
| svg_last_delivery_from_start_ms        | operation entry → last observed SVG MutationObserver delivery          |
| post_sync_svg_delivery_ms              | synchronous return → SVG mutation delivery, including scheduling       |
| operation_to_two_raf_ms                | operation entry → two later RAF callback opportunities                 |
| raf_interval_ms                        | adjacent RAF callback timestamps; 24 camera steps per repetition       |
| spatial_pick_sync_ms                   | one numeric hitTest with profile materials; no label rectangles        |
| component_pointer_query_sync_ms        | synthetic pointerdown/up dispatch through current component            |
| native_pointerup_dispatch_ms           | native pointerup capture listener → post-handler listener              |
| native_pointerup_to_objectclick_ms     | native pointerup capture listener → successful objectclick listener    |

The timing MutationObserver only timestamps delivery; no work patches or detailed DOM traversal run in timed spans. Mutation delivery is not exact last-write time. Load promise, mutation delivery and two RAF callbacks do not prove completed paint, displayed FPS or input-to-presentation latency. No retained memory/MB result was measured.

Tables show **median / nearest-rank p95 / max**, in ms. Each load/mutation/native metric has n=20 across 20 repetitions. Motion metrics have n=480 across 20 repetitions; numeric/synthetic queries have n=800. Those per-frame/query samples are correlated within repetitions. At n=20, p95 is the 19th sorted value. Timer quantization produces zeros and small rounded sync values; zero does not mean no work. No significance test, confidence interval or causal mechanism-isolation claim is made.

## Timing results

### Load, n=20, repetitions=20

| Roots | Profile          | Load call sync           | Load promise             | Entry → SVG delivery     | Entry → two RAF          |
| ----- | ---------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| 3000  | control          | 71.85 / 79.20 / 80.70    | 88.85 / 101.20 / 107.10  | 123.70 / 137.70 / 144.80 | 148.10 / 171.80 / 173.20 |
| 3000  | materials-labels | 79.05 / 87.30 / 92.30    | 104.10 / 118.80 / 119.00 | 215.60 / 259.90 / 285.80 | 252.30 / 318.00 / 548.00 |
| 5000  | control          | 119.50 / 149.10 / 152.20 | 148.00 / 189.00 / 271.20 | 205.50 / 282.30 / 334.00 | 248.80 / 325.90 / 378.00 |
| 5000  | materials-labels | 129.85 / 161.90 / 581.50 | 170.80 / 281.30 / 637.10 | 380.50 / 827.00 / 850.70 | 439.50 / 898.80 / 909.90 |

### Pan/zoom, n=480, repetitions=20

| Roots | Profile          | Motion | Setter sync        | Post-sync SVG delivery | RAF interval           |
| ----- | ---------------- | ------ | ------------------ | ---------------------- | ---------------------- |
| 3000  | control          | pan    | 0.00 / 0.10 / 0.10 | 16.70 / 17.40 / 20.40  | 16.70 / 16.80 / 16.80  |
| 3000  | control          | zoom   | 0.00 / 0.10 / 0.10 | 16.60 / 18.90 / 44.60  | 16.70 / 16.80 / 50.00  |
| 3000  | materials-labels | pan    | 0.00 / 0.10 / 0.10 | 16.60 / 17.60 / 100.80 | 16.70 / 16.80 / 83.40  |
| 3000  | materials-labels | zoom   | 0.00 / 0.10 / 5.10 | 25.00 / 31.60 / 286.70 | 33.20 / 33.40 / 199.90 |
| 5000  | control          | pan    | 0.00 / 0.10 / 0.10 | 16.70 / 17.60 / 79.40  | 16.70 / 16.80 / 66.70  |
| 5000  | control          | zoom   | 0.00 / 0.10 / 0.40 | 19.60 / 26.50 / 358.10 | 16.70 / 33.40 / 233.30 |
| 5000  | materials-labels | pan    | 0.00 / 0.10 / 0.10 | 20.25 / 32.50 / 284.80 | 16.70 / 33.40 / 300.00 |
| 5000  | materials-labels | zoom   | 0.00 / 0.10 / 0.20 | 44.10 / 56.60 / 193.80 | 50.00 / 66.70 / 183.20 |

### Queries and native release, repetitions=20

| Roots | Profile          | Path / fixed position | n   | Synchronous query / native release span |
| ----- | ---------------- | --------------------- | --- | --------------------------------------- |
| 3000  | control          | pick-hit              | 800 | 0.10 / 0.30 / 3.00                      |
| 3000  | control          | pick-miss             | 800 | 0.70 / 0.80 / 6.50                      |
| 3000  | control          | label-query-hit       | 800 | 0.70 / 0.90 / 2.20                      |
| 3000  | control          | label-query-miss      | 800 | 0.70 / 0.80 / 2.00                      |
| 3000  | control          | native-label-hit      | 20  | 1.70 / 2.00 / 4.60                      |
| 3000  | control          | native-label-miss     | 20  | 1.50 / 1.80 / 2.20                      |
| 3000  | materials-labels | pick-hit              | 800 | 0.10 / 0.20 / 1.60                      |
| 3000  | materials-labels | pick-miss             | 800 | 0.70 / 0.80 / 6.20                      |
| 3000  | materials-labels | label-query-hit       | 800 | 0.60 / 0.70 / 4.20                      |
| 3000  | materials-labels | label-query-miss      | 800 | 0.70 / 0.90 / 7.40                      |
| 3000  | materials-labels | native-label-hit      | 20  | 1.50 / 3.50 / 7.00                      |
| 3000  | materials-labels | native-label-miss     | 20  | 1.80 / 2.00 / 2.20                      |
| 5000  | control          | pick-hit              | 800 | 0.30 / 0.40 / 2.60                      |
| 5000  | control          | pick-miss             | 800 | 1.30 / 1.70 / 35.90                     |
| 5000  | control          | label-query-hit       | 800 | 1.40 / 1.80 / 9.50                      |
| 5000  | control          | label-query-miss      | 800 | 1.30 / 1.70 / 5.60                      |
| 5000  | control          | native-label-hit      | 20  | 2.90 / 3.60 / 3.70                      |
| 5000  | control          | native-label-miss     | 20  | 2.65 / 3.00 / 7.80                      |
| 5000  | materials-labels | pick-hit              | 800 | 0.30 / 0.40 / 2.90                      |
| 5000  | materials-labels | pick-miss             | 800 | 1.20 / 1.40 / 5.00                      |
| 5000  | materials-labels | label-query-hit       | 800 | 1.10 / 2.30 / 8.40                      |
| 5000  | materials-labels | label-query-miss      | 800 | 1.40 / 1.70 / 4.70                      |
| 5000  | materials-labels | native-label-hit      | 20  | 2.60 / 3.30 / 3.80                      |
| 5000  | materials-labels | native-label-miss     | 20  | 3.25 / 3.80 / 13.50                     |

The `*-label-hit` position is a miss in control, so those cross-profile query differences include changed occupancy and traversal termination. A smaller enriched hit time does not isolate lower label-picking cost. Successful native pointerup-to-objectclick spans are 3000: 1.50 / 3.50 / 6.90; 5000: 2.60 / 3.30 / 3.80, n=20 each.

### Existing floor/geometry/membership scenarios, n=20, repetitions=20

Post-sync SVG-delivery spans are shown below. Full synchronous, entry-to-delivery and two-RAF statistics remain in the summary.

| Scenario            | 3000 control           | 3000 enriched            | 5000 control            | 5000 enriched           |
| ------------------- | ---------------------- | ------------------------ | ----------------------- | ----------------------- |
| floor-switch        | 16.70 / 17.70 / 43.80  | 9.30 / 15.70 / 20.30     | 16.35 / 17.40 / 22.90   | 7.45 / 20.30 / 20.30    |
| vertex-position     | 8.00 / 12.40 / 13.20   | 8.40 / 15.40 / 16.10     | 10.40 / 26.90 / 56.90   | 8.80 / 15.50 / 16.80    |
| route-add           | 17.45 / 23.50 / 73.80  | 14.05 / 19.50 / 39.40    | 18.65 / 25.40 / 34.00   | 14.80 / 24.50 / 25.40   |
| route-insert        | 14.85 / 47.60 / 312.20 | 16.90 / 54.70 / 282.80   | 14.95 / 26.20 / 30.40   | 15.95 / 41.70 / 77.40   |
| route-remove        | 16.90 / 30.20 / 58.10  | 14.90 / 21.80 / 24.70    | 18.05 / 28.20 / 54.80   | 17.10 / 27.90 / 64.40   |
| route-replacePoints | 15.50 / 22.20 / 23.10  | 13.80 / 18.20 / 23.30    | 18.30 / 25.50 / 25.60   | 17.30 / 24.20 / 25.80   |
| polygon-vertex      | 8.80 / 13.70 / 15.20   | 9.00 / 14.50 / 14.90     | 8.50 / 16.10 / 19.10    | 6.65 / 14.10 / 14.40    |
| polygon-baseZ       | 15.00 / 22.60 / 57.60  | 11.05 / 15.90 / 21.20    | 16.65 / 24.20 / 30.30   | 15.05 / 22.50 / 36.80   |
| polygon-height      | 13.40 / 24.40 / 55.10  | 15.40 / 26.00 / 87.10    | 12.70 / 22.00 / 23.00   | 16.90 / 23.80 / 39.70   |
| root-add            | 40.80 / 48.90 / 126.90 | 40.35 / 49.10 / 49.20    | 60.25 / 69.00 / 70.70   | 63.95 / 72.20 / 73.50   |
| root-remove         | 42.90 / 49.30 / 52.50  | 43.40 / 144.80 / 1048.10 | 58.70 / 69.00 / 70.20   | 61.80 / 75.30 / 76.90   |
| layer-direct-add    | 42.25 / 70.00 / 78.70  | 42.60 / 99.50 / 129.20   | 59.55 / 74.00 / 134.50  | 63.80 / 150.20 / 175.50 |
| layer-direct-remove | 41.60 / 55.30 / 86.40  | 40.50 / 45.50 / 47.30    | 64.40 / 122.80 / 714.90 | 61.70 / 74.90 / 111.40  |

### Text/material/group scenarios, n=20, repetitions=20

These six scenarios are explicitly applicable only to `materials-labels`; control has no corresponding label/material declarations. `label-text` replaces one point label with `Updated point 000006` (20 characters). Color/offset and font whole-value edits target `probe-marker`, which has two root consumers. Color/offset moves x from 40px to 60px and changes text color without changing font. Font changes 12px → 16px monospace. Shared `typography` is replaced with the same font and a changed label color; all **8914 / 14898** root+owned runtime objects inherit from it, including objects with no visible label.

`group-no-batch` and `group-batch` each execute, in array order on `root-16`…`root-31`: label=`Uxxxxxx`, material=`probe-style`, label=`Vxxxxxx`. This is 48 setters on 16 roots in one synchronous turn. The only wrapping difference is `map.batch(update)`. Entry-to-return and subsequent observation boundaries match. There is no await, explicit render or extra query between updates.

| Scenario           | 3000 sync          | 3000 post-sync SVG     | 5000 sync          | 5000 post-sync SVG    |
| ------------------ | ------------------ | ---------------------- | ------------------ | --------------------- |
| label-text         | 0.00 / 0.10 / 0.10 | 10.35 / 16.00 / 20.50  | 0.00 / 0.00 / 0.10 | 5.80 / 19.40 / 81.80  |
| label-color-offset | 0.95 / 1.10 / 1.30 | 9.15 / 15.50 / 15.90   | 1.40 / 1.60 / 1.70 | 10.35 / 13.90 / 15.30 |
| label-font         | 0.90 / 1.00 / 1.00 | 7.50 / 14.50 / 15.40   | 1.50 / 1.50 / 1.50 | 9.85 / 14.70 / 15.50  |
| shared-material    | 1.90 / 6.70 / 6.90 | 19.30 / 30.30 / 204.10 | 2.80 / 3.10 / 3.10 | 20.80 / 28.00 / 30.30 |
| group-no-batch     | 0.10 / 0.20 / 0.20 | 9.90 / 17.80 / 19.00   | 0.10 / 0.20 / 0.20 | 12.80 / 28.50 / 34.30 |
| group-batch        | 0.10 / 0.20 / 0.30 | 7.35 / 14.20 / 16.00   | 0.10 / 0.20 / 0.30 | 8.20 / 17.40 / 17.90  |

Both group sync medians are 0.10ms at both sizes and both issue one renderer callback with identical work counters. Their different SVG-delivery medians include RAF phase/scheduling. This experiment establishes no batch speedup; the existing RAF scheduler already coalesces this turn. It also does not establish a universal batching benefit or penalty for other update patterns.

### Combined visual-content difference

This comparison holds the runtime, base geometry, viewport and method fixed. It measures the combined selected data/material/icon/label content. It is not a pure label, font or material-mechanism cost. The complete delta CSV retains p95/max and all common metrics too.

| Roots | Metric                                | Control median | Enriched median | Delta ms | Delta % |
| ----- | ------------------------------------- | -------------- | --------------- | -------- | ------- |
| 3000  | load: load_promise_ms                 | 88.85          | 104.10          | +15.25   | +17.2%  |
| 3000  | load: svg_last_delivery_from_start_ms | 123.70         | 215.60          | +91.90   | +74.3%  |
| 3000  | pan: post_sync_svg_delivery_ms        | 16.70          | 16.60           | -0.10    | -0.6%   |
| 3000  | zoom: post_sync_svg_delivery_ms       | 16.60          | 25.00           | +8.40    | +50.6%  |
| 3000  | zoom: raf_interval_ms                 | 16.70          | 33.20           | +16.50   | +98.8%  |
| 5000  | load: load_promise_ms                 | 148.00         | 170.80          | +22.80   | +15.4%  |
| 5000  | load: svg_last_delivery_from_start_ms | 205.50         | 380.50          | +175.00  | +85.2%  |
| 5000  | pan: post_sync_svg_delivery_ms        | 16.70          | 20.25           | +3.55    | +21.3%  |
| 5000  | zoom: post_sync_svg_delivery_ms       | 19.60          | 44.10           | +24.50   | +125.0% |
| 5000  | zoom: raf_interval_ms                 | 16.70          | 50.00           | +33.30   | +199.4% |

## Instrumentation and locality

Counters run in the separate diagnostic phase with prototype/getter patches restored before validation/cleanup. Setup load is instrumented so renderer wrappers are installed for every scenario, then counters reset immediately before the measured operation. Instrumented time is stored only in the instrument CSV and never enters the timing tables.

`getBBox` counts actual text metric reads. `svg_text_content_writes` includes both hidden measurement text and displayed text; for one text edit that is one of each. Style attributes include fill/stroke/font and related setAttribute calls. Connected-subtree style mutations from CSSOM are counted separately; pre-attachment cssText setup and attribute removal are not a complete general style-operation count. “Touched owners” counts distinct data-object IDs in actual SVG writes; IDs are unique in this scene. Before/after node snapshots cover main-SVG descendants and run outside counters. Renderer changed-entry counts retain their geometry/appearance-union meaning and exclude the separate label-text queue. Getter/iterator proxies do not count every internal array scan or arithmetic operation.

The following counts are constant in all three repetitions at both sizes (median=p95=max; n=3). Geometry rows are representative; verification additionally checks zero text remeasurement in all preserved geometry, floor and membership scenarios.

| Enriched scenario  | Text getBBox | Touched owners | Geometry writes | Text-content writes | Style attribute writes | Render callbacks | New nodes |
| ------------------ | ------------ | -------------- | --------------- | ------------------- | ---------------------- | ---------------- | --------- |
| pan                | 0            | 0              | 0               | 0                   | 0                      | 24               | 0         |
| vertex-position    | 0            | 2              | 4               | 0                   | 0                      | 1                | 0         |
| polygon-vertex     | 0            | 1              | 2               | 0                   | 0                      | 1                | 0         |
| label-text         | 1            | 1              | 0               | 2                   | 3                      | 1                | 0         |
| label-color-offset | 0            | 2              | 0               | 0                   | 2                      | 1                | 0         |
| label-font         | 2            | 2              | 0               | 2                   | 8                      | 1                | 0         |
| group-no-batch     | 16           | 16             | 0               | 32                  | 164                    | 1                | 16        |
| group-batch        | 16           | 16             | 0               | 32                  | 164                    | 1                | 16        |

| Roots | Enriched shared material: text getBBox | Text owners | Text fill writes | Geometry writes | Renderer affected appearances |
| ----- | -------------------------------------- | ----------- | ---------------- | --------------- | ----------------------------- |
| 3000  | 0                                      | 907         | 1369             | 0               | 8035                          |
| 5000  | 0                                      | 1507        | 2265             | 0               | 13411                         |

Text edits measure one owner; changing the font measures exactly the two consumers of `probe-marker`; color/offset and shared-color changes reuse metrics. Geometry/membership edits, pan and zoom reuse unchanged text metrics. The 16-root sequence measures 16 final texts, so the intermediate `U` values are not laid out in this one turn. Batch/no-batch each produce 228 SVG attributes, 188 text attributes, 32 text-content writes and 164 style attributes.

All existing main-SVG nodes survive pan, zoom, point/polygon position, text, color/offset, font and shared-color edits. In the group scenarios, all owner groups and existing text survive; four image children legitimately become circles and twelve new text nodes appear: 16 new nodes, four removed shape nodes, and no map-geometry writes. The full functional state/SVG equality check confirms both versions end identically.

Zoom work across 24 steps is:

| Roots | Profile          | All SVG attributes | Text attributes | Circle scales | ViewBox | Text getBBox | Geometry writes |
| ----- | ---------------- | ------------------ | --------------- | ------------- | ------- | ------------ | --------------- |
| 3000  | control          | 103656             | 0               | 103632        | 24      | 0            | 0               |
| 3000  | materials-labels | 136512             | 32856           | 91920         | 24      | 0            | 0               |
| 5000  | control          | 174312             | 0               | 174288        | 24      | 0            | 0               |
| 5000  | materials-labels | 228672             | 54360           | 154560        | 24      | 0            | 0               |

The additional 32,856 / 54,360 attributes equal 1369 / 2265 text-node transforms × 24 steps. The point-image variants also have scale transforms; the historical `svg_symbol_scale_writes` counter only recognizes circles, so its smaller enriched value is not a total symbol-work reduction. All layers' nodes, including hidden floors, receive scale updates. No new nodes or text measurements occur. Pan has only 24 viewBox writes in both profiles, zero object writes and zero measurements. The worse enriched pan delivery/cadence despite identical pan write counts is a reminder that counters alone cannot attribute scheduling, layout, raster, GC or host work.

## Noise, limitations and next investigation

Zoom is a repeatable workload signal in the pooled medians/p95: enriched callback intervals are 33.20 / 33.40ms at 3000 and 50.00 / 66.70ms at 5000, while corresponding control medians remain 16.70ms. Increased deterministic text-transform writes support a real increase in work. They do not assign all of the elapsed difference to text serialization, layout or raster, and these intervals must not be converted into displayed-FPS claims.

There are substantial tails in both profiles. At 5000, enriched load promise max is 637.10ms and load-to-SVG max 850.70ms (zero-based repeat 16), whereas median promise/load-to-SVG are 170.80/380.50ms. Enriched pan RAF max is 300.00ms (repeat 8, sample 15), and control zoom SVG delivery max is 358.10ms after sync (repeat 16, sample 22). At 3000, enriched shared-material delivery has a 204.10ms max (repeat 7) against median 19.30ms. Control numeric miss at 5000 reaches 35.90ms (repeat 17, sample 10) with median 1.30ms. All raw samples and repetition identities are preserved. No browser CPU trace, allocation trace or forced-GC experiment was captured, so causes remain unassigned. Pooled samples are not independent trials and three diagnostic repetitions cannot characterize population tails.

The bounded follow-up is a separate quiet zoom profile of this frozen workload at 3000/5000: attribute scripting, style/layout, raster/compositing and GC; inspect renderer scale application to visible/hidden symbol and label nodes. Only then select a correction, such as reducing unnecessary hidden-appearance updates if that cost is shown material and first-visible correctness can be preserved. This task changes no engine behavior. Larger PNG/SVG assets, longer/multilingual strings, font loading failures, other densities, multiple fonts, headed/physical mobile browsers and broad picking distributions need their own evidence where relevant. No matrix of those cases or new extension framework is implied.

The new per-frame/input metrics and resource warmup are explicitly documented above. Historical reports are retained as historical evidence; there is no claim that old and new numbers form an unchanged before/after experiment.

## Reproduction and review scope

Run project checks/tests/builds sequentially, then build the benchmark last. Start capture only after competing project/browser work has stopped. Use a fresh output prefix because the runner refuses to overwrite evidence:

```sh
npm run bench:build
node examples/prototype-bench.run.mjs --warmups 3 --repeats 20 --instrument-repeats 3 --output docs/performance/prototype-YYYY-MM-DD-material-labels
python3 docs/performance/prototype-2026-10-20-material-labels-recompute.py
```

The recomputation script checks this saved capture; its filename determines the prefix. Input hashes, the source commit and a production build must match before reproducing. Dirty documentation can evolve without weakening actual build-input verification. Summary recomputation checked all **470 timing groups** and **4770 instrument groups**, unique raw sample keys, every expected repetition and profile separation. The verification artifact also confirms historical preservation, unchanged index/runtime/package/lockfile, and text-metric/batch invariants.

Review changes are limited to the prototype scene/runner/instrumentation, bounded visual-check helper, main benchmark harness, one config input-manifest entry and new artifacts under `docs/performance/`. Existing clipping/geometry functional checks and HTML were retained. General design documents and the index were not edited by this task. All changes remain unstaged; no commits, push or PR were made.
