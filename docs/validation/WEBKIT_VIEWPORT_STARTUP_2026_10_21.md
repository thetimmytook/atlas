# WebKit viewport startup follow-up — 2026-10-21

**Delay cause unresolved; passive late delivery now confirmed in one reviewer run.**
Reviewer capture `atlas-platform-P3JWVo` records a zero camera at 1258 ms, then
native callbacks and a completed normal paint by 1883 ms without activation,
screenshot or size change. The user approved a separate harness change: the
existing viewport/SVG equality check now has an explicit **5000 ms functional
readiness budget**, with the predicate unchanged. This is not a startup speed
requirement or an Atlas/WebKit runtime correction. See the
[passive-recovery and budget follow-up](#passive-recovery-and-explicit-readiness-budget).

This follows the [merged diagnostic investigation](WEBKIT_INITIAL_VIEWPORT_2026_10_21.md)
and preserves its historical results. PR #49 is merged at
`6c2f2593734da09904cb2db9c2519c14057d3f82`, fetched from `origin/master` before this
work. The main checkout was clean; work uses `fix/webkit-viewport-startup`, without
a worktree. No staging, commit, push, PR or remote CI inspection was performed.

## Environment and fixed experiment

- macOS 26.6.2 (25G83), Darwin 25.6.0, arm64.
- Node **24.21.0**, npm **11.19.0**, verified before running. PATH starts with
  `/Users/i.levkovs/.local/share/fnm/node-versions/v24.21.0/installation/bin`.
  This is an experiment condition; no project Node version was pinned.
- Playwright **1.63.0**; Chromium **153.0.8010.12**, Firefox **155.0**, WebKit
  **26.6** (revision 2359), headless, viewport **1280×1000**, DPR **1**.
- `npm ci` completed; Husky prepare was rerun with permission to update the local
  Git hook configuration after the sandbox denied that part of installation.
- Every completed attempt runs the ordinary `npm run test:platform`: production
  build, Chromium → Firefox → WebKit, unchanged scenario order, one worker,
  **17 groups / 59 subcases per engine**. No parallel tests/builds or retries.
  All runs within each series have identical build and input identities and pass
  the harness integrity checks. Each run serves its own frozen production files.

The first series was fixed in advance at eight complete runs, alternating four
unwrapped and four existing diagnostic runs. Every attempt was retained. The
subsequent two series were each separately fixed at eight complete runs before
starting. They reduce instrumentation overhead to seek a failed startup state;
they are diagnostic experiments, not before/after runtime-fix evidence.

## Failure evidence

Reviewer evidence remains at
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-d4txrs` (failure)
and `atlas-platform-jV7vpJ` under the same parent (subsequent diagnostic pass).
The fresh baseline failure is `atlas-platform-T5YqOX` under that parent:

- First WebKit ENV-01 / Factory, loaded status, main SVG visible, host and SVG
  **800×480**, camera viewport **0×0** throughout the original readiness check.
- Host/SVG rect: x=25, y=570.4375, right=825, bottom=1050.4375. The browser viewport
  remains 1280×1000. Component connected; document complete/visible; no browser
  diagnostics. SVG has no `viewBox` and its scene remains unpainted.
- Chromium and Firefox pass 59/59. WebKit's other 16 groups pass; its three smoke
  subcases are not reached because initial readiness fails. WebKit totals 56/59.
- `results.json`, `webkit-1.zip`, `webkit-1.png`, manifest and all nine frozen
  production files are retained. The original one-second readiness budget and
  assertions were unchanged. The screenshot is captured after the failed state.
- All nine production-file hashes match the reviewer failure and diagnostic pass.

This unwrapped trace does not record whether the host observer delivered an
entry or whether the pending native frame executed. Camera 0×0 and absent viewBox
alone cannot distinguish those alternatives. It establishes a reproduced failure,
not a renderer defect, a Node defect, or a harness-readiness error.

## All completed attempts in the three bounded series

All `atlas-platform-*` directories in these tables are under
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/`.
`pass` means all three engines passed 59/59; the only failure is detailed above.

### Original runtime / alternating existing wrappers

Original production SHA-256:
`11a8453901ad8c8eaf7c98f6fc6b1b07cc23c7cbe2c5c0949a8497147b9f9eb7`.

| Attempt | Existing wrappers | Result             | Evidence directory      |
| ------- | ----------------- | ------------------ | ----------------------- |
| 1       | off               | WebKit ENV-01 fail | `atlas-platform-T5YqOX` |
| 2       | on                | pass               | `atlas-platform-O9K0Ye` |
| 3       | off               | pass               | `atlas-platform-bouqKW` |
| 4       | on                | pass               | `atlas-platform-2Lfz4w` |
| 5       | off               | pass               | `atlas-platform-2qkStf` |
| 6       | on                | pass               | `atlas-platform-8RjOt1` |
| 7       | off               | pass               | `atlas-platform-8JHNl1` |
| 8       | on                | pass               | `atlas-platform-jIDGSe` |

Full plan, timestamps, environment, results and per-command logs:
`/private/tmp/atlas-startup-before-Ijkhlb`.

### Native callback event records / no API wrappers

Temporary event-recording production SHA-256:
`c051c7858df92ca2a520f6dd674e7ee1fa79829ec8994d91e1c6fe6be09f46a1`.

| Attempt | Existing wrappers | Result | Evidence directory      |
| ------- | ----------------- | ------ | ----------------------- |
| 1       | off               | pass   | `atlas-platform-6I15Xj` |
| 2       | off               | pass   | `atlas-platform-Ht7mQ3` |
| 3       | off               | pass   | `atlas-platform-OJ19sT` |
| 4       | off               | pass   | `atlas-platform-Hf5t0P` |
| 5       | off               | pass   | `atlas-platform-jYlCes` |
| 6       | off               | pass   | `atlas-platform-2MEuPl` |
| 7       | off               | pass   | `atlas-platform-GPkeFj` |
| 8       | off               | pass   | `atlas-platform-XWuyU4` |

Full plan, timestamps, environment, results and per-command logs:
`/private/tmp/atlas-startup-native-state-d1O77X`.

### Native callback bit flags / no API wrappers

Temporary bit-recording production SHA-256:
`1bdc6c469221f14d7cfbf926e4fd509df9f6ea51f3b74ef42a582a474a5b6574`.

| Attempt | Existing wrappers | Result | Evidence directory      |
| ------- | ----------------- | ------ | ----------------------- |
| 1       | off               | pass   | `atlas-platform-LMdgXD` |
| 2       | off               | pass   | `atlas-platform-ZsAEIi` |
| 3       | off               | pass   | `atlas-platform-oGAeKN` |
| 4       | off               | pass   | `atlas-platform-YEsnl9` |
| 5       | off               | pass   | `atlas-platform-ojJb7i` |
| 6       | off               | pass   | `atlas-platform-2qgwDQ` |
| 7       | off               | pass   | `atlas-platform-IdGk7q` |
| 8       | off               | pass   | `atlas-platform-WyTMM2` |

Full plan, timestamps, environment, results and per-command logs:
`/private/tmp/atlas-startup-native-flags-valid-cc9cb1`.

The original runtime series has **1/4 unwrapped failures** and **0/4 wrapped
failures**. Three unwrapped successes show that wrappers are not necessary for a
pass. These samples do not establish that wrappers eliminate the race.

The event-recording series temporarily stored per-instance connection, observation,
entry sizes, camera resize completion, RAF request/execution and viewBox state.
It used the native browser APIs directly, without wrappers, callback layout reads,
console traffic or extra frames. All eight pass. For example, its first Factory
connects at 83 ms, requests/observes at 89 ms, renders at zero at 125 ms, receives
800×480 and resizes the camera at 126 ms, then renders the viewBox at 154–161 ms.
This is a successful chain only.

The next reduction uses one instance bit mask and the last immutable camera size,
with no timestamps, event arrays, DOM reads or added function calls in callbacks.
Bits record connect=1, observe=2, callback=4, camera call=8, camera return=16,
RAF request=32, RAF execution=64, render return=128, disconnect=256.
Every successful Factory snapshot has mask **255** and size **800×480**. All eight
pass. Even this instrumentation can affect timing and object shape; its successes
do not establish the missing step in the unwrapped failure.

One setup error is retained separately: the initial conversion to bit probes
aborted before writing, but the shell started the previous event-probe version.
That process group was explicitly stopped (SIGTERM, exit 143); its incomplete run
is excluded from completed-attempt counts. Metadata:
`/private/tmp/atlas-startup-native-flags-BL2e8k/ABORTED_SETUP.json`; partial capture:
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-cg7C6Q`.
It reached Chromium/Firefox passes and 14 WebKit groups before interruption.
The valid eight-run bit series above started only after verifying the conversion.

The temporary runtime probes and their test-only capture hooks were removed.
Their exact patches remain at `/private/tmp/atlas-startup-native-state.patch` and
`/private/tmp/atlas-startup-native-flags.patch`; the series runners remain at
`/private/tmp/atlas-startup-series.mjs` and
`/private/tmp/atlas-startup-state-series.mjs`. Their frozen builds and snapshots
remain available. No temporary runtime field or public diagnostic API remains.

## Retained change and regression status

The sole retained test-harness behavior change is preserving an opt-in WebKit
Factory snapshot **after the Factory assertions and before Buildings navigation**.
`webkit-1-factory-startup.json` retains that document's diagnostic timeline,
projection observations, camera size, host/SVG rects and viewBox. The final version
also retains native event identity evidence and connected/document state. Failed
Factory readiness still retains the current document's state in `results.json`
and its failure trace. Ordinary runs install no wrappers or snapshot callback.
No startup assertion, timeout or functional requirement changed.

There is **no confirmed fix mechanism and no new deterministic regression**.
The existing ordinary smoke test already fails on the reproduced condition.
An invented ResizeObserver/RAF mock order would not prove the observed cause,
so no such regression is claimed. The existing platform cases continue to cover:

- Nonzero Factory viewport agreement, actual SVG screen projection, public
  coordinate conversion/round trip and native objectclick with original
  object/layer/route references.
- Initial zero and display:none loads completing before size recovery.
- Show, disconnect/reconnect with a changed size, and subsequent zero/resize
  recovery, including center/zoom preservation and native identity.

`src/`, examples, packages, configs and the readiness helper match the fetched
baseline. No sleep, retry, artificial initial resize/scroll/fit, constant RAF loop,
dependency, public setting, disabled engine or weakened assertion was added.
There is no post-fix series: no fix was justified or applied. The successful
instrumented series must not be presented as post-fix validation.

## Required checks under Node 24

All six requested commands ran sequentially after removing the temporary probes:

| Command                 | Result                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run check`         | pass after correcting three lint errors in the snapshot addition; 0 errors, 73 existing advisory warnings |
| `npm test`              | 468 tests / 21 files pass                                                                                 |
| `npm run test:browser`  | 330 Chromium tests / 12 files pass                                                                        |
| `npm run build`         | pass; existing API Extractor TS 5.9.3 / project TS 6.0.3 advisory                                         |
| `npm run test:e2e`      | 23 tests / 2 files pass                                                                                   |
| `npm run test:platform` | 17 groups / 59 subcases pass in each of Chromium, Firefox and WebKit; integrity pass                      |

Logs and command outcomes are in `/private/tmp/atlas-startup-checks-80ZGWM`.
The initial failed `check.log` is retained; `check-corrected.log` records the
successful rerun after adding the callback return type and required blank line.
No functional source change followed the checks. The final ordinary platform
capture is `atlas-platform-Q7pQCw` under the evidence parent above.

One separately declared full diagnostic run validates the retained snapshot
change: `atlas-platform-d1tgqz`. All three engines pass 59/59 and integrity passes.
After that suite had navigated to Buildings, the saved Factory JSON was checked
for camera 800×480, host/SVG sizes, complete/visible/connected state, nonempty
viewBox, initial projection, host observer/camera/RAF events, one route-checkpoint
click with all original reference checks true, and trusted native pointer down/up.
Verifier: `/private/tmp/atlas-startup-final-verify.mjs`; results and output are
`final-verification.json` and `snapshot-verification.log` in the checks directory.
Both final captures have the original production identity
`11a8453901ad8c8eaf7c98f6fc6b1b07cc23c7cbe2c5c0949a8497147b9f9eb7`.

Thus there are **26 completed full platform runs** in this follow-up: 24 in the
bounded series and these two final checks, plus the explicitly interrupted setup
run. One completed run fails; all other completed runs pass. The last diagnostic
run finished at 15:09 Europe/Riga. Subsequent edits only record these results in
this report; its formatting and the final diff were checked separately. These
passing checks do not remove the reproduced intermittent failure.

## Remaining gap at the end of the initial investigation (historical)

A failing capture that identifies the stopped lifecycle/size/frame step is still
required before choosing a correction and demonstrating a regression that fails
before it. The present evidence cannot distinguish missing/delayed host delivery,
camera update, or frame execution in the failed attempt. It also does not establish
a causal difference between Node 20 and Node 24, so no Node 20 control was used.
No performance benchmark or remote CI inspection ran. Physical Safari/iPhone and
the other installed-browser/platform gaps in earlier reports remain open.

## Reviewer follow-up — missing browser callbacks

This evidence was supplied by the reviewer after the initial agent investigation;
it is not part of the agent's preceding 26 completed full runs. The review command
was `ATLAS_VIEWPORT_DIAGNOSTICS=1 npm run test:platform` under Node 24.21.0.
Log: `/private/tmp/atlas-startup-review-platform.log`. Capture:
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-2I6EXh`.
It contains `results.json`, `manifest.json`, `webkit-1.zip`, `webkit-1.png` and the
frozen production build. Chromium and Firefox pass; first WebKit Factory ENV-01 fails.

All nine production-file hashes and all input hashes exactly match successful
agent capture `atlas-platform-d1tgqz`. Node, Playwright/browser versions, OS,
architecture, viewport, DPR and headless parameters also match. Integrity passes.

The failing component is connected, the document complete/visible, host and main
SVG 800×480, camera 0×0, and browser errors empty. Timeline: define 197 ms;
connectedCallback 207 ms; span observe 211 ms; RAF request id=1 and host observe
216 ms; document complete 242 ms. Until the failed-state capture there are **no
entries for either observer, no raf.run and no camera.resize**. Its trace includes
the unchanged repeated readiness checks and only one screencast frame. The saved
state precedes the failure screenshot, but no state was read after that screenshot.

In the successful matched capture, RAF id=1 runs at 162 ms, both observers deliver
at 164 ms (host 800×480), camera.resize completes and requests RAF id=2; that frame
writes the viewBox at 198–204 ms. This comparison locates the observed stall before
callback execution, not inside camera.resize or rendering. Document visibility
alone does not establish an active rendering lifecycle or explain the stall.

Next experiments preserve the initial failed state without explicit new layout
reads, before screenshot or context closure. Separate failures receive one factor:
a bounded passive observation window, page activation, or screenshot. Later
recovery must not change the original assertion failure into a pass. Hypotheses,
plans and all outcomes are recorded below as they are run.

### Post-mortem method

`ATLAS_VIEWPORT_POSTMORTEM=passive|activate|screenshot` is opt-in, requires the
existing `ATLAS_VIEWPORT_DIAGNOSTICS=1`, and applies only to a failed first WebKit
Factory scenario. It does not change startup, assert again, or turn recovery into
success. The original error and failed result are retained.

Immediately in the failure catch, before the normal finish hook, it persists
`webkit-1-postmortem.json`: camera viewport, viewBox, connected/document/focus state,
performance time and the full existing diagnostic timeline. It uses no explicit
layout reads. The last SVG/camera size comparison is retained from the readiness
helper's **existing** getBoundingClientRect read when diagnostics are enabled;
there is no additional geometry read. The original predicate and budget are intact.
The initial snapshot is serialized to disk before the intervention.

| Mode       | One post-failure factor                                              | Expected discriminating observation                                                 |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| passive    | No page action during one fixed 2000 ms Node-side observation window | Already pending RAF/RO callbacks arrive late without activation or screenshot       |
| activate   | One page.bringToFront(), then the same observation window            | Pending callbacks execute after activation, unlike a comparable passive failure     |
| screenshot | One original-style full-page screenshot, then the same window        | Pending callbacks execute during/after the snapshot request, unlike passive failure |

This window is a diagnostic observation **after an irrevocably failed assertion**;
it is never a delay for passing readiness. It schedules no page timers, RAFs,
polling, resize, scroll or fit. Active modes retain an immediate after-action state;
all modes retain the state after observation. The ordinary failure screenshot is
suppressed for these post-mortem cases so that passive/activation experiments do
not receive an additional screenshot intervention. The original failed snapshot
survives even if the action or subsequent evidence collection fails. Trace closure
and the normal final geometry capture occur only after the post-mortem interval.
Existing trace snapshot instrumentation is still active throughout; the no-layout
claim concerns explicit reads in the added capture function, not browser internals.

Run one selected mode per reproduction, for example:

```sh
ATLAS_VIEWPORT_DIAGNOSTICS=1 ATLAS_VIEWPORT_POSTMORTEM=passive npm run test:platform
```

Five unit cases verify diagnostic integrity: passive recovery, separate activation
and screenshot recovery, a condition that has already recovered before capture,
and an intervention error. They verify serialization before action, one selected
factor, retained zero-state evidence and originalOutcome=fail after recovery.
These doubles test the diagnostic tool, **not the cause of the WebKit stall** and
not a regression proving an engine or harness correction.

### Installed Playwright and corresponding macOS source

Installed `node_modules/playwright-core/lib/coreBundle.js` was inspected:
WKBrowserContext.doCreateNewPage sends Playwright.createPage; the page's initial
session awaits Emulation.setActiveAndFocused(active=true) along with other setup;
newPage is reported after initialization. WKPage.bringToFront separately sends
Target.activate. Thus an automation visibility/focus override and native window
activation are distinct operations in this version.

The matching official [Playwright 1.63.0 WebKit patch](https://github.com/microsoft/playwright/blob/v1.63.0/browser_patches/webkit/patches/bootstrap.diff)
shows the override supplying visibility/focus activity flags, while macOS activation
orders the NSWindow front. The [macOS embedder AppDelegate](https://github.com/microsoft/playwright/blob/v1.63.0/browser_patches/webkit/embedder/Playwright/mac/AppDelegate.m)
creates an offscreen headless window with occlusion detection disabled. It also
contains a warning about creating the first headless NSWindow too early and delays
its optional startup window; the ordinary Playwright no-startup-window path skips
that optional window. These source observations motivate the activity/creation
hypothesis. They do not establish the native state of the reviewer's failed page.

Sources saved outside Git: `/private/tmp/atlas-webkit-bootstrap-1.63.diff`,
`/private/tmp/atlas-webkit-AppDelegate.m`,
`/private/tmp/atlas-webkit-BrowserWindowController.m`.

### Post-mortem experiments and outcomes

Each round was planned before starting, with hypothesis, factor and expected
observation recorded in round.json. All commands use Node 24.21.0, npm 11.19.0,
normal full engine/scenario order, headless 1280×1000, DPR 1 and the unchanged
production identity `11a8453901ad8c8eaf7c98f6fc6b1b07cc23c7cbe2c5c0949a8497147b9f9eb7`.
No runtime source change or automatic retry is involved. Every outcome is retained.

The first round chooses each post-mortem factor once. All three initial scenarios
pass, so **no post-mortem action executes** and none of the three recovery hypotheses
is tested on a stalled page.

| Mode       | Full-suite result | Evidence directory      |
| ---------- | ----------------- | ----------------------- |
| passive    | all engines 59/59 | `atlas-platform-HZu5bm` |
| activate   | all engines 59/59 | `atlas-platform-kO54nX` |
| screenshot | all engines 59/59 | `atlas-platform-2ttSgk` |

Plan/results/logs: `/private/tmp/atlas-postmortem-round-BVTs7l`.

The second round tests a specific consequence of the source hypothesis. For each
post-mortem factor, compare ordinary first-page setup with temporarily moving
newPage before tracing/init-script setup. Both variants install diagnostics before
Factory navigation. Expected: earlier first-window creation should expose more of
the same callback stalls if that startup race applies. Only driver-side elapsed
times from the completion of webkit.launch are added; they are not timestamps of
the native application's launch notification.

| Mode       | Page order        | Request newPage after browser ready (ms) | Full-suite result | Evidence directory      |
| ---------- | ----------------- | ---------------------------------------- | ----------------- | ----------------------- |
| passive    | ordinary          | 91.83                                    | all engines 59/59 | `atlas-platform-oSAllz` |
| passive    | page-before-trace | 82.45                                    | all engines 59/59 | `atlas-platform-CBqOcX` |
| activate   | ordinary          | 77.84                                    | all engines 59/59 | `atlas-platform-Tixois` |
| activate   | page-before-trace | 111.14                                   | all engines 59/59 | `atlas-platform-DguHH4` |
| screenshot | ordinary          | 83.61                                    | all engines 59/59 | `atlas-platform-asc8Eh` |
| screenshot | page-before-trace | 83.69                                    | all engines 59/59 | `atlas-platform-wYhi18` |

Plan/results/logs: `/private/tmp/atlas-postmortem-round-8Sr9vc`. The nine evidence
directories above use the same common temporary parent as earlier tables.
All build/input integrity checks pass. All six scenarios pass readiness, so again
there is no stalled page on which to evaluate the post-mortem interventions.
The order change did not yield supporting evidence; these timings do not prove or
rule out the native-window hypothesis. Successful repetitions cannot explain the
reviewer failure.

The temporary page-order variant was removed. Its patch is retained at
`/private/tmp/atlas-postmortem-creation-experiment.patch`; runner scripts are
`/private/tmp/atlas-postmortem-round.mjs` and
`/private/tmp/atlas-postmortem-creation-round.mjs`. The final harness preserves the
ordinary creation sequence; the temporary driver timing recorder was also removed.
Its measured values remain in the experiment captures. No pre-navigation activation or other
speculative correction is included.

### Status after the first reviewer follow-up (historical)

**Unresolved.** The reviewer capture establishes the absence of browser callback
execution before readiness failure, narrowing the previous uncertainty. No live
failed page has yet been captured in these post-mortem experiments. Passive late
delivery, activation recovery and screenshot-induced updates remain unmeasured on
a matching failure. Neither Node nor Playwright nor WebKit is assigned a causal
fault from the source inspection or successful repetitions alone.

No runtime/harness correction or causal regression is claimed. No post-fix series
exists because there is no confirmed fix. Zero/hidden load completion, recovery,
projection, coordinates and original native object identity retain their existing
requirements and tests.

Final validation under Node 24.21.0 ran sequentially after removing the temporary
creation-order/timing experiment:

| Command                                                          | Result                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run check`                                                  | pass; 0 errors, 73 pre-existing advisory warnings                        |
| `npm test`                                                       | 473 tests / 22 files pass, including the five diagnostic-integrity cases |
| `npm run test:browser`                                           | 330 Chromium tests / 12 files pass                                       |
| `npm run build`                                                  | pass; existing API Extractor TS 5.9.3 / project TS 6.0.3 advisory        |
| `npm run test:e2e`                                               | 23 tests / 2 files pass                                                  |
| `npm run test:platform` with diagnostics and passive post-mortem | all three engines pass 17 groups / 59 subcases; integrity pass           |

Logs and command outcomes: `/private/tmp/atlas-postmortem-checks-DArUQD`.
Runner: `/private/tmp/atlas-postmortem-checks.mjs`. Preliminary lint failures during
test-tool implementation are retained at `/private/tmp/atlas-postmortem-check-pre.log`
and `/private/tmp/atlas-postmortem-check-corrected.log`; the final check is clean
apart from existing warnings.

The final full capture is
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-cIZk2Q`.
Hypothesis for that run: if the unchanged stall recurs after removing the temporary
creation variant, already pending callbacks may recover during passive observation.
Factor: one passive 2000 ms post-failure window, with activation and screenshot
excluded. Expected: a failed before-state followed by either late native callbacks
or continued starvation. Actual: readiness passes, so the diagnostic window is
not entered and the hypothesis remains untested on a live failure. Its saved
Factory snapshot verifies the last readiness dimensions, SVG projection and native
identity evidence; production identity remains the original `11a845...f9eb7`.

There are **ten completed full platform runs in this reviewer follow-up** (the
three-mode round, six creation-order experiments and one final full check), all
passing, with no retries or parallel builds/tests. The reviewer failure is a
separate preceding run. These successes do not close it. Final checks finished at
16:00 Europe/Riga; subsequent changes only record results in this report and are
checked for formatting/diff integrity. No runtime/example/package/config change,
staging, commit, push, PR, performance benchmark or remote CI inspection occurred.

## Passive recovery and explicit readiness budget

This independent reviewer run follows the preceding agent experiments and is not
one of their successful repetitions. Evidence:
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-platform-P3JWVo`, including
`webkit-1-postmortem.json`, results, manifest, trace and frozen production files.
All nine production-file hashes and all input hashes match the last agent success,
`atlas-platform-cIZk2Q`; integrity passes. Environment matches: Node 24.21.0,
Playwright 1.63.0 / WebKit 26.6, macOS Darwin 25.6.0 arm64, headless 1280×1000,
DPR 1. Chromium/Firefox pass and the original WebKit smoke result stays fail.

| Time in the Factory document          | Observation                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1255 ms, last original readiness read | SVG 800×480, camera 0×0                                                                                        |
| 1258 ms, before passive observation   | Camera 0×0, no viewBox or executed RAF/RO callbacks; document complete/visible/focused and component connected |
| 1842 ms                               | First already requested RAF executes                                                                           |
| 1843–1844 ms                          | Both observers deliver; host entry is 800×480; camera.resize completes with viewport 800×480                   |
| 1877–1883 ms                          | Second RAF executes and finishes rendering with the Factory viewBox                                            |
| 3269 ms, after passive observation    | Camera 800×480 and viewBox present; originalOutcome remains fail                                               |

For **this run**, late native callback delivery followed by normal camera/render
updates is confirmed. The passive interval introduced no activation, screenshot,
resize or scroll; before/after evidence and the initial failure are preserved.
The cause of the delay and responsibility within Atlas, Playwright or WebKit
remain unknown. This observation does not establish that every historical failure
recovers, or that the delay has been corrected.

### Accepted test-budget change

The user confirmed that startup within one second is not a requirement and
explicitly requested 5000 ms for the existing viewport/SVG agreement poll in
`openExample()`. It previously inherited Vitest's one-second default. The sole
executable change for this step is the poll's `{ timeout: 5_000 }` option. The
predicate, loaded/visible waits, scenario order and all functional assertions are
unchanged. There is no fixed delay, extra attempt or forced page activation.

This is a **functional test readiness budget**, not a performance acceptance
threshold. The strict result still has to be observed within that budget. Atlas
runtime and load() are unchanged: a genuinely zero/hidden container can complete
loading and later recover through the existing observer/render path. Existing
projection, coordinate-conversion, original native identity, zero/hidden load and
reconnect/resize-recovery assertions remain in the full platform suite.
The approved budget change does not fix or explain the WebKit callback delay.

### Validation plan and results

Under Node 24.21.0 / npm 11.19.0, run `npm run check`, `npm test`, then exactly
three full `npm run test:platform` attempts, sequentially, without retries:

1. Diagnostics off; no post-mortem mode.
2. `ATLAS_VIEWPORT_DIAGNOSTICS=1 ATLAS_VIEWPORT_POSTMORTEM=passive`.
3. Diagnostics off; no post-mortem mode.

Every attempt is retained, including failures. The series is not extended to get
a pass. If an attempt fails, its saved state is investigated and the timeout is
not increased automatically. No diagnostic infrastructure is added in this step.
Evidence parent for logs, pre-edit snapshot, plan and all command outcomes:
`/private/tmp/atlas-readiness-budget-fw0X3L`.

| Check           | Result                                            |
| --------------- | ------------------------------------------------- |
| `npm run check` | pass; 0 errors, 73 pre-existing advisory warnings |
| `npm test`      | 473 tests / 22 files pass                         |

| Attempt | Diagnostics / post-mortem | Chromium | Firefox | WebKit | Evidence directory      |
| ------- | ------------------------- | -------- | ------- | ------ | ----------------------- |
| 1       | off                       | 59/59    | 59/59   | 59/59  | `atlas-platform-Gowe2m` |
| 2       | on / passive              | 59/59    | 59/59   | 59/59  | `atlas-platform-koqAS6` |
| 3       | off                       | 59/59    | 59/59   | 59/59  | `atlas-platform-U8Qa9B` |

All three captures retain their results, manifests and frozen builds under the
same `/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/` evidence parent.
Every engine completes 17 groups / 59 subcases. Build/input integrity passes for
all attempts; all three production and input identities match within the series.
Production remains the original SHA-256
`11a8453901ad8c8eaf7c98f6fc6b1b07cc23c7cbe2c5c0949a8497147b9f9eb7`.
Comparing current hashed platform inputs with independent capture P3JWVo identifies
only `tests/platform/browser.ts` as changed. Whitespace-normalized comparison with
the pre-step file confirms that the added timeout argument is the only executable
change in that file; the predicate is identical.

The diagnostic attempt passes readiness normally: its first RAF executes at
126 ms, camera viewport becomes 800×480 at 127 ms, and the viewBox render finishes
at 148 ms. The final size comparison at 159 ms agrees at 800×480. There is no
initial failure, so passive post-mortem is not entered. These new passes do not
reproduce the independent late-delivery run or demonstrate a WebKit correction.
No attempt fails, no failure-state investigation or timeout escalation is needed,
and the series stops at its planned three attempts.

`results.json` in the evidence/log directory above retains the predeclared plan,
Node/npm/environment parameters and every command outcome. Logs are `check.log`,
`node-tests.log`, `platform-1.log`, `platform-2.log`, `platform-3.log`; the exact
sequential runner is `run.mjs`. No runtime, load(), scenario order, diagnostic
infrastructure, dependency or package configuration changed in this step. The
5000 ms test readiness budget is implemented for review; the cause and ownership
of the underlying callback delay remain unresolved. No staging, commit, push,
PR, remote CI query or extra platform attempt was performed.

## PR preparation — 2026-10-22

The publication statements above describe the completed investigation stages.
PR preparation followed the user's subsequent publication request. A fresh Node
24.21.0 check passes (0 errors, 73 existing advisory warnings), and all 473 Node
tests in 22 files pass. Logs: `/private/tmp/atlas-pr-checks-rYypER`. The three-run
platform series above was not extended. Runtime remains unchanged and the callback
delay remains unresolved.
