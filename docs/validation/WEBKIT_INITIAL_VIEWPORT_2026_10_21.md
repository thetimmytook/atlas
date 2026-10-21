# WebKit initial viewport investigation — 2026-10-21

**Unresolved.** The historical Factory stall is real, but none of the bounded
attempts below reproduced it. No runtime cause, runtime fix or harness readiness
correction is established. This change supplies diagnostics and missing functional
coverage for review; it is not a verified fix for the intermittent failure.

## Established observations and limits

The saved failed `atlas-platform-SuPtat` run has a loaded status, a visible main
SVG, camera viewport `0×0`, no SVG `viewBox` and unpainted object groups throughout
the original readiness wait. The screenshot shows an unfitted background inside
the Factory frame. The subsequent unchanged `atlas-platform-yfhnsV` passes.
Individual hashes of **all nine production files in both runs exactly match**
the production files tested here. These failures predate this investigation;
their traces did not instrument observer delivery or RAF execution, so they cannot
identify which step stopped. `atlas-platform-NY2Ppk` records the same final zero
viewport; earlier evidence remains in `atlas-platform-76sOpJ`.
The earlier cross-browser report's attribution to harness readiness is historical;
this investigation does not establish that attribution.

The current source path is:

1. Factory registers `MapElement`; upgrade creates its Shadow DOM/main SVG.
   Camera starts at `0×0`; CSS gives the SVG its container dimensions independently.
2. `connectedCallback` connects model/labels/controls, requests the existing RAF
   and observes the **host content box** with ResizeObserver.
3. A host entry calls `camera.resize`. Its synchronous change notification requests
   a coalesced RAF. The renderer reads the current viewport/bounds in that frame.
4. `load()` installs the prepared scene, requests fit/render and resolves. A fit
   at zero size remains pending. Loading does not wait for a nonzero viewport.

Successful instrumented runs show this path. For example, exact-harness process 1
in `atlas-platform-q1IwPT` upgrades at 20 ms, connects at 21 ms, runs the initial
zero-size frame at 114 ms, receives host `800×480` at 115 ms, updates the camera
and requests RAF, then writes `viewBox` in the 137–140 ms frame. Final host/SVG/
camera sizes are all `800×480`, document is complete/visible, errors are empty.
That explains a normal successful startup, not the historical stall.

The harness already waits for loaded status, visible SVG and camera/SVG size
agreement. That final wait is retained unchanged, with its original 1 s budget.
No failing instrumented timeline was obtained. Renderer fault, missing/delayed
ResizeObserver delivery, stalled rendering updates and harness sequencing remain
unproven alternatives. An explicit layout read before upgrade also failed to
reproduce the issue; initial inline layout is not an established cause.

## Bounded attempts and regression scope

Each batch was fixed at 20 attempts in advance: ten separate WebKit processes,
then ten fresh contexts/pages in one other process. Each group alternates five
unwrapped and five instrumented attempts. Every attempt is retained; no automatic
retries or first-success exit. All use the same frozen production Factory layout,
1280×1000 browser viewport, DPR 1 and Playwright tracing.

| Batch                                     | Fresh processes: failures / attempts | Fresh contexts: failures / attempts |
| ----------------------------------------- | ------------------------------------ | ----------------------------------- |
| Initial lightweight probe                 | 0 / 10                               | 0 / 10                              |
| Controlled layout before upgrade          | 0 / 10                               | 0 / 10                              |
| Exact platform helper before test changes | 0 / 10                               | 0 / 10                              |
| Same helper after test/diagnostic changes | 0 / 10                               | 0 / 10                              |

The last two batches also check native original-object identity. The final batch
additionally compares SVG screen projection with public map/client conversion.
Both retain the unchanged initial readiness helper. **Before/after refers to test
changes; runtime is identical.** Zero failures is not evidence of correction.

The ordinary platform suite adds nine subcases, now **17 groups / 59 subcases per
engine**: nonzero Factory projection/native identity, initial zero and initially
`display:none` loads, show recovery, disconnect/reconnect with a changed size, and
subsequent zero/resize recovery. Coordinate projection uses actual SVG screen CTM;
native mouse input must return the saved object/layer/route references. Recovery
preserves camera center/zoom. Only dedicated zero/hidden scenarios alter initial
markup; ordinary ENV-01 keeps the original production layout. Initial hidden/zero
loads must complete before they are shown, protecting the load contract.

Three preselected full-suite runs (diagnostics on/off/on for the first WebKit
scenario) all pass 59/59 in each engine with build/input integrity checks. An earlier
unchanged full suite passed its original 50/50 per engine. No timeouts, retries,
sleeps, initial resize/scroll/fit, dependencies, public API or CI changes were added.
The opt-in instrumentation records lifecycle, RO entries, camera resize and queued/
executed RAFs without extra callback layout reads, console traffic or extra frames.
It can still change timing; unwrapped passing attempts do not remove that limit.

## Environment, identity and evidence

Main checkout, clean at start; fetched `origin/master` at
`ca14d83c13923987356bafe7294f43abb7a0301e` (PR #48), branch
`fix/webkit-initial-viewport`, no worktree. Runtime/examples/configs/packages/CI
remain identical to that commit. At diagnostic capture time, no staging, commit,
push, PR or remote CI query had occurred.

macOS **26.6.2 (25G83)**, Darwin **25.6.0 arm64**, Node **20.19.6**, Playwright
**1.63.0**; headless WebKit **26.6**, revision **2359**. Full-suite engines also
include Chromium **153.0.8010.12** and Firefox **155.0**. `npm ci` completed.
Production build SHA-256 (the existing platform manifest convention):
`11a8453901ad8c8eaf7c98f6fc6b1b07cc23c7cbe2c5c0949a8497147b9f9eb7`.
Individual inputs, dirty snapshot and build hashes are retained per capture.
The first lightweight probe used a different file ordering for its aggregate;
its individual build-file hashes still match exactly.

Evidence parent for the following directories:
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/`.

| Evidence                              | Directory                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Initial 20 / layout-before-upgrade 20 | `atlas-initial-viewport-JXmn8M` / `atlas-initial-viewport-2O3v4V`           |
| Exact helper before / after           | `atlas-platform-q1IwPT` / `atlas-platform-JiZJ9p`                           |
| Original full-suite baseline          | `atlas-platform-mGniPg`                                                     |
| Three full suites, on/off/on          | `atlas-platform-znR3D2` / `atlas-platform-o6GA7S` / `atlas-platform-2JQZcM` |

Exact-helper captures contain per-attempt JSON/traces, `viewport-results.json`,
manifest and frozen build; full suites contain `results.json`. Full-suite optional
diagnostics retain the current document on failure; a successful Factory→Buildings
navigation ends with the Buildings timeline. Exact-helper attempts retain Factory
timelines separately. Initial lightweight scripts are preserved outside Git at
`/private/tmp/atlas-viewport-runner-v1.mjs` and
`/private/tmp/atlas-viewport-diagnostics-v1.mjs`; the first script supports
`--layout-before-upgrade`. Historical artifacts/reports were not rewritten.

All six required commands passed sequentially:

| Command                 | Result                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm run check`         | pass; 0 errors, 73 advisory warnings (71 existing + 2 diagnostic method-name warnings) |
| `npm test`              | 468 tests / 21 files                                                                   |
| `npm run test:browser`  | 330 Chromium tests / 12 files                                                          |
| `npm run build`         | pass; existing API Extractor TS 5.9.3 / project TS 6.0.3 advisory                      |
| `npm run test:e2e`      | 23 tests / 2 files                                                                     |
| `npm run test:platform` | Chromium/Firefox/WebKit: 17 groups / 59 subcases each; integrity pass, no retries      |

Final platform evidence is `atlas-platform-TI1Fr3` under the same evidence parent,
with the same production build identity. Logs are
`/private/tmp/atlas-viewport-final-{check,test,test-browser,build,test-e2e,test-platform}.log`.
The final batch completed at 12:57 Europe/Riga. Subsequent report formatting was
checked separately; no source/test changes followed these commands.

## Run and next evidence needed

```sh
npm run build:example
node tests/platform/initial-viewport.run.mjs
ATLAS_VIEWPORT_DIAGNOSTICS=1 npm run test:platform
```

The diagnostic entry uses the existing Vitest/platform helpers and a fixed matrix;
it is opt-in, outside normal test discovery. Large logs/traces remain outside Git
under the paths above and `/private/tmp/atlas-viewport-*.log`.
Closing the original issue requires a failing instrumented Factory timeline that
distinguishes RO delivery from camera update and RAF scheduling/execution, followed
by a correction tested against that condition. Passing repeats alone do not supply
this evidence. Physical Safari/iPhone, installed-browser and broader platform gaps
in the earlier cross-browser report remain unchanged. No performance benchmark ran.
