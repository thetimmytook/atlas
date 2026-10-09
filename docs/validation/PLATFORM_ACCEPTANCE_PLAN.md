# Platform acceptance plan for the current Atlas prototype

[Main navigation](../DESIGN_MAIN.md) · [Platform direction](../design/PLATFORMS_AND_PERFORMANCE.md) · [Current contract](../design/CURRENT_CONTRACT.md)

Prepared on 2026-10-09. This is a plan for review, not an acceptance report. No new
scenario has been executed or marked passed by this documentation task. Runtime,
tests, CI, dependencies and benchmark reports are outside its scope.

## Basis and limits

The draft was inspected against `bc874494e3c1d1030b03fb593b1ea25a16a6c8d3`
(`bc87449`, including polygon PR #30) and the then-current working tree. During PR
preparation, source/coverage status was reconciled with fetched merged `master`
`45ee8b3873a7f377d18c14395a4770c0a1868cc4`: the representative benchmark is merged in
[PR #32](https://github.com/thetimmytook/atlas/pull/32), bounded route-topology
invalidation in [PR #33](https://github.com/thetimmytook/atlas/pull/33), and the
second-pointer press correction and gesture tests in
[PR #34](https://github.com/thetimmytook/atlas/pull/34). This confirms integration,
not execution of this acceptance plan. The current-contract topic retains its
older `bc87449` baseline; these later merged corrections supersede its pending-fix
notes for this plan. Staged/local changes alone still do not establish merged
status. Identify the exact build again before running any scenario.

Accepted direction is desktop Chrome, Firefox, Safari and Edge, Safari on iOS,
Chrome on Android, mouse/touch, basic keyboard camera navigation, and focus and
activation of interactive objects. Minimum versions, devices, keyboard/focus
contracts and numerical performance limits are not approved. This plan neither
extends promised browser support nor certifies the full agreed prototype slice:
batch, materials and runtime labels remain unimplemented.

Normative expectations come from [Current contract](../design/CURRENT_CONTRACT.md),
[input and layer rules](../design/LAYERS_AND_INTERACTION.md), and the
[agreed scope and follow-up](../design/PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09).
Temporary symbols, the current five-CSS-pixel drag threshold and load snapshots
remain temporary contracts. Do not substitute future route-symbol defaults,
homeView, camera constraints, label/material APIs or a public cancel event.

## Proposed first-stage platform matrix

Every row is a proposal for agreement. Select available machines/phones first and
record their actual model, OS and browser version; no purchase or particular model
is required by this plan. “Current stable at run time” is a sampling proposal, not
a minimum supported version. Older-version coverage needs a later explicit choice.

| ID  | Proposed environment                                                                                            | Input and first-stage purpose                                         | Execution                                                          |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| C0  | Existing Playwright-managed desktop Chromium; recorded host OS and locked tool version                          | Automated SVG/component, built-example and merged gesture regressions | Existing suites, with the distinctions below                       |
| D1  | Available macOS machine, installed stable Chrome                                                                | Mouse pan/wheel, real browser loading/layout and external keyboard UI | Manual Factory/Buildings smoke; proposed portable automation later |
| D2  | Same macOS machine, installed stable Firefox                                                                    | Independent browser behavior for the same desktop smoke               | Manual first; proposed Firefox Browser Mode/portable E2E later     |
| D3  | Same macOS machine, installed Safari bundled with the selected macOS                                            | Actual Safari loading, SVG, input and focus behavior                  | Manual; proposed Playwright WebKit checks are additional evidence  |
| D4  | Available Windows machine, installed stable Edge                                                                | Windows/Edge mouse, wheel, layout and external keyboard UI            | Manual first; proposed installed-Edge automation later             |
| M1  | One available physical iPhone, Safari, selected iOS version                                                     | Native tap/pan/pinch, orientation, browser chrome, scroll interaction | Physical device, portrait and landscape                            |
| M2  | One available physical Android phone, Chrome, selected Android version; prefer a representative midrange device | Same mobile functional subset; different OS/input stack               | Physical device, portrait and landscape                            |

C0 is not installed Chrome/Edge certification. Playwright WebKit is not Safari on
an iPhone. Touch emulation and a 390-pixel viewport are not physical mobile
acceptance. The first wave samples each accepted browser family with two phones;
additional desktop OS combinations, tablets, older versions, higher/lower DPRs and
assistive-technology combinations are subsequent coverage proposals.

## Engine and application responsibilities

| Area                     | Atlas acceptance                                                                                        | Example/application acceptance                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Host and camera controls | Observe actual nonzero viewport size; fit, conversion, render and input work with it                    | Assign host dimensions; arrange external buttons and responsive layout                                                           |
| Object interaction       | Deliver original object, hit layer, optional owning route and coordinates with agreed click suppression | Render details; choose and store selection; choose popup behavior                                                                |
| Floors                   | Layer visibility, composition, clipping and picking stay consistent                                     | Select/toggle floors independently through external controls                                                                     |
| Scroll/layout            | Convert against the current surface rectangle; honor the present input behavior                         | Place the map in the page and choose the eventual page/map gesture policy                                                        |
| Accessibility            | Future object focus/activation and camera navigation require agreed contracts and implementation        | Accessible names, focus and activation for external UI; accessible details presentation and its future connection to map objects |

Escape/Back navigation, popup dismissal and selection clearing are application
choices. No scenario assigns them to Atlas. A details panel showing an old click
after a floor toggle is not by itself an engine failure: Atlas has no selection
state or panel-refresh contract.

## Existing coverage inventory

Coverage below means assertions found in source, not a new run. Historical counts
in [Tooling](../TOOLING.md#regression-tests) retain their dated scope: merged polygon
validation recorded 75 Chromium Browser Mode tests and one combined built-example
E2E test. Do not fold later suites into those historical counts.

| Reference used below                                                                                                                                                                                                                          | Actual coverage and limits                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **B-component** — [map-element.browser.test.ts](../../tests/browser/map-element.browser.test.ts)                                                                                                                                              | Merged real custom-element/Shadow DOM/RAF integration; native clicks, immediate picking, identity, stale hits, reconnect, zero-size recovery and real background decode/load failures (corrupt data URL/revoked Blob URL), preserving the previous scene. Not a complete native gesture suite.                                       |
| **B-SVG** — [svg-renderer.browser.test.ts](../../tests/browser/svg-renderer.browser.test.ts)                                                                                                                                                  | Merged decoded background/geometry output, surviving nodes, camera scale/resize, bounded mutations and reattachment. Renderer assertions alone do not verify application input.                                                                                                                                                      |
| **B-layers** — [layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [intersection.browser.test.ts](../../tests/browser/intersection.browser.test.ts), [polygon.browser.test.ts](../../tests/browser/polygon.browser.test.ts) | Merged composition/visibility, clipping, original identity, synchronous revalidation, detached edits and invalid-load preservation, including `BACKGROUND_LOAD_FAILED`.                                                                                                                                                              |
| **E-built** — [example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts)                                                                                                                                                                      | Merged production-built Factory/Buildings: loading, button zoom, checkpoint click/edit/height, visibility, independent floors, volume edits and a 390 × 844 viewport. Mouse actions; no physical touch or keyboard/assistive-technology validation.                                                                                  |
| **E-input** — [camera-input.e2e.test.ts](../../tests/e2e/camera-input.e2e.test.ts) and [source fixture](../../tests/e2e/fixtures/camera-input.ts)                                                                                             | Merged in PR #34. Trusted Chromium mouse and CDP touch input: click modes, threshold/pan/wheel anchor, tap/pinch/two-to-one transition, consumption, cancellation, lost capture, reconnect, trigger changes and moved-hit revalidation. Uses a Vite source fixture, not the built example. CDP touch injection is Chromium-specific. |
| **B-topology** — [route-topology.browser.test.ts](../../tests/browser/route-topology.browser.test.ts)                                                                                                                                         | Merged in PR #33. Add/insert/remove/replace, surviving identities/nodes, affected updates and synchronous/disconnected picking.                                                                                                                                                                                                      |
| **N-contract** — [map-element.test.ts](../../tests/map-element.test.ts), [camera.test.ts](../../tests/camera.test.ts)                                                                                                                         | Node contracts with browser stand-ins; preparation failure/atomic replacement, immutable snapshots, lifecycle and camera fit/resize. Does not validate native browser resource/input behavior.                                                                                                                                       |
| **R-bench** — [representative scene](../../examples/prototype-bench.scene.ts), [functional checks](../../examples/prototype-bench.check.ts), [harness](../../examples/prototype-bench.ts)                                                     | Merged in PR #32; deterministic 3000/5000 roots, four buildings/three floors, routes, flat/extruded polygons and generated background. Analytic geometry/picking checks are separate from timing/instrumentation.                                                                                                                    |

[Browser Mode config](../../vitest.browser.config.mts) selects only headless Chromium
at 900 × 700. [E2E config](../../vitest.e2e.config.mts) discovers both merged E2E files; each explicitly launches Chromium. Changing a Browser Mode instance
would not port CDP gesture tests or the built-example launcher to Firefox/WebKit.
Additional portable browser tests are proposed work, with no config/test changes
in this task. Actual desktop Safari and physical phones still require their rows.

### Coverage matrix by scenario group

“Existing” below refers to source assertions/historical coverage, never a pass of
this plan. “Planned” means not run. Per-scenario cards define the narrower subcases
and readiness; a partial cell cannot certify the whole row.

| Scenario group          | Merged C0 assertions                                                        | Additional C0 coverage planned                | Proposed D1–D4                                          | Physical M1/M2                                                      |
| ----------------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| ENV-01/02, CAM-01/02    | B-component/B-SVG/B-layers/E-built, partial                                 | Native initial-collapse setup                 | Planned load/fit/resize; extra zero-size setup          | Planned load/fit/rotation; zero-size later                          |
| COORD-01/02             | No dedicated scroll/layout assertions                                       | Portable scroll/layout checks                 | Planned current coordinates/scroll behavior             | Planned real page/map gestures                                      |
| MOUSE-01/02             | E-input pan/wheel                                                           | Held-pointer wheel subcase                    | Planned real mouse/wheel                                | Not a phone touch substitute; separate input scope                  |
| TOUCH-01–04             | E-input, Chromium touch emulation                                           | Return-to-origin touch subcase                | Only on selected touch hardware, if added               | Planned taps/pan/pinch/consumption with merged fix                  |
| EVENT-01/02             | B-component/B-layers/E-input, partial                                       | Propagation/manual subcases                   | Planned click modes/stale-hit subcases                  | Touch delivery via TOUCH-01/03/04; controlled revalidation later    |
| CANCEL-01/02            | E-input cancel/lost capture                                                 | No additional C0 suite proposed               | Planned controlled capture/cancel where available       | Native cancellation attempt; capture-loss expansion later           |
| LIFE-01/02              | B-component/B-layers/E-input/B-topology                                     | No additional C0 suite proposed               | Planned controlled detach/reconnect                     | Remote-controlled active gesture where possible; edits later        |
| LAYER-01–03, EDIT-01–03 | B-layers/B-component/B-SVG/E-built/B-topology, partial                      | Specific membership subcases                  | Planned floors/picks/edits; full matrix expansion later | Planned floors/geometry buttons/picks; strict identity needs probes |
| LOAD-01                 | Invalid-definition and real image decode/load failures preserving old scene | Controlled request delay                      | Planned other browsers and controlled request delay     | Remote-assisted expansion later                                     |
| REP-01                  | R-bench, separate merged functional harness                                 | Identified-build acceptance run               | Planned identified-build check, D1 first                | Fixed viewport unsuitable; use F/B functional subset                |
| A11Y-01                 | Markup/native semantics, no acceptance assertions                           | External UI keyboard/assistive checks         | Planned external UI keyboard/assistive check            | Planned external UI assistive check                                 |
| A11Y-02–04              | No object/camera keyboard implementation                                    | Decision required, then implementation/checks | Decision required, then implementation/checks           | Decision required, then implementation/checks                       |

## Reusable setup and evidence

Use the existing examples and fixtures; no new test stand is needed. All console
operations below are temporary inspection/setup steps using current APIs, not new
public contracts or requested repository code. Reload between scenarios unless a
sequence explicitly retains state.

| Scene                  | Repeatable starting state                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F — Factory**        | [examples/index.html](../../examples/index.html), served as `/examples/`. Reload; wait for `Factory ground floor loaded.`, enabled controls, decoded background and visible SVG. Both content layers visible; `clickTrigger = 'release'`; use **Fit map**. Root `demo-route` has checkpoint `route-checkpoint` at `(60,90,5)` and endpoints `(85,70,1)`, `(30,110,1)`.            |
| **B — Buildings**      | [buildings.html](../../examples/buildings.html) / [buildings.ts](../../examples/buildings.ts), served as `/examples/buildings.html`. Reload; wait for `Buildings loaded. Zone: base 1, height 4.`. Both selectors Ground; **Fit map**. Shared zone spans both buildings; `journey` owns `a-stairs` at `(110,165,4)`.                                                              |
| **I — input fixture**  | [camera-input.html](../../tests/e2e/fixtures/camera-input.html), served by Vite at that path. Surface 640 × 480; camera center `(320,240)`, zoom 1; `target` at `(440,240,0)` in `content`. Empty point `(200,240)`. `window.cameraInput` already records clicks, surface events and native inputs. Not a responsive mobile page.                                                 |
| **R — representative** | `/examples/prototype-bench.html` from the identified benchmark build. No manual Preview/floor UI exists. Use its existing `window.prototypeBench.check()` for the 3000/5000 functional sequence, or `nativeSetup()` / `nativeAnchor()` / `nativeAssert()` / `nativeCleanup()` for the native smoke described in REP-01. Fixed 960 × 640 map viewport; not a phone layout fixture. |

For built examples, follow [Tooling](../TOOLING.md#ci-and-built-example-smoke-test)
and the [example build config](../../example.config.mts). A production preview of
`dist/example` contains F/B, not I. Record production versus source-fixture mode.
For physical devices use the same identified static build on a device-reachable
**HTTPS origin with a certificate trusted by the phone**, such as an existing HTTPS
preview or an already configured local HTTPS endpoint. A reachable HTTP LAN address
is insufficient; loopback on the computer is not a phone URL.

Before running scenarios on each phone, verify in the target page:

- `window.isSecureContext === true`;
- `typeof crypto.randomUUID === 'function'`.

[createId](../../src/objects/create-id.ts) uses `crypto.randomUUID()`, which requires
a secure context. Record the origin and both preflight results as evidence. If either
check fails, record an **environment blocker** and leave scenarios **not run** until
the prerequisite is met. Do not treat this as a failed map scenario or add a runtime
fallback. Record resource failures too. Runtime, dependencies, CI and server
configuration are unchanged by this documentation task.

For manual F/B inspection, obtain the host as
`document.querySelector('atlas-map')` or `document.querySelector('atlas-buildings')`.
Call it `map` in the steps below; `surface` means `map.shadowRoot.querySelector('svg')`.
Read `map.camera.center`, `zoom`, `viewport`, SVG `viewBox`, and surface
`getBoundingClientRect()` before/after each operation. Use
`map.coordinates.mapToClient({ x, y })` to locate a map point in **viewport CSS
pixels**, never multiply by DPR or add page scroll. Perform a real click/tap there.
Scroll the target into view first, then compute coordinates again. For mouse
coordinates use the current surface rectangle, including page offsets/borders.

Before identity/event scenarios, retain references to the relevant root, owned
points, `map.layers`, individual layers and `map.definition`. Attach temporary
listeners for `press`, `release`, `objectclick` and, for cancellation, native
`pointerdown`, `pointercancel`, `lostpointercapture`. Record event order, coordinates,
`isClick`, pointer ID/type/trust, and booleans comparing event object/layer/route
with saved references. Save plain values at event time: a later console expansion
of a live object is not evidence of its earlier state. Reload removes the probes.
Do not synthesize `objectclick` to prove picking.

For inspection mutations while a pointer is held, arm a timed or one-shot native
input listener before starting, or use remote inspection/automation. Do not release
the pointer just to reach DevTools: that would test a different sequence.

Evidence codes used by every scenario:

- **V**: before/after screenshots or device video showing target, controls and result.
- **S**: saved camera/viewport/rectangle/viewBox, layer visibility and relevant SVG
  attributes or node-reference comparisons. Compare numerical geometry, allowing
  a stated rounding tolerance; cross-browser pixel/font equality is not required.
- **E**: saved native and Atlas event sequence and counts with coordinate/identity
  comparisons. Screenshots or matching IDs alone do not prove reference identity.
- **L**: test name/log/trace and resource/console errors, including expected rejected
  load errors separately from unexpected failures. Capture successful assertions
  too; failure-only diagnostics are not a complete acceptance record.

Automated checks assert state before RAF where specified, then await rendered DOM.
For manual checks wait for observed viewport/render changes; fixed sleeps are not
the pass condition. Physical multi-touch cases require video plus browser event/state
capture where available. If capture needed to prove a claim is unavailable, record
that part as blocked; visual inspection alone cannot certify event counts/identity.

## Scenario readiness

Each scenario has exactly one readiness status, separate from its execution result:

| Readiness                                          | Meaning                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Check now** — можно проверить сейчас             | Current behavior/APIs permit a run. Missing automation or device evidence is recorded as coverage debt, not an assumed pass.                                           |
| **Implementation required** — требуется реализация | An accepted expectation is missing/defective in the merged baseline. Local candidate code can be checked, but is not a merged completion.                              |
| **Decision required** — требуется решение          | An expectation depends on an unresolved contract. Exploratory observations are possible; acceptance remains blocked until agreement and, where needed, implementation. |

All new execution results start as **not run**. Use **blocked** only for a recorded
missing prerequisite; use **fail** when an executable agreed expectation is violated.

## Scenarios: loading, viewport and coordinates

### ENV-01 — registration, dimensions, load and background

- **Platform/method:** C0 automated; D1–D4 manual; M1/M2 physical. F, then B.
- **Start/actions:** Fresh page, F/B setup. Check the example's custom-element name
  is registered once and the host/surface dimensions are positive. Wait for loaded
  status, inspect SVG image/objects, click the Factory checkpoint or Buildings
  zone `(60,90)`. Reload once to repeat initialization.
- **Expected:** Correct background and geometry appear after successful load;
  nonzero viewport matches host content size; picking returns the scene's object
  and runtime layer. No unexpected resource/decode, registration or console error.
  Host sizing and loaded-status UI are application responsibilities.
- **Evidence:** V/S/E/L, including image URL/dimensions and loaded status.
- **Readiness/coverage:** **Check now**. B-component/B-SVG and E-built cover the
  Chromium portions. Other browsers and physical initialization are unvalidated.

### ENV-02 — zero-size host and recovery

- **Platform/method:** C0 automated; D1–D4 DevTools-assisted F; M1/M2 later with remote inspection.
- **Start/actions:** F loaded; save frame sizing, camera and identities. Set
  `.map-frame` width/height/min-width/min-height to `0px`; await zero viewport.
  Attempt coordinate conversion. Restore saved sizing; await nonzero viewport;
  click the checkpoint. Separately load F with the frame collapsed, then restore
  it without changing center/zoom between load and recovery.
- **Expected:** At zero size conversion rejects with `VIEWPORT_UNAVAILABLE`; no
  pickable visible surface. Existing center/zoom survive collapse/recovery; current
  geometry returns. On initial zero-size load, deferred fit applies at the first
  nonzero size, provided no explicit camera setter cancelled it. These are separate cases.
- **Evidence:** V/S/E/L; saved sizing, zero/nonzero viewports, error code and camera values.
- **Readiness/coverage:** **Check now**. B-component covers collapse/recovery;
  N-contract covers deferred fit. Native initial-collapse coverage is proposed.

### CAM-01 — explicit fit and its background extent

- **Platform/method:** C0 automated; D1–D4 manual; M1/M2 physical F/B.
- **Start/actions:** F loaded; pan/zoom, then **Fit map**. Hide F's background layer
  through its `visible` property and fit again. In a separate disposable load of
  `{ layers: [] }`, save camera and call `map.fit()`. Reload B, move camera, then
  **Fit map**.
- **Expected:** F fits `(0,0,130.81831,141.23242)` even when its background is hidden;
  center is the extent midpoint, zoom is `min(viewport width/extent width, viewport
height/extent height)`. Without backgrounds fit is a no-op. B's application
  button explicitly fits `(0,0,360,200)`. No homeView/constraint expectation.
- **Evidence:** V/S/L with extent, camera and visibility values for each case.
- **Readiness/coverage:** **Check now**. B-layers/N-contract cover fit semantics;
  E-built checks button zoom, not this complete fit sequence. Manual/mobile gap.

### CAM-02 — resize and physical orientation

- **Platform/method:** C0 automated resize; D1–D4 manual F/B; M1/M2 physical rotation.
- **Start/actions:** F/B loaded; pan/zoom away from fit and save camera. Resize F's
  frame from its corner, then resize browser wide → narrow → wide. For B use
  390 × 844 as one desktop layout sample. On phones rotate portrait → landscape →
  portrait with all pointers up; click/tap a known point after each change.
- **Expected:** Resize updates viewport and rendering while preserving center/zoom;
  it does not auto-fit. Coordinate picking remains aligned. B controls/map/details
  fit page width; F's wrapped controls/panel remain reachable. A chosen offscreen
  object need not be recentered; use explicit Fit before its next pick if needed.
- **Evidence:** V/S/E, real orientation/viewport/DPR and camera before/after.
- **Readiness/coverage:** **Check now**. B-component/B-SVG and E-built cover desktop
  resize/narrow B layout only. Physical orientation and browser chrome are gaps.

### COORD-01 — scrolling and layout changes do not stale coordinates

- **Platform/method:** D1–D4 DevTools-assisted F/B; proposed portable browser automation;
  M1/M2 physical with remote inspection.
- **Start/actions:** F loaded; bring map into view and save checkpoint conversion.
  Scroll page by 120 CSS px (record actual scroll delta; reverse if constrained),
  keeping target visible. Recompute conversion and click/tap checkpoint. Change
  page width so controls/panel wrap and repeat. Move the map frame in document
  flow by temporarily adding 80px top margin; repeat conversion, pick and anchored
  wheel (desktop) or pinch (phone). Restore layout before next scenario.
- **Expected:** Event `clientPoint` uses current viewport CSS coordinates, not page
  coordinates; converting it back matches event `mapPoint` and the known target.
  `mapToClient`/`clientToMap` round trip stays aligned after each change. Desktop
  wheel keeps its map anchor. Current conversion reads the live surface rectangle;
  no persistent cached offset is assumed. CSS rotation/skew is outside this case.
- **Evidence:** V/S/E with old/new rectangle, scroll offsets, client/map pairs and round trips.
- **Readiness/coverage:** **Check now**. No explicit scroll/layout regression found
  in existing browser/E2E tests; add portable automation later. Do not infer several
  forced layouts from several rectangle reads or claim performance from this case.

### COORD-02 — current page-scroll and map-gesture interaction

- **Platform/method:** D1–D4 mouse/wheel F; M1/M2 physical F/B.
- **Start/actions:** Map visible on a vertically scrollable page; record scroll and
  camera. Wheel vertically over map, then over surrounding text. On phones drag
  within empty map space, then start a separate drag on surrounding page content.
  Do not start over an object in press mode; use default release mode.
- **Expected:** Present implementation uses `touch-action: none` on SVG and prevents
  handled wheel default: wheel over map zooms, touch pan moves camera, and these
  handled gestures do not scroll the page. Starting on ordinary page content uses
  native scrolling without moving the map camera. Record platform exceptions.
- **Evidence:** V/S/E with start target, actual scroll delta and camera delta.
- **Readiness/coverage:** **Check now**, for current behavior only. No dedicated
  page-scroll assertion exists. Whether the application should instead allow
  one-finger scrolling, require a modifier/two fingers, or handle cross-boundary
  gestures differently is **DEC-03**, not an additional pass expectation here.

## Scenarios: mouse, touch and event rules

### MOUSE-01 — pan threshold and drag-click suppression

- **Platform/method:** C0 E-input; D1–D4 manual I or F.
- **Start/actions:** I, release mode. Down on target; move `(3,4)` CSS px, then past
  threshold to `(80,30)` from origin. Return to origin and release. Click target
  once in a fresh gesture. F alternative: repeat on its checkpoint, saving zoom.
- **Expected:** Movement of exactly 5 CSS px does not pan. Beyond threshold the
  scene follows pointer; at I zoom 1, `(80,30)` moves center to `(240,210)`.
  Returning does not restore click eligibility: release has `isClick: false`,
  no object click. The next click works once. F deltas scale by `1/zoom`.
- **Evidence:** V/S/E/L, target movement, center and complete event counts.
- **Readiness/coverage:** **Check now**. Merged E-input asserts this with trusted
  Chromium input; the desktop browser/device wave remains not run.

### MOUSE-02 — wheel zoom anchored at cursor

- **Platform/method:** C0 E-input; D1–D4 mouse wheel/manual I or F.
- **Start/actions:** I initial view; place cursor at surface `(160,120)`, save its
  map coordinate, wheel vertically `-240` in pixel mode, then reverse. For manual
  hardware record actual wheel deltas/mode rather than assuming a fixed notch.
  Repeat once while a release-mode pointer candidate is held.
- **Expected:** Zoom changes; the saved map anchor remains under the stationary
  cursor. I's injected `-240` yields `zoom = exp(0.48)` and center
  `(160 + 160/zoom, 120 + 120/zoom)`. Wheel cancels pending release-click eligibility;
  subsequent up creates no object click. Do not assert a hardware notch size.
- **Evidence:** V/S/E/L, wheel mode/deltas and anchor before/after.
- **Readiness/coverage:** **Check now**. Anchor is asserted in E-input;
  held-pointer cancellation and hardware differences need explicit additional checks.

### TOUCH-01 — single tap in both trigger modes

- **Platform/method:** C0 CDP/I E-input; M1/M2 physical F.
- **Start/actions:** Fresh scene per mode. In release mode tap target/checkpoint
  without moving. Repeat in press mode using F's **Object click on** selector.
- **Expected:** Release mode clicks once on eligible up; press mode clicks once
  immediately on down and never again on up. Both produce surface press/release;
  consumed press-mode release has `isClick: false`. Camera stays unchanged; event
  identifies original point, hit layer and route where applicable.
- **Evidence:** V/S/E/L, timing/order/count, identity and native touch input.
- **Readiness/coverage:** **Check now**. E-input has emulated touch assertions;
  physical phones have no acceptance evidence in this plan.

### TOUCH-02 — one-finger pan and click suppression

- **Platform/method:** C0 CDP/I E-input; M1/M2 physical F/B.
- **Start/actions:** Both trigger modes, fresh scene each. Start on empty map space
  (I `(200,240)`; F `(10,10)`), drag `(+60,+30)` CSS px and release. Repeat returning
  to origin after crossing threshold. Perform a new ordinary tap afterwards.
- **Expected:** Camera pans by `(-60/zoom,-30/zoom)` once dragging begins; no object
  click from drag or return-to-origin, releases are ineligible. Fresh tap works.
  Press-mode empty space permits pan. Page does not scroll for the handled map drag.
- **Evidence:** V/S/E/L, zoom-scaled deltas and release/click counts.
- **Readiness/coverage:** **Check now**. Basic pan is in E-input; return-to-origin
  physical touch and page scrolling need explicit records.

### TOUCH-03 — empty first pointer, object second, pinch and two-to-one transition

- **Platform/method:** C0 CDP/I E-input; M1/M2 physical F, both trigger modes.
- **Start/actions:** I: first down at `(200,240)`, second down at target `(440,240)`.
  Move first by `(-40,+30)` and second by `(+80,+30)`; lift second. Move remaining
  first by `(+30,+15)` from its latest location, then lift. F: first on `(10,10)`,
  second on checkpoint; spread/translate, lift second and continue pan.
- **Expected:** Both accepted downs may produce surface press; the second must
  not produce `objectclick` or consume the empty-start gesture. Pinch/translation
  work. I zoom becomes 1.5, center `(320-20/1.5,240-30/1.5)`; lifting alone causes
  no jump, remaining motion changes center by `(-20,-10)`. Both ups have
  `isClick: false`; no click from pinch or transition. Physical motions use recorded
  positions to check the same anchor/delta relationship.
- **Evidence:** V/S/E/L, all pointers' positions/order, camera and event counts.
- **Readiness/coverage:** **Check now**. The second-pointer press correction and
  E-input coverage are merged in PR #34. Both trigger modes are executable;
  additional browsers and physical validation remain outstanding.

### TOUCH-04 — first object press consumes the entire gesture

- **Platform/method:** C0 CDP/I E-input; M1/M2 physical F; desktop wheel subcase D1–D4/I.
- **Start/actions:** Press mode; first down on target/checkpoint. Drag it; add second
  pointer on empty space, spread and translate both. In I inject wheel while held.
  Lift first pointer, move remaining pointer, then lift it. Start a fresh empty-space pan.
  On D1–D4 without touch hardware, cover the mouse-down/drag/wheel/up consumption
  subcase; the two-pointer sequence stays in C0/M1/M2 coverage.
- **Expected:** Exactly the first object click; pan/pinch/wheel remain suppressed
  until **all tracked pointers** end. Removing only the first does not unconsume
  the gesture. Ups are not second object clicks. A new empty-start gesture pans.
  A phone without a wheel does not cover the desktop wheel subcase.
- **Evidence:** V/S/E/L, unchanged camera through each phase and recovery afterwards.
- **Readiness/coverage:** **Check now**; this consumption rule is already accepted,
  and merged E-input asserts it alongside the second-pointer correction. Physical
  consumption and recovery remain unvalidated.

### EVENT-01 — mouse click modes, surface events and single delivery

- **Platform/method:** C0 E-input/B-component; D1–D4 manual F.
- **Start/actions:** Fresh F for release and press modes. Down checkpoint, pause,
  up without moving; then click empty `(10,10)`. Record the event sequence on host
  and a containing DOM listener, distinguishing propagation from a second dispatch.
- **Expected:** Release mode object delivery follows eligible release; press mode
  follows press, consumes gesture and never clicks again on release. Empty click
  has surface events and no object event. Events bubble/cross Shadow DOM; one
  bubbling event observed twice is not two `objectclick` dispatches. Trigger is a
  JS property controlled by the example selector, not an observed HTML attribute.
- **Evidence:** E/L plus V of external details; include same-event comparisons.
- **Readiness/coverage:** **Check now**. E-input covers single delivery/modes;
  B-component covers original hit identity. Propagation/manual browser checks remain.

### EVENT-02 — stale captured hit and trigger changes

- **Platform/method:** C0 existing B-component/B-layers/E-input; D1–D4 DevTools-assisted F.
- **Start/actions:** Per mode and fresh load, install a one-shot listener for that
  surface event which hides hit layer `second`; click the overlapping markers at
  `(85,70)` to expose a real underlying replacement candidate. Separately use
  a one-shot listener to move checkpoint away, remove its root or detach the host.
  Reload; hold a release candidate, switch trigger release → press → release,
  then up. Repeat a press handler switching press → release → press.
- **Expected:** Surface event occurs, captured hit is revalidated and suppressed
  if no longer eligible; no second hit selects an underlying replacement. Trigger
  changes cancel the pending candidate, including a round trip. The next fresh
  click after restoring scene/mode works once.
- **Evidence:** E/S/L, mutations in event order and original candidate references.
- **Readiness/coverage:** **Check now**. Merged stale-hit tests cover removal/
  visibility; same-handler press-trigger revalidation and E-input coverage are
  merged in PR #34. Additional browser/manual subcases still need records.

## Scenarios: cancellation and lifecycle

### CANCEL-01 — pointercancel is not release; next gesture recovers

- **Platform/method:** C0 CDP/I E-input; physical M1/M2 exploratory cancellation F.
- **Start/actions:** Both modes, fresh scene. Down on object; deliver native touch
  cancellation via the existing CDP `touchCancel` path. On a phone, while touching
  map, try OS app switch/notification interruption and return; record the actual
  native event. Then start a new object tap and an empty-space pan.
- **Expected:** If `pointercancel` occurred, it adds no normal `release` or release
  click. A press click already delivered is not undone. New tap/pan work; state is
  not stuck. Do not expect or invent a new public Atlas cancel notification.
- **Evidence:** E/S/L and device V; native cancellation type/trust and absence of release.
- **Readiness/coverage:** **Check now**. E-input asserts native Chromium cleanup.
  An OS interruption without observed `pointercancel` does not cover this branch;
  record physical cancellation subcase blocked if it cannot be induced/captured.

### CANCEL-02 — lost pointer capture is not release

- **Platform/method:** C0 E-input; proposed portable browser automation/D1–D4 DevTools I.
- **Start/actions:** Both modes. Mouse down target, move 1 CSS px to activate capture,
  then `surface.releasePointerCapture(recordedPointerId)` from temporary inspection.
  Move 20px, wait for native `lostpointercapture`, up, then click target afresh.
  For manual input, arm release on the first held-pointer movement before pressing;
  ignore hover moves. Do not replace native loss with a dispatched synthetic event.
- **Expected:** Lost capture produces no normal release/click and clears that
  pointer. Camera is not dragged afterwards by its moves; next click works once.
  Already emitted press click remains. Normal implicit lost capture after handled
  up must not create an extra release either.
- **Evidence:** E/S/L, actual lost-capture delivery and new-gesture counts.
- **Readiness/coverage:** **Check now**. E-input covers forced native loss;
  other engines and physical touch loss need additional evidence. Do not infer
  loss from pointer leaving the surface: capture can legitimately continue outside it.

### LIFE-01 — detach/reconnect discards an active gesture

- **Platform/method:** C0 E-input/B-component; D1–D4 DevTools F; M1/M2 later with remote setup.
- **Start/actions:** Save host parent and next sibling. For each trigger mode, down
  checkpoint, remove host and reinsert the **same instance** at its original place,
  then up. Click checkpoint and pan from empty space in new gestures. Repeat detach/
  reconnect three times without re-registering the element or calling load.
- **Expected:** Pending gesture is discarded; old up has no normal release/new click.
  New input works once per gesture; subscriptions do not multiply. Map/runtime
  instances remain; disconnect is not a successful map replacement.
- **Evidence:** V/S/E/L, saved identities and counts across cycles.
- **Readiness/coverage:** **Check now**. B-component covers lifecycle/edits and
  merged E-input adds active-gesture checks. Physical cycles are a gap.

### LIFE-02 — detached edits resume at current state

- **Platform/method:** C0 B-component/B-layers/B-topology; D1–D4 DevTools F.
- **Start/actions:** Save route, endpoint and layers; detach host. Move checkpoint
  to `(45,90,5)`; replace route interior with a new point at `(50,95,5)`. Hide layer
  `second`, reinsert same host, then show it. Click current interior point/path.
- **Expected:** Reconnect renders current membership/positions/visibility once;
  no obsolete interior remains pickable. Root route, untouched endpoints and
  layers retain reference identity; replacement point is a new instance. Detached
  edits do not mutate the original `map.definition` load snapshot.
- **Evidence:** V/S/E/L, before/after identity and snapshot comparisons.
- **Readiness/coverage:** **Check now**. Merged reconnect and disconnected-picking
  assertions exist; merged B-topology supplements affected-topology coverage.

## Scenarios: floors, clipping and runtime identity

### LAYER-01 — independent floor selection belongs to application controls

- **Platform/method:** C0 E-built/B-layers; D1–D4 manual; M1/M2 physical B.
- **Start/actions:** B default Ground/Ground; save camera and layers. Pick zone
  `(60,90)` → `a-0`. Select A First, leave B Ground; pick same zone → `a-1` and B
  zone `(300,90)` → `b-0`. Select B First; return A Ground and pick both again.
- **Expected:** Only chosen building's floor visibility changes; other building
  and courtyard remain independently displayed/pickable. Hit layers match selector
  state; zone events carry the same original `shared-zone`. Camera unchanged.
- **Evidence:** V/S/E/L, both selectors/visibility and original object/layer comparisons.
- **Readiness/coverage:** **Check now**. E-built covers independent floors and zone
  edits; full device and original-reference records still need runs.

### LAYER-02 — clipping, boundaries and source identity

- **Platform/method:** C0 B-layers/R-bench; D1–D4 manual B; M1/M2 physical B core subset.
- **Start/actions:** B Ground/Ground. Pick zone inside A `(60,90)`, courtyard
  `(180,90)` and B `(300,90)`; pick concave gap `(180,130)`. Select A First and pick
  `a-stairs` `(110,165)` and route path `(140,165)`. Change zone height 4 → 1,
  restore 4, then Raise zone base 1 → 3; inspect visible slices and pick eligibility.
  Run existing B-layers boundary assertions separately for min/max cap tangents,
  vertical transitions, positive-area contact and direct-content priority.
- **Expected:** Fill/hit share clipped geometry: original zone in `a-0`, `courtyard`,
  `b-0`, no zone in the gap; upper path returns `journey`, vertex returns its original
  point with owning route. Height 1 at base 1 removes upper zone; base 3 removes
  lower zone. No cut points/IDs appear or mutate source geometry. Half-open bounds
  and finite stroke picking follow the current contract; an excluded centerline
  endpoint is not a blanket ban on nearby stroke hits. Direct roots stay whole.
- **Evidence:** V/S/E/L, source arrays/coordinates/IDs and boundary assertion logs.
- **Readiness/coverage:** **Check now**. B-layers has detailed boundary coverage;
  E-built has part of the Buildings sequence. Phone visual/tap checks cannot replace
  analytic tangent assertions; R-bench supplies separate functional-harness evidence.

### LAYER-03 — hide/show and top composed picking

- **Platform/method:** C0 B-layers/E-built; D1–D4 manual; M1/M2 physical F.
- **Start/actions:** F fresh; click overlapping `(85,70)` with second visible, then
  **Toggle second layer**, click same position, show second and repeat. Hide/show
  first too. Save camera, relevant SVG nodes and runtime layers before toggling.
- **Expected:** First hit is `demo-marker-2` in `second`; hiding second reveals
  `route-start` in `first`, with owning `route` equal to the original `demo-route`.
  The `demo-marker-2` hit has no owning route; showing second restores that hit.
  `demo-marker-1` is at `(40,45)`, not this position. Hidden content does not
  intercept picks; background remains visible in its own layer. Camera, object/
  layer/route identity and surviving nodes remain. Layer composition, not inferred
  pointer z, chooses the winner.
- **Evidence:** V/S/E/L, per-toggle event identity, visibility and camera.
- **Readiness/coverage:** **Check now**. B-layers tests composition/top picking and
  E-built tests checkpoint floor toggles; this overlap sequence needs manual records.

### EDIT-01 — geometry edits preserve object, layer and route identity

- **Platform/method:** C0 B-component/B-layers/E-built; D1–D4 manual F/B; M1/M2 physical buttons/picks.
- **Start/actions:** F fresh; save root route/checkpoint/line/layers and definition.
  **Move route point**, click checkpoint `(45,90)`; **Change route height**, click it
  in `first` at z 1. **Move line end** and click the independent line at `(49,54)`
  in `first` (after its end changes from `(85,70,8)` to `(85,90,8)`).
  Separately B fresh: **Move zone corner**, **Change zone height**, **Raise zone**,
  picking each currently visible slice.
- **Expected:** Edits update rendering and picking; event references are saved
  instances, checkpoint retains owning route, hit layer reflects current floor.
  No source root/layer replacement occurs. Setting a point position with omitted
  z resets it to 0; example edits explicitly retain z unless changing height.
  Polygon contours are x/y snapshots, not owned point objects; definition stays
  the original immutable load snapshot. Surviving SVG nodes are retained.
- **Evidence:** V/S/E/L, strict reference comparisons, snapshot and actual edited coordinates.
- **Readiness/coverage:** **Check now**. Existing browser tests include immediate
  picking before RAF; E-built covers selected buttons. Manual/mobile full sequence is a gap.

### EDIT-02 — route topology and surviving endpoints

- **Platform/method:** C0 B-SVG/B-component/B-topology; D1–D4 DevTools-assisted F.
- **Start/actions:** F fresh per operation; retain route and original points.
  **Add route point**; separately **Insert route point** then **Remove inserted point**;
  separately **Replace route interior**. Pick new vertices and surviving endpoints;
  inspect current point order, clipped paths and unrelated scene nodes.
- **Expected:** Route and untouched point instances/IDs survive. Inserted/replacement
  definitions create new points; removed points no longer participate. Range
  replacement keeps endpoints; old frozen arrays retain old membership. Immediate
  picking reflects current topology and rendered output follows; unrelated
  objects/layers do not change. Bounded invalidation has merged B-topology assertions.
- **Evidence:** V/S/E/L, old/current arrays, point-reference/order and node comparisons.
- **Readiness/coverage:** **Check now**. Functional route-edit coverage and
  B-topology's bounded-work assertions are merged, including PR #33. Their
  presence does not establish a new acceptance run or accepted performance limits.

### EDIT-03 — root removal/reattachment and layer references

- **Platform/method:** C0 B-component/B-layers; D1–D4 DevTools-assisted F; M1/M2 physical UI subset.
- **Start/actions:** F fresh; **Add point**, save its runtime instance/ID. **Remove added
  point**, **Move added point** while detached, **Restore added point**; pick current
  position. Save layer/root/definition references throughout. Then run two separate
  membership subcases. **A — automatic fallback:** Remove this point's ID from
  `first.objectIds`; verify `has(id) === false`, inspect display and pick its current
  position. Add the ID again and repeat the pick. **B — direct-only appearance:** Add
  a new root through `map.objects.add({ kind: 'point', position: { x: 20, y: 20, z: 9 } })`,
  retain it, and explicitly add its ID to `first.objectIds`. Pick `(20,20)`; remove
  its ID, inspect display/picking, then readd the ID and pick again.
- **Expected:** Root removal removes display/picking; detached instance remains
  usable. Restore attaches that exact instance at current position. **A:** Add point
  starts at z 0, and Move added point retains z. Removing direct membership leaves
  it visible/pickable in `first` through automatic bounds z `[0,3)`; it is absent
  from the direct-only `first.objects` array. Readding the ID does not duplicate its
  appearance. **B:** z 9 is outside both automatic layers (`first` `[0,3)`, `second`
  `[3,6)`), so removing the ID removes this point's appearance/hit; readding restores
  it. In **both membership subcases**, the exact root remains in `map.objects`
  throughout. Other roots/layers retain identity; definition snapshot stays unchanged.
  Duplicate IDs retain all-matching-layer/first-root-lookup semantics, not uniqueness.
- **Evidence:** V/S/E/L, saved instance equality, direct ID/array membership,
  automatic display/picking, root membership and current position for A/B separately.
- **Readiness/coverage:** **Check now**. B-layers covers membership/duplicate references
  and B-component covers reattachment; these specific fallback/direct-only subcases
  need explicit records. Physical UI subset alone does not prove strict identity.

### LOAD-01 — failed-load preservation

- **Platform/method:** C0 B-component/B-layers/N-contract; D1–D4 DevTools F; M1/M2 later remote-assisted.
- **Start/actions:** F loaded, pan/zoom and save roots/layers/definition/camera/nodes.
  Attempt `map.load({ layers: [{ intersectionBounds: { min: { z: 3 }, max: { z: 3 } } }] })`;
  catch rejection. Separately attempt a layer with background source
  `data:image/png;base64,AAAA`, size `{ width: 10, height: 10 }`; catch rejection.
  In a third subcase create a Blob URL, revoke it before using it as the candidate
  background source, and catch the load rejection. After each failure click/move
  the old checkpoint. For controlled in-flight preservation,
  disable cache and delay a fresh background request in browser network tools
  (use the current background URL with a unique query parameter in a copied candidate
  definition); interact with the old scene before releasing the failed request.
- **Expected:** Invalid bounds reject `INVALID_INTERSECTION_BOUNDS`; the corrupt
  data URL and revoked Blob URL reject `BACKGROUND_LOAD_FAILED`. Old map remains
  active during preparation and after failure; camera, collection/layers/snapshot and original objects remain,
  old picking/edits still work. No successful-fit or scene replacement occurs.
  Catch expected errors; an example status message alone does not prove preservation.
- **Evidence:** V/S/E/L, error/cause context, before/after references, camera and old hit.
- **Readiness/coverage:** **Check now**. B-component already exercises real Chromium
  decode/load failures with a corrupt data URL and revoked Blob URL, retaining the
  previous scene/nodes, objects, definition, camera/viewport and subsequent picking.
  B-layers also asserts `BACKGROUND_LOAD_FAILED` with previous layers/scene/camera/
  clicks preserved; browser tests cover invalid bounds/polygons. N-contract adds
  mocked preparation failure. Remaining gaps are additional browsers/devices and
  a deliberately delayed request with old-scene interaction while pending.
  Unavailable network controls block only that delay subcase; real image-error
  coverage already exists in Chromium. This plan adds no new run result.

### REP-01 — representative functional smoke, separate from timing

- **Platform/method:** C0/D1 identified build with R-bench; proposed D2–D4 later.
- **Start/actions:** After measurement task releases the build/session, open R
  and save `window.prototypeBench.build`. Run `await window.prototypeBench.check()`
  once; retain returned composition/hashes/check results. Separately call
  `nativeSetup()`, real-click the returned client point, then
  `nativeAssert('probe-route', 'b0-f0')`. Call `nativeEdit()`, click returned point,
  `nativeAssert('probe-route', 'b0-f0')`; call `await nativeFloor()`, click returned
  point, `nativeAssert('probe-route', 'b0-f1')`; finally `nativeCleanup()`.
- **Expected:** Functional checks validate both root counts, analytic clipped
  geometry, independent floors, source identity and runtime edits. Native picks
  follow edited route/floor. No timing, FPS, memory or physical-mobile conclusion.
  Background text inside the generated SVG image is not runtime-label coverage.
- **Evidence:** V/E/L, returned JSON, build/source/scene/background hashes and input method.
- **Readiness/coverage:** **Check now** against the identified R-bench harness,
  merged in PR #32. Historical evidence is in the separate representative report;
  no new run here. Fixed viewport and runner-oriented UI are unsuitable for phone
  layout acceptance; use F/B there.

## Scenarios: keyboard and accessibility

Current source has no camera keyboard handlers, object focus model, object names
or keyboard activation. [SVG object groups](../../src/renderers/svg/svg-renderer.utils.ts)
are `aria-hidden="true"` and have no focus targets. F has a named region, native
buttons, labelled selector and status/details HTML; B has labelled floor selects
and buttons but no equivalent named map region/details relationship. These are
application markup facts, not verified screen-reader usability. No dedicated
keyboard/accessibility assertions were found in browser/E2E tests.

### A11Y-01 — external UI keyboard access and focus

- **Platform/method:** D1–D4 manual keyboard F/B; M1/M2 physical external UI with
  native assistive technology; desktop screen reader sample after DEC-01 selection.
- **Start/actions:** Fresh F/B; Tab/Shift+Tab through external links, enabled buttons
  and selectors; on phones traverse those controls with native assistive navigation.
  Activate using their native platform conventions. Operate zoom/
  camera buttons in F and independent floors in B. Inspect visible focus, names,
  toggle state and disabled controls. Read status/details with the selected assistive
  technology after a pointer pick; leave the controls in both directions.
- **Expected:** External UI is reachable, named and operable with visible focus,
  disabled controls are correctly unavailable, and focus can leave without a trap.
  Layout does not hide focused controls. Check actual details/status announcement
  rather than infer it from `role="status"`. Passing proves only the example UI;
  tabbing past a nonfocusable map does not pass object/camera keyboard acceptance.
- **Evidence:** V/L, focus-order/accessible-name notes and assistive-technology version.
- **Readiness/coverage:** **Check now**. Native semantics exist; no automated or
  recorded manual acceptance here. Any discovered application UI defect is a finding.

### A11Y-02 — future map focus entry/exit, visible focus and no trap

- **Platform/method:** Future D1–D4 keyboard and agreed screen-reader combination;
  M1/M2 assistive navigation after DEC-01/DEC-02 and implementation.
- **Start/actions:** F/B with agreed focus behavior installed. Follow the agreed
  entry action from preceding external control; navigate camera/object focus as
  specified; exit forwards/backwards to adjacent external UI. Hide focused layer,
  remove focused object, then detach/reconnect and repeat.
- **Expected:** Stable, visible focus indication and an exit route with no trap;
  focus changes for hide/remove/detach follow the agreed rule. Concrete entry/exit
  keys, focus order, roving/list model and hidden-object handling remain unset.
- **Evidence:** V/E/L, active-focus transitions and screen-reader announcements.
- **Readiness/coverage:** **Decision required** (DEC-02), then implementation.
  Current nonfocusable/aria-hidden objects cannot satisfy this requirement.

### A11Y-03 — future keyboard camera navigation and event ownership

- **Platform/method:** Future D1–D4 keyboard F/B after DEC-02 and implementation.
- **Start/actions:** Focus the agreed camera target; execute the agreed pan/zoom/fit
  commands. Repeat while an external input/select is focused and when focus is
  outside the map. Check page scroll/default actions for handled and unhandled input.
- **Expected:** Camera changes follow agreed commands; event interception is
  limited to the agreed focus/context, and external typing/navigation remains
  usable. Specific keys, increments, repeat behavior, modifiers, handler registration
  and default prevention have no approved expectation yet. External arrow buttons
  exercise public camera setters, not built-in keyboard navigation.
- **Evidence:** V/S/E/L, focused target, key/default-action observations and camera.
- **Readiness/coverage:** **Decision required** (DEC-02), then implementation; no current handler coverage.

### A11Y-04 — future object identification, activation and accessible details

- **Platform/method:** Future D1–D4 keyboard/screen reader and M1/M2 native assistive
  technology after DEC-02 and implementation; reuse F/B objects.
- **Start/actions:** Navigate to a point, route path/owned point and polygon by the
  agreed model; read their accessible name/type/context. Activate each using agreed
  actions. Switch floor, edit/remove the object, and inspect the accessible state
  and relationship to the external details panel.
- **Expected:** Eligible interactive objects can be identified and activated;
  original identity/hit-layer or equivalent agreed activation context is preserved.
  Names and external details are programmatically connected by the agreed engine/
  application contract. Selection/popups and Escape/Back remain application-owned.
  No new keyboard event API, role, label field or activation key is approved here.
- **Evidence:** V/E/L, accessibility-tree/name/relationship capture and announcements.
- **Readiness/coverage:** **Decision required** (DEC-02), then implementation.
  Container ARIA and accessible external buttons cannot fill this coverage gap.

## Functional acceptance and performance gate

Functional platform acceptance records whether agreed behavior works for a named
build/environment/scenario. Performance acceptance separately requires agreed
workload, devices, measurement method and limits. Neither a functional pass nor
benchmark completion passes the other gate; blocked accessibility decisions also
remain visible when functional pointer checks succeed.

Use the [representative benchmark and provenance](../performance/PROTOTYPE_BASELINE.md)
and its [before/after protocol](../performance/PROTOTYPE_BASELINE.md#reproduction-and-the-next-measurement)
for the separate comparison task's performance evidence. Preserve
historical [flat baseline](../performance/BASELINE.md),
[invalidation comparison](../performance/INVALIDATION.md) and
[Leaflet comparison](../performance/LEAFLET_COMPARISON.md) with their narrower scope.
Link the after report/artifacts only when actually produced; do not invent a result
or label local fixes merged. No benchmark run is authorized by this documentation task.

DEC-04 must settle these parameters before a gate can be assessed:

- Target physical devices/OS/browser and device conditions, including throttling,
  power/thermal state and foreground/background policy.
- Workload: 3000/5000 semantic roots plus root kinds, owned vertices/route lengths,
  visible/hidden layer appearances, background complexity, edit/batch frequencies,
  floor-switch rate and input duration. Root count is not DOM/primitive count.
- Load and response limits and their start/end definitions: API completion,
  first rendered state, input-to-observable result, warm/cold resource conditions,
  repetitions and accepted summary/tail statistics.
- Smoothness criterion and measurement method. RAF callback intervals do not
  establish completed rendering, displayed FPS or input latency by themselves.
- Whether memory is a gate or diagnostic; measurement method/availability per
  browser, retained/transient scope, lifecycle repetitions and collection policy.

Do not assign FPS/ms/MB limits here. Current R measures temporary symbols/fills and
text embedded in a background image; it does **not** measure future runtime labels,
resolved materials or their update costs. Revisit workload/measurements when those
features exist rather than extrapolating their acceptance from this baseline.

## Decisions genuinely needed

| ID     | Decision to agree                                                                                                                                                                                              | Consequence while open                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| DEC-01 | Exact first-stage OS/browser versions and available device models; minimum-version policy separately; one initial desktop screen-reader/browser and native phone assistive-technology sample                   | Matrix is proposed; observations certify only the recorded samples, not broad support                                      |
| DEC-02 | Map/object focus model and entry/exit/order/visible indication; camera keys and interception scope; object names, activation/context and external-details responsibility; focus behavior on hide/remove/detach | A11Y-02–04 blocked; accepted accessibility goal still needs implementation after agreement                                 |
| DEC-03 | Intended application page/map scroll policy, including gestures crossing map boundary and any opt-in/modifier rules                                                                                            | COORD-02 can document current behavior; alternative interaction must not be treated as a bug/requirement without agreement |
| DEC-04 | Performance devices/workload/update frequency, load/response/smoothness criteria and memory need/method                                                                                                        | Performance gate cannot be declared passed                                                                                 |

Public cancellation notification remains open in the current contract. It does
**not** block testing cancellation cleanup/no-release behavior and need not be
settled to run the first wave. No new public cancellation scenario is proposed.

## Execution order and minimal first wave

All stages below are proposed future runs. Coordinate with the measurement task:
no concurrent browser tests, performance runs, builds or build-directory replacement.
Freeze an identified build; do not use a changing development tree for acceptance
of a production artifact. Source-fixture checks retain their separate identity.

1. **Prepare evidence and identify integration state.** Record HEAD, dirty patch/
   file hashes, lockfile/config/harness and build hashes. Confirm which local fixes
   are integrated, which are candidates, and which representative artifacts exist.
   Agree DEC-01 samples. A candidate-only run must say so.
   Before phone scenarios, verify and record the HTTPS/secure-context preflight;
   unmet prerequisites block the environment before ENV-01 or other scenarios start.
2. **C0 regression block, once the measurement slot is free.** Existing
   `npm run test:browser` and `npm run test:e2e`, sequentially under
   [Tooling](../TOOLING.md); record B/E-built/E-input coverage separately. These
   commands run Chromium only. Preserve evidence and failures; no new CI/runner
   setup is part of this plan. Isolate failed cases rather than repeatedly running
   everything. Node contracts can supplement missing native branches, not replace them.
3. **Desktop smoke on D1–D4.** Each actual browser: ENV-01, CAM-01/02, COORD-01/02,
   MOUSE-01/02, EVENT-01, LAYER-01/03, EDIT-01 and A11Y-01. Include full
   LAYER-02, EDIT-02/03, LOAD-01 and controlled CANCEL/LIFE cases at least on D1 in
   the first wave; mark other browsers' remaining cases not run explicitly.
4. **Physical M1 and M2 core.** Each phone: ENV-01, CAM-01/02, COORD-01/02,
   TOUCH-01–04, LAYER-01/02/03, EDIT-01 and external-UI A11Y-01. TOUCH-03 can run
   against the merged correction; older builds must be identified separately. A
   failed agreed expectation is reported as fail, not waived by touch emulation. Attempt
   CANCEL-01 with recorded native interruption; add LIFE-01 only where remote
   inspection can control the host. Desktop wheel/capture checks retain separate scope.
5. **One representative functional block.** REP-01 against the released identified
   build; reuse separate before/after artifacts for performance. Do not launch
   timing/instrumentation just to fill a functional acceptance row.
6. **Review gaps and decisions.** Summarize pass/fail/blocked/not run per platform
   and scenario. Keep A11Y-02–04 and performance gate blocked on their decisions;
   never call this limited first wave complete prototype/browser support validation.

Later expansion: port suitable Browser Mode and portable built-example/input checks
to Firefox/WebKit and optionally installed Chrome/Edge; keep CDP-only cases distinct.
Complete LOAD/CANCEL/LIFE/topology and scroll automation in each engine, expand
actual desktop OS/browser and physical device/version coverage, then implement and
run agreed accessibility cases. Physical native gestures/orientation/OS interruption
and assistive navigation remain device work even with remote automation. Re-run
affected functional and performance workloads when batch/materials/labels arrive.

## Result protocol template

One record per scenario/platform/build; expand subcases when results differ.
Attach evidence outside Git unless a sanitized artifact is explicitly requested.
Do not overwrite historical results, and do not treat an old pass as a new-build pass.

```text
Run ID:
Date/time and timezone:
Commit SHA / branch:
Candidate or integrated baseline; local changes and patch/file SHA-256:
Build SHA-256 / manifest link; config / lockfile / harness / scene hashes:
Mode: production example | source fixture | representative functional
URL/origin and resource/network conditions:
Phone preflight: isSecureContext / typeof crypto.randomUUID / evidence:
Device model / CPU / RAM (if relevant):
OS and version:
Browser/channel and full version; automation tool/version if used:
Browser viewport CSS px / map viewport CSS px / DPR / orientation:
Input: mouse/wheel | native touch | CDP touch emulation | keyboard | assistive technology
Assistive technology and version, if used:
Scenario ID / subcase / readiness:
Initial scene, camera, floors and saved identity references:
Actual actions; any deviation from the plan:
Result: pass | fail | blocked | not run
Expected vs observed behavior; error codes / unexpected console/resource errors:
Evidence links: screenshot/video, state/event JSON, assertion log/trace:
Blocker/decision/finding reference and next action:
Reviewer:
```

A **pass** requires the observable result and the scenario's evidence, including
event/identity assertions where requested. An unobservable identity claim or
missing native cancellation cannot be converted to a pass. Report partial subcases
explicitly. A platform summary lists unresolved failures, blocked decisions and
not-run cases; it never broadens support beyond the exact tested sample.
