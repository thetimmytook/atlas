# Portable cross-browser functional slice — 2026-10-20

All **50 named subcases in 15 groups pass in each of Chromium, Firefox and WebKit**
(150 subcase results; three sequential Vitest engine tests). No runtime
incompatibility was reproduced in this bounded slice. Full platform acceptance,
installed-browser/device support, keyboard/focus accessibility and the performance
gate remain open. Runtime, public signatures, dependencies, lockfile, CI and
historical benchmark artifacts are unchanged.

[Platform plan](PLATFORM_ACCEPTANCE_PLAN.md#portable-automated-engine-slice--2026-10-20) ·
[Structured results and hashes](cross-browser-2026-10-20-results.json) ·
[Run instructions](../TOOLING.md#opt-in-portable-engine-validation)

## Identified environment and build

- Main checkout, no worktree, branch `chore/cross-browser-validation`, clean before
  this task. Fetched integrated base `59fe8ff8e889e05e6c9cb1792d143ad9051d8f5a` (`59fe8ff`, PR #45),
  including polygon labels PR #43 and measurements PR #44. Initial local master was
  older; this branch was created directly from the fetched remote master. At capture
  time, no staging, commits, push, PR or remote CI polling had occurred.
- macOS **26.6.2**, Darwin **25.6.0**, **arm64**; Node **v20.19.6**,
  Playwright **1.63.0**. Existing locked tools installed via `npm ci`; Husky enabled.
  Chromium was present; Firefox/WebKit binaries installed with that locked CLI.
- All engines are **headless**, DPR **1**, initial viewport **1280 × 1000 CSS px**.
  Resize subcases additionally use **1000 × 900** and **390 × 844**. The shared
  second map is **360 × 240**. Final per-scenario viewport values are in raw results.
- Final run: **14:42:30–14:42:51 Europe/Riga**, 2026-10-20
  (completion `2026-10-20T11:42:51.471Z`). Default engine launch, no custom channel,
  throttling or performance workload. Native Playwright mouse/click/drag/wheel only.
- One production `build:example` immediately before the final engine run, using
  existing `example.config.mts`: ES2022, unminified, source maps. Factory and
  Buildings bundle the actual component. P is the test-local public setup in
  [fixture.ts](../../tests/platform/fixture.ts); no second source runtime is imported.
- **130 source/example/test/config/package inputs**, individual SHA-256 hashes,
  dirty status and tracked-diff digest are retained in structured results. Harness,
  configs and documentation were dirty; runtime/examples/lockfile/CI matched HEAD.
  Aggregate input identity: `4bda8d664f07157c1d31645d0e3e0b50b2c80dbbe2bb7be5e8804e9212882fc8`.
- **9 production files** copied once to an isolated temp directory, served with
  Vite static preview at `http://127.0.0.1:56808`. Every engine records the same
  build SHA-256: `6e433af1464b6e3cea24aebc637998a47dfacd1a6a59e3812bdac9a8d9ce58cb`.
  All input paths/hashes and original/frozen build paths/hashes matched after the run;
  integrity status is **pass**. Documentation/report updates after capture are not
  build inputs; the saved dirty snapshot represents capture time.

| Playwright engine | Actual browser version | Result | Groups | Subcases |
| ----------------- | ---------------------- | ------ | ------ | -------- |
| chromium          | 153.0.8010.12          | pass   | 15/15  | 50/50    |
| firefox           | 155.0                  | pass   | 15/15  | 50/50    |
| webkit            | 26.6                   | pass   | 15/15  | 50/50    |

These are Playwright-managed engines on one host. Chromium is not installed
Chrome/Edge; Firefox here is the Playwright binary; WebKit is not Safari or iPhone.
Compact desktop layout is not physical mobile acceptance. Mouse actions are not
native multitouch and give no keyboard accessibility pass.

## Subcase matrix

A pass below applies to the named subcase only, not the entire platform-plan card.
No final subcase failed or was blocked/skipped. Unexecuted broader checks and their
reasons are listed separately below and in structured results.

| Scenario / executed subcase                                                                      | Chromium | Firefox | WebKit |
| ------------------------------------------------------------------------------------------------ | -------- | ------- | ------ |
| ENV-01: Factory decoded background and viewport                                                  | pass     | pass    | pass   |
| ENV-01: Buildings decoded background and viewport                                                | pass     | pass    | pass   |
| ENV-02 / CAM-02: resize preserves camera                                                         | pass     | pass    | pass   |
| ENV-02 / CAM-02: zero viewport rejects conversion                                                | pass     | pass    | pass   |
| ENV-02 / CAM-02: recovery preserves camera and picking                                           | pass     | pass    | pass   |
| ENV-02 / CAM-02: compact Buildings layout                                                        | pass     | pass    | pass   |
| MOUSE-01/02: native drag changes camera without objectclick                                      | pass     | pass    | pass   |
| MOUSE-01/02: wheel changes zoom and preserves cursor anchor                                      | pass     | pass    | pass   |
| COORD-01: scroll recomputes client coordinates and identity                                      | pass     | pass    | pass   |
| COORD-01: layout shift recomputes coordinates                                                    | pass     | pass    | pass   |
| LAYER-01/02/03: independent floors and clipped polygon identity                                  | pass     | pass    | pass   |
| LAYER-01/02/03: owned point preserves route context                                              | pass     | pass    | pass   |
| LAYER-01/02/03: hidden layer is not pickable                                                     | pass     | pass    | pass   |
| MAT-02: SVG and PNG intrinsic decode and dimensions                                              | pass     | pass    | pass   |
| MAT-02: aspect ratio anchor and zoom independence                                                | pass     | pass    | pass   |
| MAT-02: rendered red green and transparency preserved                                            | pass     | pass    | pass   |
| MAT-02: transparent rectangle native picking                                                     | pass     | pass    | pass   |
| MAT-02: whole image replacement resumes inheritance                                              | pass     | pass    | pass   |
| MAT-01/03: whole value edit and leaf inheritance                                                 | pass     | pass    | pass   |
| MAT-01/03: invalid unused SVG preserves scene camera and references                              | pass     | pass    | pass   |
| MAT-01/03: invalid material assignment and label preserve state and events                       | pass     | pass    | pass   |
| MAT-01/03: native old label still picks after rejection                                          | pass     | pass    | pass   |
| LOAD-01 / MAT-03: native old label remains usable during pending load                            | pass     | pass    | pass   |
| LOAD-01 / MAT-03: failed request retains edited object scene and camera                          | pass     | pass    | pass   |
| LOAD-01 / MAT-03: native preserved label picks after failed request                              | pass     | pass    | pass   |
| LABEL-01/03: independent four-kind clipped attachments and one route label                       | pass     | pass    | pass   |
| LABEL-01/03: native label-only object layer route identity                                       | pass     | pass    | pass   |
| LABEL-01/03: direct membership priority                                                          | pass     | pass    | pass   |
| LABEL-01/03: polygon largest-cell fallback                                                       | pass     | pass    | pass   |
| LABEL-02/05: all nine origins                                                                    | pass     | pass    | pass   |
| LABEL-02/05: px rem root font and zoom                                                           | pass     | pass    | pass   |
| LABEL-02/05: container family and literal horizontal spaces                                      | pass     | pass    | pass   |
| LABEL-02/05: native leading-space halo and outside picking                                       | pass     | pass    | pass   |
| LABEL-03: later polygon covers earlier label                                                     | pass     | pass    | pass   |
| LABEL-03: removal exposes original label                                                         | pass     | pass    | pass   |
| LABEL-03: higher visible layer wins and hidden layer yields                                      | pass     | pass    | pass   |
| LABEL-03: label beyond intersection bounds is pickable                                           | pass     | pass    | pass   |
| LABEL-03: viewport clipped label does not pick outside                                           | pass     | pass    | pass   |
| LABEL-04: batch commits state and events while DOM is old                                        | pass     | pass    | pass   |
| LABEL-04: same native press picks new geometry text and material before RAF                      | pass     | pass    | pass   |
| LABEL-04: subsequent paint matches committed state                                               | pass     | pass    | pass   |
| EVENT-02 / LABEL-04: press capture suppression without underlying fallback                       | pass     | pass    | pass   |
| EVENT-02 / LABEL-04: release capture suppression without underlying fallback                     | pass     | pass    | pass   |
| EDIT-03 / LIFE-02 / LABEL-06: removed label stops picking                                        | pass     | pass    | pass   |
| EDIT-03 / LIFE-02 / LABEL-06: original edited instance reattaches without ghost label            | pass     | pass    | pass   |
| EDIT-03 / LIFE-02 / LABEL-06: disconnect edits and reconnect restore current typography identity | pass     | pass    | pass   |
| LABEL-06: empty second load clears direct IDs and attaches same instance                         | pass     | pass    | pass   |
| LABEL-06: shared edits retain independent material and typography                                | pass     | pass    | pass   |
| LABEL-06: disconnected consumer rejects assignment atomically                                    | pass     | pass    | pass   |
| LABEL-06: native picks in both maps after reconnect                                              | pass     | pass    | pass   |

## Assertions and diagnostic boundaries

Every scenario has a fresh browser context/page, with no dependency on preceding
scenario state. Test-local P replaces fresh Buildings data using public load and
mutation APIs. Clicks pass through the component using `page.mouse`; no dispatched
PointerEvent or synthetic objectclick is used. Native trust/type/ID and ordered
Atlas events are retained. Object/layer/route equality is evaluated inside the
browser against saved runtime references and returned as booleans. ID text and the
external details panel are not identity oracles. Event histories survive per-action
counter resets; both stale-capture modes and second-map events are saved separately.

Label-only targets record fill rectangle, viewport and an independent source-
geometry exclusion check: point distance >11px, segment distance >2px, or outside
the known rectangle polygon bounds. Analytic attachment oracles are explicit:
point (170,45), line midpoint (80,45), fragmented low route (90,130), high/direct
route (150,130), flat rectangle centroid (230,25), extruded rectangle centroid
(300,80), owned point (30,130), and U fallback (280/3,100/3). None calls a runtime
attachment/clipping helper to compute the expected answer. P's 30px offset is
applied after projection. Route label counts are checked per owner/layer.

Text layout compares fill-only `getBBox()` transformed by screen CTM. Firefox
includes stroke in its client rectangle; Chromium/Playwright bounding-box APIs
also differ at stroke edges. This is why generic client/bounding boxes were an
incorrect cross-engine oracle. The 3px white outline and native leading-space,
1px-halo and 3px-outside hits have their own assertions. Placement/origins/wheel
allow at most **0.5 CSS px**; coordinate click rounding allows **0.6 CSS px**;
icon dimensions/anchor comparisons allow **0.1 CSS px**. These are geometric
rounding tolerances, not performance or raster-equality gates. Observed state and
bounded polling drive completion; no arbitrary sleep is a success condition.

Both SVG and PNG switches wait for the **actually displayed resource MIME**, decode
its URL and check 40 × 20 intrinsic/final dimensions. Additional SVG 80 × 80
preserved-aspect declaration yields 80 × 40 with bottom-center anchor; zoom 1/2/4
preserves screen dimensions. Viewport screenshots sampled in memory prove red and
green interior pixels and background-through-transparency for **both fixture
formats**, despite the blue material color; sample coordinates/RGBA are saved.
This proves these known patches, not every source color or arbitrary icon fidelity.
Absence of an SVG fill attribute is not used as color evidence. Transparent image
rectangle picking and whole-image inheritance are checked separately.

The nested-batch probe runs in a synchronous native pointerdown capture listener.
It saves committed position/text/material and both immediate object change events,
while text/owner DOM are still old inside and immediately after batch. The component
then picks the new label during the same native press, before RAF. Later polling
checks painted output. This is not an asynchronous action inside a paused batch,
and does not claim a public picking query inside the active callback. Press/release
stale capture hides the original higher layer with an eligible object still below;
zero objectclicks prove suppression without picking underneath. Shared-map setup
clears every copied layer's direct IDs before empty load, then attaches the original
instance and membership; material rejection also preflights a disconnected consumer.

Unexpected console/page/resource errors: **zero** in all three engines. Expected
setter/load rejections are recorded separately: INVALID_IMAGE_RESOURCE,
INVALID_MATERIAL_PROPERTY, UNKNOWN_MATERIAL and INVALID_OBJECT_LABEL; the delayed
unused icon request rejects IMAGE_RESOURCE_LOAD_FAILED. Only its exact deliberate
URL is classified as expected. Chromium records ERR_FAILED resource + console,
Firefox NS_ERROR_FAILURE resource, and WebKit “Blocked by Web Inspector” resource.
Independent scenarios/engines continue after failures; a missing binary/launch
failure would be blocked and would make the command fail, rather than pass/skip.
All contexts/browsers/traces/preview are closed in finally paths.

## Regression results and retained evidence

Required commands ran sequentially, without a concurrent timing/profiling workload:

| Check                 | Actual result                                                              |
| --------------------- | -------------------------------------------------------------------------- |
| npm run check         | pass; zero errors, 63 advisory warnings (52 existing + 11 in test helpers) |
| npm test              | 468 tests / 21 files pass; platform set excluded                           |
| npm run test:browser  | 323 Chromium Browser Mode tests / 11 files pass                            |
| npm run build         | pass; existing API Extractor bundled TS 5.9.3/project TS 6.0.3 advisory    |
| npm run test:e2e      | 23 existing Chromium tests / 2 files pass, including CDP-specific input    |
| npm run test:platform | one example build; Chromium → Firefox → WebKit, 50/50 each; integrity pass |

No benchmark, zoom profile or remote CI run/status inspection was performed.
The focused zoom follow-up and historical benchmark data remain separate.

Raw final manifest, full events/assertions/observations/errors and frozen build:
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-qI7mF9` (`manifest.json`, `results.json`, `build/`).
The final run has no failure screenshot/trace because all scenarios pass; screenshot
pixel samples are retained as values. Failure capture was exercised during harness
development: `atlas-platform-76sOpJ` (initial WebKit viewport readiness) and
`atlas-platform-hjkcSh` (incorrect stroke/client-rectangle oracle), under the same
OS temp parent. Each contains the relevant screenshot/trace and observed values.
These were harness issues; the corrected final run preserves the original numeric
contract with the appropriate geometry oracle. No runtime correction was made.
The successful intermediate run `atlas-platform-kuCFnU` is also separate evidence.
Large outputs, screenshots and traces stay outside Git.

Regression logs are outside Git at `/private/tmp/atlas-platform-check-final.log`,
`atlas-platform-node-tests.log`, `atlas-platform-browser-tests.log`,
`atlas-platform-library-build.log`, `atlas-platform-e2e.log`, and
`atlas-platform-final.log` (all latter basenames under `/private/tmp/`).

## Remaining manual/device and broader checks

| Scope                                          | Status  | Exact reason / next evidence                                                                                                                                                                                            |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed browsers D1–D4                       | not run | Separate installed Chrome/Firefox/Safari on macOS and Edge on Windows samples; Playwright engines do not certify these.                                                                                                 |
| Physical M1/M2                                 | not run | Separate iPhone Safari and Android Chrome task; trusted HTTPS, secure context and crypto.randomUUID preflight required.                                                                                                 |
| TOUCH-01–04 / CANCEL-01/02 / LIFE-01           | not run | Native tap/pan/pinch/transition/consumption, OS cancellation/capture loss and disconnect during active input need physical/manual evidence. Existing Chromium CDP regressions remain separate.                          |
| Full ENV/CAM/COORD/EVENT/LAYER/EDIT/LOAD cards | not run | Only matrix subcases executed; initial zero-load/fit/reload, thresholds, surrounding-page gestures, clipping boundaries and full topology matrix are outside this bounded slice.                                        |
| Full MAT/LABEL cards                           | not run | Selector ordering, SVG sizing/stretch/fetch races, every owner/capture/pickability/default/empty/disconnected-region branch, font completion/stylesheet/CSSOM/media and per-map RAF scheduling remain broader coverage. |
| REP-01 / 3000 and 5000 roots                   | not run | This build includes production Factory/Buildings only. Representative benchmark remains its separately dated PR #44 evidence; not rerun here.                                                                           |
| A11Y-01 external UI                            | not run | Mouse interaction does not validate keyboard or assistive navigation; external controls still need manual focus/activation checks.                                                                                      |
| A11Y-02–04 map/object keyboard and focus       | blocked | Keyboard/focus/activation/event ownership contracts and implementation remain open.                                                                                                                                     |
| Zoom profiling / numeric performance gate      | not run | Separate profiling task; no timing benchmark or thresholds introduced. Gate also needs agreed numeric/device criteria.                                                                                                  |

Physical runs must record actual devices, OS/browser versions, viewport/DPR,
portrait/landscape, page/map scroll and browser-chrome behavior, trusted tap/drag/
pinch and interruptions, original references through remote inspection, and P
material/label visual/native-tap subcases. Minimum supported versions and device
samples remain decisions. A missing inspection path blocks only its dependent
subcase; it cannot become an identity pass from a screenshot.

## Reproduce and review

```sh
npm ci
npx --no-install playwright install chromium firefox webkit
npm run test:platform
```

Run from the repository with no competing build/input edits. On Linux install the
locked CLI's system dependencies where needed. The command prints its unique temp
evidence directory; inspect results per subcase and open retained failure traces
with `npx --no-install playwright show-trace /absolute/path/to/trace.zip`.

Reviewable parts are runner/config/isolation + smoke; test-local fixtures/scenarios
and diagnostics; this actual matrix/JSON and current documentation summaries.
The capture above was completed with unstaged changes and no commits, push or PR.
The user subsequently authorized commits and PR publication on 2026-10-20. Saved
capture metadata retains its original source commit and dirty input hashes.
