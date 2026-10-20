# Platforms, accessibility, and load

Browser/input targets below are accepted direction, not a validated support matrix.
[Current contract](CURRENT_CONTRACT.md) records available behavior with dated overlays.
Static review on 2026-10-20 checked `69c0006` (merged polygon labels, PR #43): batch,
material selection/inheritance/whole-value edits, SVG/PNG icons and runtime labels
for point/line/route/flat and extruded polygon are implemented. Browser layout and
rectangular picking share text metrics, preserved spaces and the white outline;
queries stay immediate while rendering can be deferred by batch.

Typography responds to supported root/probe/style/stylesheet/viewport/font/reconnect
notifications. For CSSOM/non-viewport-media changes with no supported notification
and unchanged probe dimensions, the next ordinary render or picking reads current
computed typography. Complete automatic CSSOM tracking is outside the accepted
prototype boundary; there is no public refresh API. See
[the agreed boundary](PROPERTIES_AND_LABELS.md#point-labels--implemented-for-review-2026-10-16).

The separate [2026-10-20 cross-browser functional report](../validation/CROSS_BROWSER_2026_10_20.md)
records the bounded automated engine slice against production F/B and disposable P,
using the existing Vitest/Playwright. Full platform scenarios, installed browser
samples, physical mobile validation and the performance gate remain outstanding.
The [materials/labels measurements](../performance/PROTOTYPE_MATERIAL_LABELS_2026_10_20.md)
are merged in PR #44, and the updated platform plan in PR #45 (`59fe8ff`). The older
[narrow recipe verification](../validation/PLATFORM_ACCEPTANCE_PLAN.md#narrow-recipe-verification--2026-10-20)
retains its original Chromium-only scope. Focused zoom profiling is separate work;
this functional run adds no benchmark or performance threshold.

[Main navigation](../DESIGN_MAIN.md)

## Accepted

- Modern Chrome, Firefox, Safari, Edge; Safari on iOS and Chrome on Android.
  Specific minimum versions have not been selected.
- Mouse and touch input; basic keyboard camera navigation.
- Interactive objects must support keyboard focus and activation;
  accessibility details are validated by the prototype.
- At the user's explicit request, keyboard handlers remain an open question:
  specific keys, registration/interception API, focus, and the division of
  responsibility between Atlas and the application are not yet approved.

<a id="platform-acceptance-plan--proposed-2026-10-09"></a>

## Platform acceptance plan — proposed 2026-10-09, updated 2026-10-20

The [platform acceptance plan](../validation/PLATFORM_ACCEPTANCE_PLAN.md) proposes
a compact first-wave matrix, reproducible scenarios, evidence protocol and open
decisions. It separates Node contracts, Chromium Browser Mode, built-example E2E,
Chromium-specific CDP input/media, other-browser work and physical-device checks.
MAT-01–03 and LABEL-01–06 add reproducible material/icon/four-kind label scenarios,
including placement/clipping, inheritance/whole-value edits, native label-only picking,
captured hits, font notifications and lifecycle/shared maps. Missing example switches
use temporary public-API console setup on Factory/Buildings. Readiness and execution
status are separate: the [portable slice](../validation/PLATFORM_ACCEPTANCE_PLAN.md#portable-automated-engine-slice--2026-10-20)
links executed subcases; full-card and physical-device results remain unrun. Reading
existing tests does not execute this plan. Playwright Chromium does not certify installed Chrome/Edge;
WebKit does not replace Safari/iPhone, and touch emulation is not physical multitouch.
Engine/application responsibilities and accessibility gaps remain explicit. It is
a plan, not a new run or support guarantee;
the representative benchmark and separate before/after comparison retain their own
performance scope and still need agreed gate criteria. The first wave can start on
available identified builds/browser/device samples without waiting for unrelated open
decisions; the PR #44 report is available as separate evidence. Missing devices/inspection and phone HTTPS/secure-context/
`crypto.randomUUID` prerequisites are recorded as blocked/not run with reasons.

Exact devices/versions/minimum support, keyboard/focus/accessibility contract,
application page/map scroll policy and numerical performance criteria remain open.
External HTML buttons do not prove keyboard accessibility of map objects. Functional
acceptance and performance gate remain separate; no numerical thresholds are added.
The [captured-build manifest](../performance/prototype-2026-10-20-material-labels-manifest.json)
identifies the benchmark artifact and inputs; each platform run still records its
own served build.

## Measuring the tarkov.dev reference

Checked on 2026-09-25. Source: https://json.tarkov.dev/regular/maps
Regular mode. The API path was established from source code:
https://github.com/the-hideout/tarkov-dev/blob/main/src/features/maps/do-fetch-maps.mjs
https://github.com/the-hideout/tarkov-dev/blob/main/src/modules/api-request.mjs

Counted array lengths: spawns, extracts, transits, locks, hazards, lootContainers, lootLoose, switches, stationaryWeapons, btrStops.
These are source-category records, not unique visible markers or DOM nodes.
Quest objectives, configuration labels, SVG backgrounds, user routes, and nested
geometry are excluded. Clipping and filters may reduce visible counts;
a single record may produce several visual elements.

| Map               | Records in selected categories |
| ----------------- | -----------------------------: |
| streets-of-tarkov |                           2800 |
| lighthouse        |                           1792 |
| reserve           |                           1677 |
| interchange       |                           1610 |
| shoreline         |                           1569 |

Agreed prototype reference: a baseline of about 3000 semantic objects, an additional
5000-object test with headroom, plus routes, labels, multiple layers, and a heavy
background. This is neither a product limit nor an SVG performance guarantee.
Update frequency, route lengths, target devices, FPS/loading time, and memory budget
are undefined; object count alone does not describe the entire workload.

## Identified clipping-model question

Source: https://github.com/the-hideout/tarkov-dev/blob/main/src/data/maps.json
Streets uses global height ranges for levels. Reserve defines several extents
with different height ranges and local building bounds for one displayed floor.
A single rectangular clip cannot directly reproduce such a combined floor.
Decision point: multiple layers under shared controls or a union of clipping regions.
The current model is not automatically extended; arbitrary clipping shapes remain deferred.

<a id="early-svg-benchmark--implemented-for-review-2026-10-06"></a>

## Early SVG benchmark — merged in PR #22; historical 2026-10-06 results

The [Atlas baseline](../performance/BASELINE.md) records deterministic 3000/5000-root
scenes, distinguishes semantic roots/owned points/visual primitives/DOM nodes, and
uses production browser timing separately from local instrumentation. It measures
the then-current flat scene and temporary symbols; its Factory background did
not cover the full heavy-background/layer/runtime-label gate. Actual phone performance remains
unmeasured; instructions for a physical-device run are included. The separately
requested [Leaflet SVG/Canvas comparison](../performance/LEAFLET_COMPARISON.md)
subsequently merged in PR #25 with its separately dated Atlas measurements, explicit metric
boundaries and weaker Canvas correctness coverage. No FPS budget or thresholds are added.

## Representative artifacts and next platform runs

The [2026-10-09 multi-building baseline](../performance/PROTOTYPE_BASELINE.md) and
[completed comparison](../performance/PROTOTYPE_COMPARISON.md) retain their own
clipping/topology/gesture scene, source/build hashes and limitations. Background text
in those artifacts is not runtime-label coverage; old root/DOM/test counts must not
be relabelled as current material/label results. The separate
[2026-10-20 report](../performance/PROTOTYPE_MATERIAL_LABELS_2026_10_20.md) records
control/materials-labels profiles at 3000/5000 roots, visual/native functional checks
and measured timing/work with their stated limits. It recommends proceeding with
functional platform runs and carries zoom scaling as a risk for focused profiling.
Its [manifest](../performance/prototype-2026-10-20-material-labels-manifest.json)
records source `69c0006`, exact input hashes and frozen build file hashes. This does
not complete the proposed platform matrix or establish numerical gate criteria.

Follow the [minimal first wave](../validation/PLATFORM_ACCEPTANCE_PLAN.md#execution-order-and-minimal-first-wave)
for available desktop F/B/P checks, physical iPhone/Android core and controlled
material/label subcases. Each result identifies build, actual OS/browser/device,
setup and evidence; unrun rows stay visible. An unavailable environment is a blocker
with a reason, not a new pass or a reason to postpone every available functional row.
