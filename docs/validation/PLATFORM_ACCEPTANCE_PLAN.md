# Platform acceptance plan for the current Atlas prototype

[Main navigation](../DESIGN_MAIN.md) · [Platform direction](../design/PLATFORMS_AND_PERFORMANCE.md) · [Current contract](../design/CURRENT_CONTRACT.md)

Prepared on 2026-10-09; updated on 2026-10-20. This remains a plan, not a completed
platform acceptance report. The initial update was static; the later follow-up
executed only the two corrected recipes recorded under
[Narrow recipe verification](#narrow-recipe-verification--2026-10-20).
No full scenario is marked passed. Runtime, tests, CI, dependencies and benchmark
reports are outside this task's write scope.

## Basis and limits

### Current verification basis — 2026-10-20

Source, test assertions and example setup were inspected at
`69c00062c9baecc3bc6940f5d053b5883237bb0b` (`69c0006`, polygon-label merge PR #43).
Batch, materials/icons and point/line/route/polygon labels are implemented in this
base. The initial verification was static, with no browser, suite, build or benchmark
run; the separately recorded follow-up used Chromium only for two recipe checks.
The separate materials/labels benchmark is now merged in
[PR #44](https://github.com/thetimmytook/atlas/pull/44), integrated at `aa73110`.
Its [2026-10-20 report](../performance/PROTOTYPE_MATERIAL_LABELS_2026_10_20.md) and
[captured-build manifest](../performance/prototype-2026-10-20-material-labels-manifest.json)
identify the measured input and frozen build; each platform acceptance run must
still identify its own served artifact. Recheck source/build hashes before execution
and record temporary console setup as part of the run.

The current functional baseline includes:

- Synchronous nested `map.batch(callback)`: state, notifications and picking stay
  immediate; only that map's painting waits. Batch is not a transaction/rollback.
- Material selection: internal fallback, last kind-only rule, last conditional
  rule, then explicit assignment. Only explicit parent chains provide inheritance.
  `object.material = undefined` resumes rules/defaults. `material.properties`
  replaces the entire own declaration; `label.font` inherits per leaf and
  `label.offset` / point `image` each inherit as one whole value.
- Browser preparation of every declared SVG/PNG icon, including unused resources;
  intrinsic dimensions, aspect-ratio resolution, normalized anchors, original
  image colors and screen-sized image rectangles. Point symbol and `pickable`
  remain independent; route-owned points default to no symbol and no picking.
- One horizontal literal label per owner/layer for point, line, fragmented route,
  flat and extruded polygon. Shared browser measurement/layout drives SVG and
  rectangular picking, including preserved whitespace and the white 3 CSS-pixel
  outline (rectangle expanded by 1.5px each side). Owner/layer eligibility applies;
  labels may extend beyond geometry/intersection bounds inside the viewport.
- Immediate text/material/geometry/typography queries before RAF, including batch;
  paint queues remain pending. Captured hits revalidate the original context after
  synchronous press/release handlers, without choosing an underlying replacement.
- Supported typography notifications: root/probe size, observed style/class and
  stylesheet mutations/load, viewport resize, font completion and reconnect.
  CSSOM/non-viewport-media edits with no supported notification and unchanged probe
  dimensions may wait until the next ordinary render or picking query, which
  reads current computed typography. No public refresh API or complete automatic
  CSSOM tracking is required. See the
  [accepted boundary](../design/PROPERTIES_AND_LABELS.md#point-labels--implemented-for-review-2026-10-16).

### Historical preparation basis — 2026-10-09

The original draft was inspected against `bc874494e3c1d1030b03fb593b1ea25a16a6c8d3`
(`bc87449`, including polygon PR #30) and the then-current working tree. During PR
preparation, source/coverage status was reconciled with fetched merged `master`
`45ee8b3873a7f377d18c14395a4770c0a1868cc4`: the representative benchmark is merged in
[PR #32](https://github.com/thetimmytook/atlas/pull/32), bounded route-topology
invalidation in [PR #33](https://github.com/thetimmytook/atlas/pull/33), and the
second-pointer press correction and gesture tests in
[PR #34](https://github.com/thetimmytook/atlas/pull/34). This confirms integration,
not execution of this acceptance plan. The historical scope predates batch,
materials and visual labels; its counts/results do not cover those additions.
Staged/local changes alone still do not establish merged
status. Identify the exact build again before running any scenario.

Accepted direction is desktop Chrome, Firefox, Safari and Edge, Safari on iOS,
Chrome on Android, mouse/touch, basic keyboard camera navigation, and focus and
activation of interactive objects. Minimum versions, devices, keyboard/focus
contracts and numerical performance limits are not approved. This plan neither
extends promised browser support nor certifies the full agreed prototype slice.
Open decisions block their dependent checks, not executable functional scenarios.

Normative expectations come from [Current contract](../design/CURRENT_CONTRACT.md),
[input and layer rules](../design/LAYERS_AND_INTERACTION.md), and the
[agreed scope and follow-up](../design/PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09).
The five-CSS-pixel drag threshold and payload-free change notifications remain
temporary contracts; `map.definition` remains an immutable load snapshot. Use the
current material/label and route-point defaults, not superseded symbol behavior.
HomeView, camera constraints and a public cancel event remain outside this plan.

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

| Reference used below                                                                                                                                                                                                                                                                    | Actual coverage and limits                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **N-contract** — [map-element.test.ts](../../tests/map-element.test.ts), [camera.test.ts](../../tests/camera.test.ts), [materials.test.ts](../../tests/materials.test.ts), [labels.test.ts](../../tests/labels.test.ts), [label-materials.test.ts](../../tests/label-materials.test.ts) | Node contracts: batch nesting/errors/paint holds, selection/readers, immutable data/text/material declarations, inheritance, validation and atomic shared-consumer edits. Browser stand-ins do not prove native decoding, computed font metrics or input.                                                                                                                                                                                                    |
| **N-placement** — [path-label-position.test.ts](../../tests/path-label-position.test.ts), [polygon-label-position.test.ts](../../tests/polygon-label-position.test.ts)                                                                                                                  | Analytic displayed-geometry attachment: unequal XY lengths, clipped fragments/zero length, area weighting, disconnected regions/largest-cell fallback, positive-area eligibility, caching and identity. No browser typography or visual/native-input certification.                                                                                                                                                                                          |
| **B-component** — [map-element.browser.test.ts](../../tests/browser/map-element.browser.test.ts)                                                                                                                                                                                        | Real custom-element/Shadow DOM/RAF integration; immediate picking, identity, stale hits, reconnect, zero-size recovery and real background decode/load failures preserving the previous scene. Component input helpers include synthetic events; not a complete trusted gesture suite.                                                                                                                                                                       |
| **B-SVG** — [svg-renderer.browser.test.ts](../../tests/browser/svg-renderer.browser.test.ts)                                                                                                                                                                                            | Decoded background/geometry, surviving nodes, camera scale/resize, bounded mutations and reattachment. Renderer assertions alone do not verify application input.                                                                                                                                                                                                                                                                                            |
| **B-layers** — [layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [intersection.browser.test.ts](../../tests/browser/intersection.browser.test.ts), [polygon.browser.test.ts](../../tests/browser/polygon.browser.test.ts)                                           | Composition/visibility/clipping, original identity, synchronous revalidation, detached edits and invalid-load preservation, including background failures.                                                                                                                                                                                                                                                                                                   |
| **B-topology** — [route-topology.browser.test.ts](../../tests/browser/route-topology.browser.test.ts)                                                                                                                                                                                   | Add/insert/remove/replace, surviving identities/nodes, affected updates and synchronous/disconnected picking. Merged in PR #33.                                                                                                                                                                                                                                                                                                                              |
| **B-batch** — [batch.browser.test.ts](../../tests/browser/batch.browser.test.ts)                                                                                                                                                                                                        | Synchronous nesting, thrown/thenable diagnostics, per-map paint deferral, immediate state/events/picking, geometry/topology/layer/camera edits, disconnect and recovery. No async transaction or native input inside a synchronous callback.                                                                                                                                                                                                                 |
| **B-material** — [materials.browser.test.ts](../../tests/browser/materials.browser.test.ts)                                                                                                                                                                                             | Real SVG/PNG decoding, SVG intrinsic-size variants, final anchored image rectangles/zoom, preloaded switches, selection/whole-value edits, failed-load preservation and shared/disconnected atomicity. Some fetch/body/decode failure races are deliberately mocked. SVG attribute checks alone do not prove every source color visually preserved on every platform.                                                                                        |
| **B-point-label** — [point-labels.browser.test.ts](../../tests/browser/point-labels.browser.test.ts)                                                                                                                                                                                    | Real browser text metrics/SVG, literal spaces/horizontal display, origins/px/rem/zoom, halo rectangles, inheritance/context/pickability, fonts/styles/CSSOM boundary, synchronous edits and lifecycle. Most immediate-event helpers dispatch synthetic PointerEvent; the whitespace-gap test also uses native browser pointer input. Non-viewport media subcases use Chromium CDP. No physical touch or screen-reader proof.                                 |
| **B-path-label** — [path-labels.browser.test.ts](../../tests/browser/path-labels.browser.test.ts)                                                                                                                                                                                       | Line/route display, fragmented/zero-length placement, one label per owner/layer, overlap/context, clipping/viewport, topology, current captured hits, shared maps and reconnect. Real layout, predominantly synthetic component input; no built-example native label-only acceptance.                                                                                                                                                                        |
| **B-polygon-label** — [polygon-labels.browser.test.ts](../../tests/browser/polygon-labels.browser.test.ts)                                                                                                                                                                              | Flat/extruded/clipped/disconnected area placement and fallback, inherited typography/halo rectangles, bounds/viewport, duplicate-instance identity, direct/clipped node reuse, immediate/batch edits, captured-hit revalidation, shared maps/reconnect. Real layout with synthetic component input; no physical-device or future 3D-depth claim.                                                                                                             |
| **E-built** — [example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts)                                                                                                                                                                                                                | Production-built Factory/Buildings, trusted Chromium mouse: loading, zoom, checkpoint/zone click/edit, independent floors, batched zone edit, 390 × 844 layout. Current source does not assert native label-only clicks, icon matrix, typography notifications, keyboard or physical touch.                                                                                                                                                                  |
| **E-input** — [camera-input.e2e.test.ts](../../tests/e2e/camera-input.e2e.test.ts), [source fixture](../../tests/e2e/fixtures/camera-input.ts)                                                                                                                                          | Trusted Chromium mouse and Chromium-specific CDP touch: modes, thresholds, wheel, tap/pinch/two-to-one, consumption, cancellation/lost capture, reconnect and stale hits. Vite source fixture, not built F/B; not material/label acceptance.                                                                                                                                                                                                                 |
| **R-bench** — [scene](../../examples/prototype-bench.scene.ts), [functional checks](../../examples/prototype-bench.check.ts), [harness](../../examples/prototype-bench.ts)                                                                                                              | Dated 2026-10-09 artifacts retain their geometry/clipping scope. The separate 2026-10-20 PR #44 report records control/materials-labels profiles at 3000/5000 roots, analytic and visual checks, and trusted native mouse checks including label-only input and owned-point floor context. Its captured-build/input hashes and limits remain separate from this acceptance plan; background text and old counts are not relabelled as runtime-label results. |

[Browser Mode config](../../vitest.browser.config.mts) selects only headless Chromium
at 900 × 700. [E2E config](../../vitest.e2e.config.mts) discovers the two E2E files;
each launches Chromium explicitly. Chromium CDP touch and media emulation are a
separate coverage category even when invoked from Browser Mode. Changing a Browser
Mode instance does not port those cases or either E2E launcher.

Firefox/WebKit automation, installed Chrome/Firefox/Safari/Edge runs and physical
M1/M2 checks have **not been executed by this task**. Portable automation remains
follow-up work; native phone input, OS interruptions and assistive navigation need
device evidence. No updated suite count is inferred from reading parameterized tests.

### Coverage matrix by scenario group

“Existing” below refers to source assertions/historical coverage, never a pass of
this plan. “Planned” means not run. Per-scenario cards define the narrower subcases
and readiness; a partial cell cannot certify the whole row.

| Scenario group          | Existing C0 source assertions                                               | Additional C0 coverage planned                           | Proposed D1–D4                                           | Physical M1/M2                                                            |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| ENV-01/02, CAM-01/02    | B-component/B-SVG/B-layers/E-built, partial                                 | Native initial-collapse setup                            | Planned load/fit/resize; extra zero-size setup           | Planned load/fit/rotation; zero-size later                                |
| COORD-01/02             | No dedicated scroll/layout assertions                                       | Portable scroll/layout checks                            | Planned current coordinates/scroll behavior              | Planned real page/map gestures                                            |
| MOUSE-01/02             | E-input pan/wheel                                                           | Held-pointer wheel subcase                               | Planned real mouse/wheel                                 | Not a phone touch substitute; separate input scope                        |
| TOUCH-01–04             | E-input, Chromium touch emulation                                           | Return-to-origin touch subcase                           | Only on selected touch hardware, if added                | Planned taps/pan/pinch/consumption with merged fix                        |
| EVENT-01/02             | B-component/B-layers/E-input, partial                                       | Propagation/manual subcases                              | Planned click modes/stale-hit subcases                   | Touch delivery via TOUCH-01/03/04; controlled revalidation later          |
| CANCEL-01/02            | E-input cancel/lost capture                                                 | No additional C0 suite proposed                          | Planned controlled capture/cancel where available        | Native cancellation attempt; capture-loss expansion later                 |
| LIFE-01/02              | B-component/B-layers/E-input/B-topology                                     | No additional C0 suite proposed                          | Planned controlled detach/reconnect                      | Remote-controlled active gesture where possible; edits later              |
| LAYER-01–03, EDIT-01–03 | B-layers/B-component/B-SVG/E-built/B-topology, partial                      | Specific membership subcases                             | Planned floors/picks/edits; full matrix expansion later  | Planned floors/geometry buttons/picks; strict identity needs probes       |
| LOAD-01                 | Invalid-definition and real image decode/load failures preserving old scene | Controlled request delay                                 | Planned other browsers and controlled request delay      | Remote-assisted expansion later                                           |
| REP-01                  | R-bench, separate merged functional harness                                 | Identified-build acceptance run                          | Planned identified-build check, D1 first                 | Fixed viewport unsuitable; use F/B functional subset                      |
| MAT-01–03               | N-contract/B-material/B-batch, partial                                      | Native icon/color and preservation matrix                | Planned F/P material and resource checks                 | Planned icon decode/size/color and label inheritance; remote errors later |
| LABEL-01–03             | N-placement/B-point-label/B-path-label/B-polygon-label                      | Built native label-only/overlap/context checks           | Planned four-kind placement/layout/picking               | Planned four-kind visual/native-tap subset                                |
| LABEL-04–06             | B-batch and label suites, partial; same-turn input mostly synthetic         | Portable native before-RAF/capture/font/lifecycle probes | Planned controlled timing, notifications and shared maps | Remote-controlled subset; instrumented timing later                       |
| A11Y-01                 | Markup/native semantics, no acceptance assertions                           | External UI keyboard/assistive checks                    | Planned external UI keyboard/assistive check             | Planned external UI assistive check                                       |
| A11Y-02–04              | No object/camera keyboard implementation                                    | Decision required, then implementation/checks            | Decision required, then implementation/checks            | Decision required, then implementation/checks                             |

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
Call it `map` in the steps below; `surface` means `map.shadowRoot.querySelector('svg:not([aria-hidden])')`.
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
Record native trust/ID/type on native pointer events: Atlas surface/object events
are CustomEvents and do not themselves carry those native fields. Do not synthesize
`objectclick` to prove picking.

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

### P — temporary material/label setup on Buildings

F already shows `Entry`, `Checkpoint`, `Crossing` and `Patrol route`; B shows
`Shared zone`. These are useful smoke targets, but there are no icon, material,
font or label-origin controls. Use the following disposable console/remote-inspection
setup on **fresh B after load** for MAT/LABEL cards. It replaces the scene on the
existing host through public APIs; it creates no repository fixture. Reload B to
restore its original controls/data before other scenarios. Do not use its original
floor/edit buttons while P is loaded. Keep the setup text/hash with the run.

The PNG is generated with browser canvas solely as a repeatable 40 × 20 resource;
the SVG has the same red/green/transparent pattern. This avoids assuming the
unreferenced Factory PNG is copied into a production example build.

```javascript
(async () => {
  const map = document.querySelector('atlas-buildings');
  const background = map.definition.layers.find(layer => layer.background).background;
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 20;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 20, 20);
  context.fillStyle = '#00ff00';
  context.fillRect(20, 0, 10, 20);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path fill="#ff0000" d="M0 0h20v20H0z"/><path fill="#00ff00" d="M20 0h10v20H20z"/></svg>';
  const point = (x, y, z) => ({ kind: 'point', position: { x, y, z } });
  const definition = {
    resources: {
      svg: { kind: 'image', source: 'data:image/svg+xml,' + encodeURIComponent(svg) },
      png: { kind: 'image', source: canvas.toDataURL('image/png') },
    },
    materials: {
      labels: {
        properties: {
          label: { font: { size: '20px' }, origin: 'top left', offset: { x: '0px', y: '30px' } },
        },
      },
      child: {
        inherits: 'labels',
        properties: { label: { color: '#663399', font: { weight: 'bold' } } },
      },
      iconBase: { inherits: 'child', properties: { symbol: 'image', image: { resource: 'svg' } } },
      icon: { inherits: 'iconBase', properties: { color: '#0000ff' } },
      onlyFirst: { properties: { label: { color: '#ff0000' } } },
    },
    materialRules: [{ when: { kind: ['point', 'line', 'route', 'polygon'] }, material: 'child' }],
    layers: [
      { id: 'site', stackIndex: -1, background },
      { id: 'p-full', objects: ['p-icon', 'p-text', 'p-line', 'p-flat'] },
      {
        id: 'p-low',
        stackIndex: 1,
        intersectionBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 360, y: 200, z: 3 } },
      },
      {
        id: 'p-high',
        stackIndex: 2,
        intersectionBounds: { min: { x: 0, y: 0, z: 3 }, max: { x: 360, y: 200, z: 6 } },
      },
      { id: 'p-over', stackIndex: 3 },
    ],
    objects: [
      { ...point(40, 90, 9), id: 'p-icon', material: 'icon' },
      { ...point(170, 45, 9), id: 'p-text', label: '  A  B  ' },
      { id: 'p-line', kind: 'line', label: 'Line', points: [point(40, 45, 9), point(120, 45, 9)] },
      {
        id: 'p-route',
        kind: 'route',
        label: 'Route',
        points: [
          { ...point(30, 130, 1), id: 'p-owned', label: 'Owned', pickable: true },
          point(150, 130, 5),
          point(270, 130, 1),
        ],
      },
      {
        id: 'p-flat',
        kind: 'polygon',
        label: 'Flat',
        baseZ: 9,
        contour: [
          { x: 210, y: 15 },
          { x: 250, y: 15 },
          { x: 250, y: 35 },
          { x: 210, y: 35 },
        ],
      },
      {
        id: 'p-volume',
        kind: 'polygon',
        label: 'Volume',
        baseZ: 1,
        height: 4,
        contour: [
          { x: 280, y: 70 },
          { x: 320, y: 70 },
          { x: 320, y: 90 },
          { x: 280, y: 90 },
        ],
      },
    ],
  };
  await map.load(definition);
  map.style.fontFamily = 'monospace';
  map.camera.center = { x: 180, y: 100 };
  map.camera.zoom = Math.min(map.camera.viewport.width / 360, map.camera.viewport.height / 200);
  const surface = map.shadowRoot.querySelector('svg:not([aria-hidden])');
  let roots = Object.fromEntries(Array.from(map.objects, object => [object.id, object]));
  let layers = Object.fromEntries(map.layers.map(layer => [layer.id, layer]));
  let owned = roots['p-route'].points[0];
  const events = [];
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(
      type,
      event =>
        events.push({
          type,
          time: performance.now(),
          trusted: event.isTrusted,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          x: event.clientX,
          y: event.clientY,
        }),
      { capture: true },
    );
  }
  for (const type of ['press', 'release', 'objectclick']) {
    map.addEventListener(type, event => {
      const { object, layer, route, clientPoint, mapPoint, isClick } = event.detail;
      events.push({
        type,
        time: performance.now(),
        isClick,
        clientPoint: { x: clientPoint.x, y: clientPoint.y },
        mapPoint: { x: mapPoint.x, y: mapPoint.y },
        objectId: object?.id,
        layerId: layer?.id,
        routeId: route?.id,
        objectSame: object
          ? object === (object.id === 'p-owned' ? owned : roots[object.id])
          : undefined,
        layerSame: layer ? layer === layers[layer.id] : undefined,
        routeSame: route === undefined ? undefined : route === roots['p-route'],
        label: object?.label,
        material: object?.material,
        camera: { x: map.camera.center.x, y: map.camera.center.y, zoom: map.camera.zoom },
      });
    });
  }
  const watched = new WeakSet();
  const watchChanges = () => {
    for (const object of [...Object.values(roots), owned].filter(Boolean)) {
      if (watched.has(object)) continue;
      watched.add(object);
      object.addEventListener('change', () =>
        events.push({
          type: 'change',
          time: performance.now(),
          objectId: object.id,
          label: object.label,
          material: object.material,
        }),
      );
    }
  };
  const saveReferences = () => {
    roots = Object.fromEntries(Array.from(map.objects, object => [object.id, object]));
    layers = Object.fromEntries(map.layers.map(layer => [layer.id, layer]));
    owned = roots['p-route']?.points[0];
    Object.assign(window.platformAcceptance, { roots, layers, owned });
    watchChanges();
  };
  watchChanges();
  const text = (id, layer = 'p-full') =>
    surface.querySelector(`[data-layer-id="${layer}"] [data-object-id="${id}"] text`);
  window.platformAcceptance = {
    map,
    surface,
    definition,
    roots,
    layers,
    owned,
    events,
    text,
    saveReferences,
  };
})();
```

For the shorthand in P cards, enter
`var map = platformAcceptance.map; var surface = platformAcceptance.surface`.
Use `platformAcceptance.roots`, `.layers` and `.owned` for saved references.
After a successful candidate `load`, call `platformAcceptance.saveReferences()`
before the next identity check; old references must be retained separately when
proving replacement/preservation. It refreshes reference tables, not engine layout.
For a newly added root, add `platformAcceptance.roots[owner.id] = owner` without
resetting unrelated original references. Existing listeners record plain event-time
values; compare recorded counts before/after the action being accepted.

After observed painting, use `platformAcceptance.text(id, layer).getBoundingClientRect()`
to save a plain rectangle and select a client point. Verify the chosen point is
inside the viewport **and outside the owner's symbol/stroke/fill** before a native
click/tap; choosing the center of a polygon label inside its fill cannot prove label
picking. P's 30px downward offset makes isolated label-only targets available.
If a target is clipped on a narrow viewport, pan it into view and recompute the
client target, keeping the stated camera/zoom as evidence. Use saved analytic
attachment/typography for before-paint targets, not stale DOM.
Never equate matching `data-object-id` strings with reference identity. For new roots,
add their saved instance to the reference table before recording events. DOM selectors here are
inspection of current SVG output, not a new public selection API.

P has no public `hitTest`/refresh method. Inside-active-batch queries require the
existing source test harness (B-batch/material/label suites); a built-page native
probe can prove synchronous input revalidation before paint, but cannot pause a
synchronous batch for a later human click. Keep those evidence scopes separate.

## Scenario readiness

Each scenario has exactly one readiness status, separate from its execution result:

| Readiness                                          | Meaning                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Check now** — можно проверить сейчас             | Current behavior/APIs permit a run. Missing automation or device evidence is recorded as coverage debt, not an assumed pass.                                           |
| **Implementation required** — требуется реализация | An accepted expectation is missing/defective in the merged baseline. Local candidate code can be checked, but is not a merged completion.                              |
| **Decision required** — требуется решение          | An expectation depends on an unresolved contract. Exploratory observations are possible; acceptance remains blocked until agreement and, where needed, implementation. |

Full-scenario execution status in this revision, including MAT/LABEL additions, is **not run**.
The narrow recipe verification below records only its executed substeps separately;
it does not pass the containing scenarios or a platform row.
Readiness and existing assertions do not change execution status. Use **blocked** only for a recorded
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
  Atlas surface event which hides hit layer `second`; click the overlapping markers at
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
  `second`, reinsert same host, then show it. Click the current route path; replacement points default to no separate picking.
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
  the `demo-route` path in `first`, with `route: undefined`. Its ordinary owned
  `route-start` has no symbol or separate picking by default. The `demo-marker-2`
  hit also has no owning route; showing second restores that hit.
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
  separately **Replace route interior**. Pick newly added/inserted POIs and the path at replacement/end vertices;
  inspect current point order, clipped paths and unrelated scene nodes.
- **Expected:** Route and untouched point instances/IDs survive. Replacement points and
  original endpoints default to no separate point picking; a path hit identifies
  the route. For a separate vertex-pick subcase explicitly set that point's
  `pickable = true` and `material = 'poi'`, then save its event identity/context. Inserted/replacement
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
  `const start = await window.prototypeBench.nativeSetup()`, real-click the returned
  client point, then `window.prototypeBench.nativeAssert('probe-route', 'b0-f0')`.
  Call `const edited = window.prototypeBench.nativeEdit()`, real-click that point,
  then `window.prototypeBench.nativeAssert('probe-route', 'b0-f0')`.
  Call `const upper = await window.prototypeBench.nativeFloor()`, real-click that
  point, then `window.prototypeBench.nativeAssert('pr-1', 'b0-f1')`; finally call
  `window.prototypeBench.nativeCleanup()` even if an assertion fails.
  `nativeSetup()` and `nativeFloor()` are asynchronous and must be awaited before
  using their coordinates. `nativeEdit()`, `nativeAssert()` and `nativeCleanup()`
  are synchronous. With Playwright, await every `page.evaluate(...)` and native
  `page.mouse.click(point.x, point.y)` before the following assertion/action.
- **Expected:** Functional checks validate both root counts, analytic clipped
  geometry, independent floors, source identity and runtime edits. Native picks
  identify root `probe-route` in `b0-f0` before and after the edit, with no owning
  route context. After the floor switch the hit is the original owned point `pr-1`
  in `b0-f1`, with owning route equal to the original `probe-route`, rather than a
  root-route hit. No timing, FPS, memory or physical-mobile conclusion.
  Background text inside the generated SVG image is not runtime-label coverage.
  The separate [PR #44 report](../performance/PROTOTYPE_MATERIAL_LABELS_2026_10_20.md)
  records material/label visual and native checks for both profiles/sizes. Reusing
  its evidence does not execute this card on another build/browser; the native
  sequence above uses the default control profile.
- **Evidence:** V/E/L, returned JSON, build/source/scene/background hashes and input method.
- **Readiness/coverage:** **Check now** against the identified R-bench harness,
  introduced in PR #32 and extended in PR #44. Dated evidence stays in its reports;
  the follow-up below checks only the native recipe at 3000 roots/control, not
  `check()` or the complete card. Fixed viewport and runner-oriented UI are
  unsuitable for phone layout acceptance; use F/B there.
- **Execution status:** **not run** for the full scenario; native recipe verification
  is recorded separately below.

## Scenarios: materials and icons

### MAT-01 — selection, inheritance and whole-value material edits

- **Platform/method:** C0 N-contract/B-material/B-batch; D1–D4 console-assisted F;
  M1/M2 remote-assisted F, with native taps. Fresh F for each subcase.
- **Start/actions:** Save checkpoint, marker, layers, definition and own snapshots
  `map.materials.get('marker').properties` / `get('poi').properties`.
  **A:** On checkpoint, replace `data` with `{ type: 'other' }`, then `{ type: 'poi' }`;
  assign `material = 'marker'`, then `undefined`. Native-pick the point/path as
  appropriate. **B:** Set `map.materials.get('poi').properties = { symbol: 'circle' }`,
  inspect inherited blue color/22px size, then restore its saved own value. Set
  `map.materials.get('marker').properties = { color: '#ff0000', size: 30 }` and verify marker consumers
  change while explicitly overridden POI color/size stay green/28px.
  **C:** From a fresh F load, use
  `await map.load({ ...map.definition, materialRules: [...map.definition.materialRules, { when: { kind: 'point', type: 'poi' }, material: 'marker' }, { when: { kind: 'point' }, material: 'poi' }] })`.
  Save new references. Inspect ordinary root marker vs checkpoint, then explicitly
  assign checkpoint to `poi` and clear it.
- **Expected:** A uses candidate data immediately; explicit name wins and clearing
  resumes rules. An owned point selected to `marker` has no symbol by contextual
  default but retains its explicit `pickable: true`; no-symbol is not no-picking.
  B replaces own declarations rather than merging them, then inherits omitted leaves
  through `poi → marker`; old frozen snapshots and `map.definition` stay unchanged.
  C's last kind-only rule selects `poi` for an ordinary point, last matching conditional
  selects `marker` for checkpoint even though kind-only `poi` was appended later than
  the original conditional; explicit assignment still wins. No computed-material
  getter is assumed. Immediate state/picking and deferred painting follow B-batch.
- **Evidence:** V/S/E/L, own snapshot values/frozen checks, current text/symbol/size,
  strict point/layer/route references at each event; mutation-time state before RAF.
- **Readiness:** **Check now**; missing UI uses console setup, not runtime work.
- **Execution status:** **not run**. Other-browser/phone results remain absent.

### MAT-02 — SVG/PNG decoding, dimensions, anchors and original colors

- **Platform/method:** C0 B-material plus N-contract aspect-ratio cases;
  D1–D4 P console/native mouse; M1/M2 P remote setup/native taps and visual inspection.
- **Start/actions:** P, isolated `p-icon` at `(40,90)`; save icon group and handles.
  Replace `platformAcceptance.map.materials.get('iconBase').properties` with
  `{ symbol: 'image', image: { resource: 'svg', width: 80, height: 80, anchor: { x: 0.5, y: 1 } } }`.
  Repeat with `resource: 'png'`. In fresh subcases set image to `{ resource: 'svg' }`,
  `{ resource: 'svg', width: 80 }`, `{ resource: 'svg', height: 40 }`, and
  `{ resource: 'svg', width: 80, height: 80, preserveAspectRatio: false, anchor: { x: 0, y: 0 } }`.
  With the 80px parent image active, set child `map.materials.get('icon').properties = { image: { resource: 'png' } }`
  to observe a whole 40 × 20 replacement, then
  `map.materials.get('icon').properties = { color: '#ff00ff' }` to resume inherited dimensions. Repeat at half/double initial
  camera zoom. Native-click an opaque patch and the transparent right-hand quarter,
  then just outside the final anchored rectangle, away from other geometry.
  For SVG size derivation, reload copied P candidates changing only SVG source to
  viewBox-only `viewBox="0 0 40 20"`, then width 80 plus that viewBox.
- **Expected:** SVG/PNG decode. 80 × 80 with default aspect preservation produces
  80 × 40 CSS px, x offset −40/y offset −40 for bottom-center anchor. Native and
  width-only/height-only cases resolve to 40 × 20 / 80 × 40 / 80 × 40; stretch is
  80 × 80 at top-left anchor. SVG viewBox-only resolves 40 × 20; width 80 plus
  viewBox resolves 80 × 40. Camera zoom preserves screen size/anchor offset.
  Red/green/transparency remain original despite material color changes; images
  have no recoloring. Picking includes transparent pixels in the whole rectangle.
  Whole `image` replacement does not merge missing fields from its parent; removing
  the child's image declaration resumes the full inherited image. Preloaded switches
  are synchronous and surviving owner nodes remain; no source reload API is implied.
- **Evidence:** V/S/E/L, actual decoded sources, source/final dimensions and anchors,
  SVG image attributes/client rectangles, native inside/outside events and identity.
  Attribute absence alone is insufficient evidence for original colors.
- **Readiness:** **Check now** with P. Further SVG source-size edge cases stay in
  the automated inventory rather than separate manual cards.
- **Execution status:** **not run**; failed environment/resource preparation is recorded.

### MAT-03 — invalid resources/materials/text preserve promised state

- **Platform/method:** C0 N-contract/B-material/label validation suites;
  D1–D4 console-assisted P; M1/M2 remote-assisted error subset.
- **Start/actions:** P painted, pan/zoom and save original map definition, collection,
  root/layer/lookup/handle/own-snapshot references, camera, SVG nodes and event counts.
  **A:** Attempt `await map.load({ ...platformAcceptance.definition, resources: { ...platformAcceptance.definition.resources, unused: { kind: 'image', source: 'data:image/svg+xml,%3Cnot-svg%2F%3E' } } })`
  and catch the rejection; repeat with valid SVG namespace but `width="0"` and
  `viewBox="0 0 40 20"`. Use a revoked Blob resource URL for a fetch failure.
  **B:** Attempt `map.materials.get('child').properties = { label: { font: { size: '0px' } } }`,
  `platformAcceptance.roots['p-text'].material = 'missing'`, and text containing LF,
  CR and CRLF, separately catching each. **C:** Where request controls exist, delay
  an icon request in a copied candidate, pick/edit the old scene while pending,
  then fail the request. Native-pick the old label/icon after each failure.
- **Expected:** A rejects `INVALID_IMAGE_RESOURCE` for malformed/invalid-size SVG,
  even unused; revoked-resource fetch rejects `IMAGE_RESOURCE_LOAD_FAILED`.
  Previous scene, lookup, handles, objects, snapshot and camera survive load failure.
  B rejects `INVALID_MATERIAL_PROPERTY`, `UNKNOWN_MATERIAL` and `INVALID_OBJECT_LABEL`
  respectively, with fixed messages/structured details; old value/hits persist and
  no successful mutation notification is emitted. C keeps old scene usable while
  preparation is pending; do not expect a successful replacement or camera fit.
  Shared-object rejection across maps is also checked in LABEL-06. A batch error
  does not roll back earlier successful mutations; do not generalize setter/load
  atomicity into batch transactional semantics.
- **Evidence:** V/S/E/L, captured error name/code/details/cause, reference equality,
  event-count deltas, preserved camera/snapshots and subsequent native hits.
- **Readiness:** **Check now**. Unavailable request-delay controls block only C;
  missing remote inspection blocks the affected phone subcases, not all cards.
- **Execution status:** **not run**. Expected rejection is not a platform failure.

## Scenarios: labels, typography and synchronous interaction

### LABEL-01 — four kinds, clipped placement, one owner label and polygon fallback

- **Platform/method:** C0 N-placement/B-point-label/B-path-label/B-polygon-label;
  D1–D4 P plus original F/B visual/native picks; M1/M2 P visual/native-tap subset.
- **Start/actions:** P painted. Inspect `p-text` and `p-owned`, line, route and both
  polygon kinds; save source positions/contours/IDs and label count per saved owner/layer.
  Low route has two displayed fragments, high route one. Hide high temporarily to
  inspect low. Add/remove `p-route` through `p-low.objectIds` to compare clipped/full
  placement, then restore. In a fresh P, temporarily move `p-line` endpoints to `(40,45,1)` and
  `(120,45,5)` and remove/add its `p-full` ID to compare automatic and direct geometry.
  For fallback, fresh P: hide low/high; remove existing IDs from p-full and add a
  root polygon with `baseZ: 9`, label `Fallback`, and contour
  `[(20,20),(140,20),(140,140),(120,140),(120,60),(40,60),(40,140),(20,140)]`
  expressed as `{x,y}` objects through `map.objects.add`. Add the returned ID to
  `p-full.objectIds` and save the returned instance/reference-table entry.
  Native-pick labels away from geometry. For disconnected/boundary-only clipping,
  use the existing named N-placement/B-polygon-label fixtures as source-harness subcases.
- **Expected:** Line attachment is its displayed segment midpoint. P route low
  attachment is `(90,130)` (half of two 60-unit fragments, excluding their gap);
  high attachment is `(150,130)`. Full direct route uses `(150,130)` too. Exactly one
  route label per layer despite multiple fragments, before owned-point appearances.
  Polygon rectangle attachments are `(230,25)` and `(300,80)`; extrusion height
  controls layer eligibility without shifting text in XY. U-shape fallback attachment
  is `(280/3,100/3)`, centroid of the first largest existing cell because the union
  centroid is outside. Apply P's screen offset after these map attachments.
  Disconnected cells participate in area weighting; no positive displayed area means
  no polygon text/hit rectangle. Direct membership uses whole source geometry.
  Source arrays/positions/IDs and immutable load snapshot remain unchanged by clipping.
- **Evidence:** V/S/E/L; analytic attachment vs observed text origin, per-layer text
  counts, saved source values and original owner/layer/owned-route reference booleans.
- **Readiness:** **Check now**; no fallback/disconnected UI button is assumed.
  Disconnected/tangent analytic cases need source-harness execution for their own evidence.
- **Execution status:** **not run**, including all fixture subcases.

### LABEL-02 — inherited typography, origins, px/rem, spaces and outline rectangle

- **Platform/method:** C0 label suites/N-contract; D1–D4 console/native P;
  M1/M2 remote setup/native taps, visual zoom subset.
- **Start/actions:** P, save `labels`/`child` own snapshots. Inspect child's inherited
  size/origin/offset and own color/bold weight. Replace child with
  `{ label: { font: { weight: 'normal' } } }`, then `{}`; replace parent's label with
  a complete declaration using size `1rem` and offset `{ x: '1rem', y: '-1rem' }`.
  Compare with size `20px`, offset `{ x: '12px', y: '30px' }`. With only p-text
  displayed, iterate the nine accepted origins using whole properties assignment,
  retaining the other intended fields. Pan and halve/double zoom at each unit mode.
  For a default-only subcase, fresh P: assign `{}` to both parent and child properties.
  Set text to `'  <b>A</b>  **B**  '`, then `''`, spaces-only, `undefined`, then restore.
  Set `map.style.writingMode = 'vertical-rl'` and `textTransform = 'uppercase'`.
  Native-click an inter-word gap/leading space, a halo edge and just outside it.
- **Expected:** Font leaves inherit independently, offset replaces as one x/y pair;
  whole-value edits resume inherited/default fields, without modifying retained own
  snapshots. Unstyled defaults: 1rem, container family, normal, #222222; point/path
  bottom-center with `(0px,-1rem)`, polygon centered with zero offset. For origin
  `(vertical,horizontal)`, measured text rectangle's corresponding edge/center is
  at attachment plus offset; positive x/y move right/down. px/rem size and offsets
  stay independent of camera zoom. Literal case/spaces survive, no markup children,
  wrapping or vertical text. Empty/whitespace/undefined produce no label hit area.
  White 3px round-join outline paints before fill at every zoom; picking rectangle
  includes whitespace and extends measured bounds by 1.5 CSS px on each side.
  Compare measured browser layout and edge hits, not screenshot glyph pixels alone.
- **Evidence:** V/S/E/L, measured rectangles/computed text style and root font size,
  own snapshots before/after, origin calculations and native inside/halo/outside counts.
- **Readiness:** **Check now**. Cross-browser raster/font equality is not required.
- **Execution status:** **not run**.

### LABEL-03 — label-only picking, viewport/bounds, overlap and original context

- **Platform/method:** C0 label suites; D1–D4 native mouse P; M1/M2 native taps P.
- **Start/actions:** Fresh P; choose label-only points outside each owner's geometry.
  For route low label at `(90,130)`, use its 30px-down label rectangle; compare
  owned label at `(30,130)` attachment. Change owned `pickable` true → false →
  undefined → true without changing text. To put text beyond intersection bounds,
  reload a copied P definition with p-low `max.y = 140`; low route geometry still
  exists, but its downward text extends beyond that bound. Save new references.
  Pan until part of text leaves the surface, and try its inside/outside-viewport portions.
  **Overlap:** Fresh P, hide low/high, set p-text text to `Overlap`; add p-flat to
  p-full after calling its `setContour` with a 20 × 20 square around the label-only target
  converted by `clientToMap`. Native-click there; remove only p-flat's direct ID and
  click again. Add p-text's ID to p-over, then hide/show p-over and repeat.
- **Expected:** Whole visible label rectangle selects owner beyond its symbol/fill
  and intersection bounds; outside viewport cannot select that map appearance.
  Point labels honor effective pickable even when text stays visible. Root/path/
  polygon label events have `route: undefined`; owned point label returns the exact
  point and owning route. Later geometry covers earlier label and wins reverse
  picking; higher visible layer wins, hidden appearances do not intercept. Removing
  covering geometry exposes the original label; distinct appearances retain their
  saved runtime layer and owner references, never synthetic clipped owners.
- **Evidence:** V/S/E/L with chosen client/map targets, proof targets lie outside
  owner geometry, viewport/bounds, native input and event-time object/layer/route
  equality and counts. ID text or details-panel screenshot alone is insufficient.
- **Readiness:** **Check now**. Phone precision/inspection limitations must be recorded
  per subcase; a geometry tap cannot be substituted for a label-only tap.
- **Execution status:** **not run**.

### LABEL-04 — immediate edits/batch queries and captured press/release hits

- **Platform/method:** C0 B-batch/material/label source harness for queries inside
  active callback; D1–D4 P native input with temporary one-shot listeners;
  M1/M2 remote-assisted native-input subset.
- **Start/actions:** Fresh P per subcase; isolate the chosen owner/layer, save old
  text/node/rect and independently calculate the new label-only target. Arm a native
  `surface.addEventListener('pointerdown', handler, { capture: true, once: true })`
  before the gesture. In handler set p-text label to `'Longer label'`, position to
  `{ x: 140, y: 45, z: 9 }`, and parent properties to
  `{ label: { font: { size: '20px' }, origin: 'top left', offset: { x: '0px', y: '60px' } } }`
  inside nested `map.batch`; synchronously
  save committed values and old DOM text/attributes before returning. Native-click
  the predicted new-only area in press mode, then await painted output. Source-harness
  subcases query inside the active callback and verify paint work is still pending.
  **Captured hits:** In fresh P per mode, install a one-shot **Atlas** `press` or
  `release` listener matching `clickTrigger`; after capture it removes text, shrinks/
  moves its rectangle, hides the hit layer or removes owner. Repeat on line/route/
  polygon label with geometry/topology/height edits. Keep an underlying replacement
  candidate: p-text in both p-full and p-over; hide p-over in the callback. Separately
  set route label to `'Still valid across fragment switches'`, premeasure both low
  direct/clipped rectangles, restore initial membership, and arm the Atlas listener
  to toggle that membership. Choose a point in their intersection away from stroke.
  Repeat for polygon membership while the point stays inside both old/new rectangles.
- **Expected:** State/events/queries use new material/text/geometry immediately,
  before RAF; painting stays deferred and later catches up without losing queued work.
  Only the selected map's painting is held; see shared-map LABEL-06. Native before-RAF
  revalidation and source queries inside a callback are separate observations.
  After Atlas handlers, obsolete original hits are suppressed; no underlying object
  or layer is selected instead. A still-valid original owner/layer hit survives
  direct/clipped or route-fragment-host changes. Press mode delivers at most once,
  release mode only on eligible up. Subsequent fresh input works normally.
- **Evidence:** E/S/L plus V after paint; values/old DOM saved synchronously inside
  handlers, event order/counts, native input trust and exact captured-context references.
  A later screenshot cannot prove immediate state or a query inside active batch.
- **Readiness:** **Check now** with the stated source-harness/native split. Portable
  built-page timing automation is follow-up coverage; no public picking API is invented.
- **Execution status:** **not run**.

### LABEL-05 — root font, container family, font completion and notification boundary

- **Platform/method:** C0 B-point-label shared pipeline plus path/polygon rem cases;
  D1–D4 console-assisted P; M1/M2 remote-assisted P. Chromium CDP media subcase is C0 only.
- **Start/actions:** P, child has no explicit family. Set parent font size `1rem`,
  offset `(0px,2rem)` through whole label declaration; save root inline font size,
  then set `document.documentElement.style.fontSize = '24px'`. Change map family
  monospace → serif. Before observer delivery, use the LABEL-04 native capture probe
  for immediate picking; then observe notified painting without map input. Repeat
  with px font/offset, then on line/route/polygon targets. For real font completion,
  start a fresh P and assign `const face = new FontFace('AcceptanceFace', 'local("Arial"), local("Liberation Sans"), local("DejaVu Sans")')`,
  set parent's `label.font.family` to `'"AcceptanceFace", monospace'`, call
  `document.fonts.add(face)` and `await face.load()`, recording `loadingdone`/`loadingerror`
  and actual computed metrics. For stylesheet load start fresh P, clear map inline
  `font-family` with `map.style.removeProperty('font-family')`, and use a Blob-backed `<link rel="stylesheet">`
  with a rule targeting `atlas-buildings`; retain load event and revoke URL after cleanup.
  **Rare boundary:** Fresh P with Cyrillic text; clear inline `font-family`, add a
  temporary map class and a same-origin `<style>` rule setting its family to monospace.
  Load a Cyrillic-only FontFace (`unicodeRange: 'U+0400-04FF'`),
  wait for font events/initial paint, then `style.sheet.insertRule` a family including
  that face plus monospace. Verify computed family changed while the hidden span
  probe dimensions stayed equal. Trigger an ordinary render via
  `map.camera.center = { x: map.camera.center.x + 1, y: map.camera.center.y }`, or,
  in a separate fresh subcase, native-pick the independently measured new rectangle.
  Non-viewport media changes use the same expected boundary; reuse the existing
  CDP `prefers-color-scheme` source test on C0, record actual OS preference change
  elsewhere if available. Restore root/container styles; reload and delete added faces.
- **Expected:** rem follows current root size; unspecified family follows this
  container; explicit family/px fields retain their meaning. Supported notifications
  refresh output without a permanent RAF loop. Font completion refreshes metrics and
  picking while retaining surviving text nodes. No requirement that every installed
  font produces different widths; record actual font availability/load result.
  With no supported notification and unchanged probe, idle repaint is optional;
  next ordinary render/picking must use current computed typography synchronously.
  Do not call private refresh, traverse stylesheets or require automatic CSSOM tracking.
- **Evidence:** V/S/E/L, root/container computed styles, probe/reference label rectangles,
  actual font status/events, stylesheet load/media state, notification/action timing
  and native old-only/new-only hit assertions. Save numeric values at observation time.
- **Readiness:** **Check now**. Unavailable font/local source, preference controls or
  remote inspection block only their concrete subcase; record reason, not a pass.
- **Execution status:** **not run**.

### LABEL-06 — hide/show, removal/reattach, shared maps and reconnect

- **Platform/method:** C0 B-material/B-batch and all label suites;
  D1–D4 console/native P; M1/M2 remote-assisted core hide/show/reattach subset.
- **Start/actions:** P per owner kind: hide/show hit layer, remove root using
  `map.objects.remove(owner)`, edit detached text/geometry, then `map.objects.add(owner)`.
  Existing direct ID remains where applicable. Native-pick old and current label-only
  targets. Save host parent/next sibling, detach same host, edit text/material/root
  font or container family, reconnect there without another load and repeat picks.
  **Shared:** Fresh P, create a second host via `document.createElement('atlas-buildings')`,
  set `style.cssText = 'display:block;width:360px;height:240px;font-family:serif'`,
  append it, then wait for a positive camera viewport. Use the following load/attach
  sequence, with `second` referring to that new host:

  ```javascript
  const { onlyFirst, ...sharedMaterials } = platformAcceptance.definition.materials;
  const secondDefinition = {
    ...platformAcceptance.definition,
    objects: [],
    materials: sharedMaterials,
    layers: platformAcceptance.definition.layers.map(layer => ({
      ...layer,
      objects: [],
    })),
  };
  await second.load(secondDefinition);
  const owner = platformAcceptance.roots['p-text'];
  second.objects.add(owner);
  second.layers.find(layer => layer.id === 'p-full').objectIds.add(owner.id);
  ```

  Clear every second-map layer's direct IDs before loading an empty root collection;
  otherwise `load` rejects `UNKNOWN_LAYER_OBJECT` (first missing ID: `p-icon` in
  `p-full`). After successful load, attach the exact original runtime `p-text`,
  not a copied definition, then add its direct membership. Keep `onlyFirst` absent
  from `sharedMaterials`. Save both maps' separate layers/lookup/handles and set
  cameras to the target. Change shared text/position, edit first map's material, then detach
  second and attempt `owner.material = 'onlyFirst'`. Catch rejection, reconnect.
  Use B-batch source assertions for the second map scheduling its RAF while the
  first map still holds its own request inside a synchronous callback; actual paint
  happens after JavaScript returns. Do not wait asynchronously inside batch.

- **Expected:** Hidden/removed appearances have no label hit; reattach uses current
  state and original object, with no ghost label or duplicated event delivery.
  Reconnect refreshes typography after the unobserved interval. Shared text/position
  updates all consumers; each map resolves its own materials/container font/layout.
  First map material edits stay local. Unknown assignment in disconnected second
  map rejects atomically across both maps with no successful change event; old text/
  material/hits remain. Unchanged owners/layers/load snapshots retain identity.
- **Evidence:** V/S/E/L, original instance/host/layer and surviving SVG node comparisons,
  per-map rectangles/material snapshots, event counts and shared rejection details.
  Attach a recorder to second map with its own saved layer references.
- **Readiness:** **Check now** with temporary second host; missing UI is not missing
  engine capability. Remove second host and reload B after the scenario.
- **Execution status:** **not run**.

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

## Narrow recipe verification — 2026-10-20

Run `recipe-followup-2026-10-20-075647Z`, at 10:56 Europe/Riga (07:56 UTC), checked
the corrected instructions in existing production builds served over local loopback.
Environment: headless Chromium **153.0.8010.12**, Playwright **1.63.0**, Darwin
25.6.0 arm64, browser viewport 1100 × 900 CSS px, DPR 1. The P setup and LABEL-06
load/attach block were executed from this document. REP-01 used the current native
API with its default 3000 roots / `control` profile; its embedded source commit was
`69c00062c9baecc3bc6940f5d053b5883237bb0b`.

| Corrected recipe / checked scope                                                                        | Observed result                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LABEL-06: empty second-map definition, cleared direct membership, then attachment                       | Load succeeded; every candidate layer had empty `objects`. Exactly one second-map root was attached, and both maps referenced the original `p-text`; p-full direct membership was present. `onlyFirst` remained absent in the second map.                                                                                             |
| LABEL-06: shared edits, local material and disconnected rejection                                       | Shared text/position propagated; first/second labels retained separate monospace/serif families and local material colors. Assigning `onlyFirst` while second was disconnected rejected `UNKNOWN_MATERIAL`, preserved previous object/material state and second-map own snapshot, and emitted zero successful object `change` events. |
| LABEL-06: native label-only picks before edits and after reconnect                                      | Four trusted Chromium mouse clicks produced four owner/layer identity matches, two per map, with no route context. Click points were outside the point symbol.                                                                                                                                                                        |
| REP-01: awaited setup, native click, synchronous edit, native click, awaited floor switch, native click | All three `nativeAssert` calls succeeded: `probe-route / b0-f0`, `probe-route / b0-f0`, then owned `pr-1 / b0-f1` with owning route equal to the original `probe-route`. Object and layer reference checks passed; all three clicks used trusted mouse input. `nativeCleanup()` ran.                                                  |

No page errors occurred. The two temporary servers and browser were closed.
No suites, builds, `prototypeBench.check()` / `run()`, benchmark timing,
instrumentation or performance capture were executed. Existing served build files
were byte-identical before/after. Their aggregate SHA-256 values (JSON of sorted
`[relative path, file SHA-256]` pairs) were:

- `dist/example`: `6e433af1464b6e3cea24aebc637998a47dfacd1a6a59e3812bdac9a8d9ce58cb`.
- `dist/benchmark`: `2749de99d67a705a6e020be795176f5c87e4c6acd0ee6632f58c4883c3e76844`.

Plain event snapshots, assertions, exact setup hashes and complete build file hashes
were retained outside Git; evidence JSON SHA-256:
`9f40acad5a112ffede4cd0551d117ba49324f825b414472a19e6081cd13d31ab`.
This establishes reproducibility of these recipes in that local Chromium sample.
The remaining LABEL-06 lifecycle subcases, REP-01 full functional checks/other
sizes/profiles, all other scenario cards and other platform rows remain **not run**
by this task. These observations add no performance or broad browser-support pass.

## Functional acceptance and performance gate

Functional platform acceptance records whether agreed behavior works for a named
build/environment/scenario. Performance acceptance separately requires agreed
workload, devices, measurement method and limits. Neither a functional pass nor
benchmark completion passes the other gate; blocked accessibility decisions also
remain visible when functional pointer checks succeed.

Use the historical [representative baseline](../performance/PROTOTYPE_BASELINE.md)
and [completed 2026-10-09 comparison](../performance/PROTOTYPE_COMPARISON.md) for their
recorded clipping/topology/gesture workload only. The
[2026-10-20 materials/labels report](../performance/PROTOTYPE_MATERIAL_LABELS_2026_10_20.md),
merged in PR #44, records the separate control/materials-labels workload, native
functional checks, timings, instrumentation and limitations. Its
[manifest](../performance/prototype-2026-10-20-material-labels-manifest.json) identifies
source commit `69c0006`, runtime aggregate
`7f9b9af5647ad97db6c79d0194f8b380e21b6fa68aed52a4c81d926f63502285`,
harness/config aggregate
`98c9724928c73e5b8c84448b0ed1cdbacfbe9ab8fa038457e45c0694dc11dfe6`
and every frozen build file hash. These are captured benchmark inputs, not a new
platform-support or performance-gate pass.
Preserve historical [flat baseline](../performance/BASELINE.md),
[invalidation comparison](../performance/INVALIDATION.md) and
[Leaflet comparison](../performance/LEAFLET_COMPARISON.md) with their narrower scope.
Do not infer a new result or integration from local files. No benchmark run is
authorized by this documentation task.

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

Do not assign FPS/ms/MB limits here. The 2026-10-09 R artifacts measured temporary
symbols/fills and text embedded in a background image; they did **not** measure the
now-implemented runtime labels, resolved material workloads or their update costs.
The 2026-10-20 results and future measurements retain their own source/build/scene
provenance. Do not extrapolate a material/label or phone performance pass
from old counts, RAF intervals or functional source assertions.

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
   Record available DEC-01 samples; sample/minimum-support agreement remains open.
   Execute available functional rows without waiting for unrelated decisions; the
   PR #44 benchmark report is available as separate evidence. A candidate-only run
   must say so.
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
   the first wave. Add **MAT-01/02 and LABEL-01/02/03 on every available desktop
   sample**; on D1 include MAT-03 and LABEL-04/05/06 controlled subcases. Keep
   other browsers' remaining cases explicitly not run; unavailable samples blocked
   with reason. P console setup is sufficient; no new demo UI is a prerequisite.
4. **Physical M1 and M2 core.** Each phone: ENV-01, CAM-01/02, COORD-01/02,
   TOUCH-01–04, LAYER-01/02/03, EDIT-01 and external-UI A11Y-01. Add P **MAT-02**
   SVG/PNG/color/size/anchor and **LABEL-01/02/03** four-kind visual, screen-size and
   label-only tap subset. Remote-assisted MAT-01/03 and LABEL-04/05/06 can follow
   on devices with inspection; absent inspection blocks only those subcases. TOUCH-03 can run
   against the merged correction; older builds must be identified separately. A
   failed agreed expectation is reported as fail, not waived by touch emulation. Attempt
   CANCEL-01 with recorded native interruption; add LIFE-01 only where remote
   inspection can control the host. Desktop wheel/capture checks retain separate scope.
5. **One representative functional block when its artifact is available.** REP-01
   against the identified build/harness released by the benchmark task, using its
   confirmed scope. This dependency does not hold up F/B/P functional checks. Reuse
   separate artifacts for performance; do not launch timing/instrumentation to fill
   a functional acceptance row.
6. **Review gaps and decisions.** Summarize pass/fail/blocked/not run per platform
   and scenario. Keep A11Y-02–04 and performance gate blocked on their decisions;
   never call this limited first wave complete prototype/browser support validation.

Later expansion: port suitable Browser Mode and portable built-example/input checks
to Firefox/WebKit and optionally installed Chrome/Edge; keep CDP-only cases distinct.
Complete LOAD/CANCEL/LIFE/topology and scroll automation in each engine, expand
actual desktop OS/browser and physical device/version coverage, then implement and
run agreed accessibility cases. Physical native gestures/orientation/OS interruption
and assistive navigation remain device work even with remote automation. Expand
MAT/LABEL notification/capture/shared-map subcases to each browser and phone after
the first wave. Re-run affected rows against later runtime changes with new build
identity; never transfer an old pass to the current build.

## Consolidation handoff and remaining blockers

- Ready to execute: available F/B/P pointer/camera/layer/material/icon/label rows;
  source-harness regressions in a free measurement slot. All execution statuses
  remain not run here; file inspection is not a functional platform run.
- Environment blockers are concrete: unavailable named browser/device, no trusted
  phone HTTPS/secure context/`crypto.randomUUID`, unavailable remote inspection,
  unavailable font or unobservable native cancellation. Record affected subcases
  individually. Missing demo switches are handled by P, not runtime implementation.
- DEC-01–04 remain open. A11Y-02–04 require a contract then implementation; numeric
  performance gate requires agreed criteria. Neither blocks current pointer/label
  runs. No external HTML control proves map-object keyboard accessibility.
- At consolidation, another task should update `DESIGN_MAIN.md`, `CURRENT_CONTRACT.md`,
  `PROPERTIES_AND_LABELS.md` and relevant `PROTOTYPE.md` current-stage summaries to
  reflect merged polygon labels at PR #43, preserving historical step boundaries.
  `CURRENT_CONTRACT.md` also retains stale material pending-merge wording. If needed,
  update Tooling's inventory with separately dated actual suite results, never this
  static read. These files are outside this task's write ownership.
- The PR #44 report/manifest are linked above with their captured-build identity;
  performance reports remain unchanged by this task. Record a fresh artifact identity
  for every acceptance run. Portable built F/B native label/icon probes,
  Firefox/WebKit coverage and any permanent example controls remain later tasks,
  not prerequisites for temporary P.

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
