# Hidden-layer zoom experiment — 2026-10-21, candidate for review

**Unnecessary work is removed; a robust practical smoothness improvement is not
established.** This run observes smaller scripting/style intervals and better RAF
p95. The 5000-root materials/labels RAF median remains about 33.3 ms, native SVG
`Layout` does not improve, and the candidate retains a worse maximum interval.
The sequential candidate run also had substantially lower OS background load.
Keeping the candidate awaits the user's decision. No performance gate is introduced.

The fresh baseline was captured before runtime changes; historical
[profiling r2](ZOOM_PROFILE_2026_10_20.md) supplies context, never before/after samples.
All earlier performance files and raw captures are preserved. Work used the main
checkout, fetched `origin/master` at `3b4cfecb48c1335994cf2c617fcd5f71a013bfba`, then
created `feat/hidden-layer-zoom`. The initial working tree was clean. No worktree,
staging, commit, push, PR or remote CI inspection occurred.

## Candidate and correctness

- [SvgRenderer](../../src/renderers/svg/svg-renderer.ts) skips camera-only point
  scaling and label queue additions for runtime-hidden layers. This is layer
  visibility, with no viewport/occlusion culling. The existing geometry, material,
  text, typography, membership and spatial update paths remain active.
- A transition to visible adds current appearances to the existing `unpainted`
  and label queues. The same render resolves current shape, scale, text, metrics
  and attachment, even when renderer-wide scale is unchanged. Queue processing
  occurs before that render returns; no later zoom is needed. Zero-viewport
  deferral retains the work. There is no cached transform replay or new dirty flag.
- New hidden shapes still receive initial scale. Shape replacement and ordinary
  hidden edits keep their existing rules. Current clipping/fragment membership is
  reconciled before catch-up. Surviving owner, shape and text nodes are reused.
- [The scale helper](../../src/renderers/svg/svg-renderer.utils.ts) uses the existing
  changed-attribute helper, so hide/show at unchanged scale does not cause redundant
  writes. The private camera helper keeps the existing loops readable and within
  the repository's complexity rule. No public API, runtime flag, dependency, LOD,
  clustering or general invalidation mechanism is added.
- Model visibility and numeric label/symbol picking remain synchronous, including
  before RAF and within nested batch. DOM display remains deferred by batch.

The [seven directed browser regressions](../../tests/browser/hidden-layer-zoom.browser.test.ts)
pass. They cover hide → several different zooms → show on the first RAF, unchanged
global renderer scale, independent building floors and new hidden roots; circles,
images, labels of all four owner kinds and owned points; moved positions, edited
text, inherited material/font/color and circle ↔ image with resized images;
direct/clipped changes, route fragment disappearance/recreation, polygon attachments
and empty/recreated labels; removal/reattachment, shared objects and reconnect at
different map scales; nested-batch immediate picking with owner/layer/route identity;
and zero-viewport recovery. Surviving nodes, actual CSS-pixel sizes and analytic
attachments are asserted. Label widths have an independent Canvas oracle with a
0.1 CSS-pixel SVG/Canvas glyph-rounding tolerance.

Every first-show case leaves zoom different from the scale at hiding and queries
output without another zoom. A negative control temporarily removed only show
catch-up: the first-RAF test failed on a **24 px circle versus the independent
12 px expectation** at zoom 2. Runtime bytes were restored exactly and all seven
tests passed again. Internal queue state is not the correctness oracle.

## Method and identities

The existing profiling harness gained a small `--first-show` scenario **before
baseline**. Its runner, analyzer and browser scenario bytes are identical between
baseline and candidate. Strict source/build verification was retained: all four
final runs verify 88 inputs, including runner/analyzer, and 15 build files at 32
boundaries. Only two input hashes differ between versions: the renderer and its
utils file. Both script-mutation probes were repeated for each version; the actual
runner rejected each mutation at `capture:before`, with zero measurements started.

Each version has one final benchmark build, frozen independently for both of its
scenarios. Source snapshots are also retained in each raw directory's `inputs/`.
All hashes, environments, boundaries and final assertions appear in the manifests
and [independent verification](hidden-zoom-2026-10-21-verification.json).
Aggregates below hash JSON-serialized, path-sorted `[path, hash]` pairs.

| Group                   | Baseline SHA-256                                                   | Candidate SHA-256                                                  |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Runtime                 | `7f9b9af5647ad97db6c79d0194f8b380e21b6fa68aed52a4c81d926f63502285` | `db8e4ddd5bdbb9a8004a8e73f368e363226ed7e81dfeaca45143ec7931111f32` |
| Harness/config/packages | `af2a1447e5a9d41356f941474a0c379f739addefb01ec3c35995a4f06bbb6641` | `af2a1447e5a9d41356f941474a0c379f739addefb01ec3c35995a4f06bbb6641` |
| Frozen build            | `76e674aab80cbea018278f253fa811c4741bfdb74a209f94379e2ad4bd5e9106` | `b395bb48e1478de9f2c77bc9bc7673aab53edb87e96419c0fe81bca7959a0e2a` |

Apple M2, 8 logical CPUs, 16 GiB, macOS (Darwin 25.6.0 arm64), Node 20.19.6,
Playwright 1.63.0, headless Chromium 153.0.8010.12. Browser viewport 1100 × 900,
map 960 × 640 CSS px, DPR 1, default launch, no custom throttling or forced GC.
Unminified ES2022 production benchmark with source maps. Seed `0x50524f54`,
3000/5000 roots, geometry, materials, SVG/PNG resources, labels, background and
initial floors `[0,1,2,0]` are unchanged; initial visibility is 5 of 13 layers.

Both scenarios use 3 warmups and 20 clean timing repetitions per size/profile,
then separate 3 diagnostic captures and 3 counter repetitions, each phase with its
own 3 clean warmups. Profile order alternates per repetition. Pages and phases
are sequential. Timing has no instrumentation, MutationObserver or profiler.
Diagnostics use CDP browser tracing and 1000 µs V8 sampling, with the original
trace categories. Counters run separately with no profiler.

Zoom uses the original 24-step cosine sequence and two settling RAFs. It returns
to zoom 0.8, retaining identical markup and every node. It is not sufficient by
itself to test catch-up. The new first-show scenario instead:

1. Loads the same scene/floors at zoom 0.8; `b0-f1` is hidden.
2. Changes zoom to 1.2 while that floor stays hidden, then settles outside measurement.
3. Inside a RAF callback, measures synchronous `selectFloor(map, 0, 1)` and waits
   for two subsequent RAF callbacks, with no camera edit. The main duration starts
   immediately before the floor switch and ends immediately after the second
   callback. Two individual RAF timestamp intervals are also retained.
4. Checks unchanged camera/source count, surviving node identity and current scale
   of every point/text appearance in the shown layer, outside measurement.

The traced first-show window starts just before the switch and ends after the
second callback; two `atlas-zoom-step-*` markers divide it. Existing zoom captures
retain 24 markers. Neither these callbacks nor MutationObserver delivery proves
completed paint. RAF intervals are callback intervals, **not displayed FPS**.

Final local capture times, Europe/Riga, all on 2026-10-21:

| Version   | Zoom              | First show        |
| --------- | ----------------- | ----------------- |
| Baseline  | 09:57:48–10:00:18 | 10:00:18–10:01:21 |
| Candidate | 10:11:34–10:13:42 | 10:13:42–10:14:42 |

No tests, builds or other profilers from this task ran concurrently with final
capture. OS/desktop background work was uncontrolled. Zoom start/end load averages
were **8.40/16.37/13.68 → 10.68/13.29/12.80** for baseline and
**3.27/4.97/8.15 → 2.99/4.28/7.43** for candidate. First-show start/end values are
in verification. Baseline always preceded candidate; build/order/cache/thermal
and substantially different background load confound elapsed-time attribution.
These are 1/5/15-minute load averages, not measured CPU utilization.
This is one sequential single-host comparison, without a crossover control.

## Ordinary timing

Each zoom cell contains 480 intervals from 20 repetitions. Medians/p95/max retain
every sample and are rounded here to 0.1 ms; CSVs retain precision.

| Roots | Profile          | Baseline RAF median / p95 / max, ms | Candidate RAF median / p95 / max, ms |
| ----- | ---------------- | ----------------------------------- | ------------------------------------ |
| 3000  | control          | 16.7 / 16.7 / 33.4                  | 16.7 / 16.7 / 16.8                   |
| 3000  | materials-labels | 16.7 / 33.4 / 50.0                  | 16.7 / 16.8 / 66.7                   |
| 5000  | control          | 16.7 / 33.4 / 83.4                  | 16.7 / 16.8 / 50.0                   |
| 5000  | materials-labels | 33.4 / 50.1 / 116.7                 | 33.3 / 33.4 / 183.3                  |

For enriched 5000, intervals above 35 ms fall from **233/480 to 22/480**. Per-repeat
RAF medians range **33.3–50.0 ms** before and **25.0–33.3 ms** after. The pooled
median's 0.1 ms change is refresh-interval quantization, not a meaningful median
speedup. Candidate's **183.3 ms** tail is timing repeat 5, step 7; it also retains
116.6 ms at repeat 9, step 14. Baseline's 116.7 ms is repeat 11, step 22. Ordinary
timing has no trace, so no GC/OS/paint cause is assigned to these particular tails.
Camera setter median is 0 at this timer resolution in every cell, p95 0.1 ms;
zero does not mean no work.

First show has 20 operation durations per cell. This duration includes RAF phase
and scheduling; its delta is not an isolated catch-up execution timer.

| Roots | Profile          | Baseline switch → two RAFs median / p95 / max, ms | Candidate median / p95 / max, ms |
| ----- | ---------------- | ------------------------------------------------- | -------------------------------- |
| 3000  | control          | 33.30 / 34.70 / 34.80                             | 33.25 / 34.00 / 34.00            |
| 3000  | materials-labels | 32.10 / 33.40 / 34.70                             | 33.30 / 34.20 / 36.10            |
| 5000  | control          | 29.80 / 33.30 / 33.70                             | 33.25 / 33.60 / 34.20            |
| 5000  | materials-labels | 27.70 / 39.00 / 59.50                             | 32.45 / 34.90 / 39.30            |

First-show synchronous setter median is also 0 and p95 0.1 ms. The individual
RAF distributions remain in the linked CSVs; there are 40 intervals per cell.

## Separate browser traces

The table gives the median of three per-sequence event-name unions, in ms.
`FunctionCall` means scripting callback wall intervals; `UpdateLayoutTree` is
style work. These are diagnostic wall intervals, not exclusive CPU totals or
ordinary timing. They must not be summed with nested events. The analyzer's
script/style-layout overlap is zero in the zoom captures. Sampling/source maps,
all steps, raster/other threads and every capture remain in diagnostics/raw files.

| Roots | Profile          | FunctionCall before → after | UpdateLayoutTree before → after | Layout before → after |
| ----- | ---------------- | --------------------------- | ------------------------------- | --------------------- |
| 3000  | control          | 35.87 → 15.26               | 75.26 → 25.89                   | 45.46 → 39.87         |
| 3000  | materials-labels | 130.11 → 57.05              | 149.25 → 51.26                  | 185.88 → 193.26       |
| 5000  | control          | 54.73 → 30.79               | 130.92 → 45.68                  | 78.72 → 73.72         |
| 5000  | materials-labels | 212.92 → 103.44             | 256.92 → 88.08                  | 325.40 → 328.81       |

For enriched 5000, baseline/candidate ranges across three captures are
186.93–264.17 / 84.56–145.65 ms for callbacks,
256.55–294.17 / 86.64–93.26 ms for style,
316.44–357.40 / 325.91–337.38 ms for layout. SVG layout remains substantial.
Median `PrePaint` is 138.34 → 136.52 ms and `Paint` 66.23 → 62.53 ms.
The candidate retains a traced repeat with **78.52 ms GC** and a 118.89 ms maximum
step window; nothing is excluded as an outlier. Trace/sampling overhead and OS
descheduling limit timing precision, and diagnostic events cannot explain a
different, ordinary timing repetition's tail.

First-show callback medians increase **0.09 → 0.65**, **0.10 → 0.88**,
**0.08 → 0.89**, **0.08 → 1.41 ms**, in the table's size/profile order. For enriched
5000, style is **2.17 → 2.67 ms**, layout **2.70 → 2.53 ms**. This observes the
extra show-time SVG catch-up work; it is not a physical presentation latency claim.

## Work counters

All three repetitions per cell agree exactly, before and after. Each row is one
complete 24-step zoom. Every candidate hidden circle/image/text transform count is
zero; visible transform counts match baseline separately for every symbol/text kind.
The visible attribute totals below are therefore unchanged.

| Roots | Profile          | Visible attributes, both versions | Hidden attributes baseline → candidate | All SVG attributes baseline → candidate |
| ----- | ---------------- | --------------------------------- | -------------------------------------- | --------------------------------------- |
| 3000  | control          | 35448                             | 68184 → 0                              | 103656 → 35472                          |
| 3000  | materials-labels | 45864                             | 90624 → 0                              | 136512 → 45888                          |
| 5000  | control          | 59496                             | 114792 → 0                             | 174312 → 59520                          |
| 5000  | materials-labels | 76680                             | 151968 → 0                             | 228672 → 76704                          |

Both versions retain exactly 24 renderer callbacks, 24 surface viewBox writes and
48 computed-style reads per zoom. Text measurements/content writes, map geometry
writes, child additions/removals and client-rectangle reads remain zero. Scene
inventories, selected floors and final identity assertions agree. These counts
demonstrate the intervention, not a prediction of an elapsed-time saving percentage.

First-show candidate writes to the previously hidden target floor are:

| Roots | Profile          | Circle / image / text transforms |
| ----- | ---------------- | -------------------------------- |
| 3000  | control          | 292 / 0 / 0                      |
| 3000  | materials-labels | 239 / 53 / 131                   |
| 5000  | control          | 496 / 0 / 0                      |
| 5000  | materials-labels | 407 / 89 / 214                   |

Baseline needs zero such writes because it continuously updated hidden nodes.
Both versions use one renderer callback and two computed-style reads for show;
neither remeasures text or writes geometry/text content/adds/removes nodes.
Instrumentation labels membership as visible/hidden **at setup**. Thus first-show
catch-up counts appear under `hidden_*` in JSON/CSV even though the floor is shown
during the operation. This is not hidden camera work recurring. Attribute counters
patch `setAttribute`; removing `display` is not counted, while hiding the previous
floor contributes one display write in each version.

## Checks and retained evidence

All implementation checks completed before the final candidate benchmark build
and captures: `npm run check` (0 errors, 71 existing advisory warnings), `npm test`
(468), `npm run test:browser` (330, including 7 new cases), `npm run build`,
`npm run test:e2e` (23), and `npm run test:platform` (3 engines, 15 groups/50 subcases
each). The first platform attempt passed Chromium/Firefox and 14 WebKit groups,
but Factory readiness stayed at viewport 0. Its evidence is preserved at
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-NY2Ppk`.
The unchanged full rerun passes all engines, with integrity verification, at
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-8JwXFM`.
The earlier platform report also records an initial WebKit viewport-readiness case.
No test timeout or assertion was weakened.

Baseline/candidate representative functional/native checks pass all four cells:
six analytic groups each, five extra visual groups for enriched scenes, and five
native cases each. Both modes' zoom/first-show smoke and offline analysis pass.
All 48 final diagnostic captures pass, all 560 run records retain successful
postconditions, and final browser errors are zero. A first restricted smoke attempt
could not bind loopback (`EPERM`); it measured nothing and is retained separately
at `atlas-zoom-x64Yui`. Later browser commands used the permitted local-server path.

Compact evidence:

- [Combined ordinary timing](hidden-zoom-2026-10-21-summary.csv),
  [trace event ranges/medians](hidden-zoom-2026-10-21-trace-summary.csv),
  [all counters](hidden-zoom-2026-10-21-counters.csv),
  [verification and identities](hidden-zoom-2026-10-21-verification.json).
- Zoom [baseline manifest](hidden-zoom-2026-10-21-baseline-manifest.json),
  [candidate manifest](hidden-zoom-2026-10-21-candidate-manifest.json),
  [baseline timing](hidden-zoom-2026-10-21-baseline-timing.csv),
  [candidate timing](hidden-zoom-2026-10-21-candidate-timing.csv),
  [baseline diagnostics](hidden-zoom-2026-10-21-baseline-diagnostics.json),
  [candidate diagnostics](hidden-zoom-2026-10-21-candidate-diagnostics.json).
- First-show [baseline manifest](hidden-show-2026-10-21-baseline-manifest.json),
  [candidate manifest](hidden-show-2026-10-21-candidate-manifest.json),
  [baseline timing](hidden-show-2026-10-21-baseline-timing.csv),
  [candidate timing](hidden-show-2026-10-21-candidate-timing.csv),
  [baseline diagnostics](hidden-show-2026-10-21-baseline-diagnostics.json),
  [candidate diagnostics](hidden-show-2026-10-21-candidate-diagnostics.json).

Large raw traces, CPU profiles, immutable builds and input snapshots stay outside Git.
All directories below use parent
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/`:

| Evidence                          | Directory                                 |
| --------------------------------- | ----------------------------------------- |
| Baseline zoom                     | `atlas-zoom-THCc0C`                       |
| Baseline first show               | `atlas-zoom-NjSu05`                       |
| Candidate zoom                    | `atlas-zoom-E1OhyS`                       |
| Candidate first show              | `atlas-zoom-Xc1WaA`                       |
| Baseline zoom / first-show smoke  | `atlas-zoom-l2b5ms` / `atlas-zoom-9ia6XD` |
| Candidate zoom / first-show smoke | `atlas-zoom-1EBcZa` / `atlas-zoom-g2NL6n` |

Each final directory has `raw.json`, `build/`, `inputs/` and all trace/profile pairs.
Integrity-probe directories and hashes are recorded in verification. Logs,
functional manifests, negative control, smoke analyses and the offline verifier
are retained under `/private/tmp/atlas-hidden-*`.

## Reproduction and limits

Use the original runner/analyzer input bytes for a frozen version; do not bypass
hash checks to run it against the other version's source. For a fresh version,
finish checks and smoke first, build benchmark last, then run sequentially:

```sh
npm run bench:build
node examples/prototype-zoom.run.mjs
node examples/prototype-zoom.run.mjs --first-show
```

Offline, run the existing analyzer for each raw directory with a fresh output
prefix. For example:

```sh
node examples/prototype-zoom.analyze.mjs /var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-zoom-E1OhyS /private/tmp/hidden-candidate-recomputed
```

Combined timing rows copy the corresponding per-version summary statistics:
sorted sample median, nearest-rank p95 (`ceil(n * .95) - 1`) and unfiltered maximum.
Trace-summary rows take min/median/max of the three diagnostics `perName[event]`
unions per size/profile; missing names mean zero. Counter-summary rows compare
any of the three identical independent counter repetitions, also treating missing
keys as zero. Verification independently reconciles all timing statistics, all
counter repetitions, 88 source snapshots per capture, frozen/artifact hashes,
the two changed runtime inputs and preservation of historical files. Its retained
offline script and SHA-256 are identified inside verification; the four directory
arguments use the order baseline zoom, baseline show, candidate zoom, candidate
show, followed by the repository path.

The bounded candidate removes hidden camera work correctly and shifts a small
amount of work to first show. Observed p95 and scripting/style improvements are
useful evidence, with the order/load caveat above. They do not establish a stable
overall latency win: enriched layout remains, the main median is unchanged and
outlier maxima do not consistently improve. No percentage of elapsed time is
inferred from skipped writes. Three diagnostic captures, synthetic short labels,
tiny repeated icons, one headless desktop and uncontrolled background work limit
generalization. Native input-to-presentation, physical mobile, installed browsers,
GPU/display timing and the broader platform/performance gates remain outside this run.
