# First Atlas prototype

## Coordinate migration — implemented for review, 2026-10-09

The z/intersection implementation now separates frozen `Point2(x, y)` and
`Point3(x, y, z = 0)`. The former `Point` export/file is removed, without an alias.
Runtime `MapPoint.position` returns `Point3`; definitions and assignment accept
`Point2 | Point3` and plain x/y input. Construction, loading and owned-point editing
copy into `Point3`. Camera, events, conversions and planar queries use `Point2`.
See the [public signatures](GEOMETRY_AND_ROUTES.md#planar-and-spatial-coordinates--accepted-and-implemented-for-review-2026-10-09).

Bounds use `Partial<Point3>`, preserving absent axes. The optional definition field
has no explicit undefined union; typed callers omit it, while an untyped JavaScript
regression retains explicit undefined support. The runtime getter still returns
`IntersectionBounds | undefined` without a setter. `resolveLayerEntries` replaces
the internal `resolveAppearance` name. Clipping, picking, direct-content priority,
invalidation, source identity, live coordinate views and unaffected SVG nodes retain
the automatic-stage behavior described below.

Implementation covers `src/math/point2.ts`, `src/math/point3.ts`, math/bounds exports,
point definitions/validation/runtime positions, camera and interaction consumers,
spatial geometry/queries, executable examples/benchmarks and existing regression
suites. Current design summaries record the new decision; archived documents and
saved timing results remain unchanged. The initial review preserved existing staged
contents and kept this migration unstaged. The user authorized commits, push and PR
preparation on 2026-10-09.

Validation on 2026-10-09: `npm run check`, `npm test` (178 Node tests),
`npm run test:browser` (68 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built Factory test) passed. Lint retains the eight
pre-existing duplicate-string warnings with zero errors. Bundled declarations
confirm mandatory `Point3.z`, distinct position getter/setter types, planar
conversions, the optional bounds input and getter without a setter or `Point` alias.

Existing boundary regressions still pass: a four-pixel stroke at zoom 1 hits the
included min tangent and points near excluded max when eligible interior positions
are within the hit disk; an excluded max-only tangent misses. Adjacent floor strokes
and vertical transitions remain pickable, with visible overlap resolved by composition.
Live views, source objects, surviving SVG nodes and invalidation counters retain their
existing checks. No full timing benchmark rerun or new timing artifacts were required.
The initial review confirmed an identical staged manifest before/after implementation.

## Automatic height and intersection stage — implemented for review, 2026-10-08

The user authorized implementation in the primary repository, with no worktree,
commit, push or PR. This stage preserves the merged explicit-layer/review base and
existing local merge/contract notes. The original 2026-10-08 version added optional
`Point.z`, normalized copied map-object positions and validated, frozen
`IntersectionBounds`. That version did not add a second public coordinate type or a
runtime bounds setter. The coordinate-type
decision is superseded by the 2026-10-09 migration above; the behavior below remains.

Every layer with bounds prepares automatic appearances of current roots, while
directly selected roots appear whole once. Bounds do not change `layer.objects` or
`objectIds`. Shared segment clipping retains original runtime identity and ordered
route fragments; SVG/picking share these entries. Cut coordinates create no runtime
points, symbols or separate point hit areas. See the [contract, example boundary
results and click rules](LAYERS_AND_INTERACTION.md#intersection-bounds-contract--accepted-and-implemented-for-review-2026-10-08)
and [preparation/invalidation counters](RENDERER_AND_COMPONENT.md#automatic-spatial-appearances--implemented-for-review-2026-10-08).

```ts
{
  objects: [{
    id: 'route', kind: 'route', points: [
      { kind: 'point', position: { x: 20, y: 100, z: 1 } },
      { kind: 'point', position: { x: 120, y: 100, z: 5 } },
      { kind: 'point', position: { x: 220, y: 100, z: 1 } },
    ],
  }],
  layers: [
    { id: 'lower', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
    { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
    { id: 'overview', objects: ['route'] }, // full direct appearance
  ],
}
```

Factory uses a common background, two independent z floor layers and one whole
route that rises and returns. It is not added to each floor's ID list. Original
vertices carry heights; an external button changes checkpoint height. The explicit
independent line remains whole in the first layer despite its bounds. Existing
camera, route/root editing and detached-edit controls remain in the application.
Click details include original object/route/layer IDs and x/y surface coordinates.

Validation: `npm run check`, `npm test` (176 Node tests),
`npm run test:browser` (68 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built Factory smoke test) passed on 2026-10-08.
Lint has zero errors and the eight pre-existing duplicate-string warnings. Bundled
public declarations were checked: the existing `Point` position type remains and
`MapLayer` exposes a getter for `IntersectionBounds` without a setter. Old 2D snapshot assertions now
explicitly check normalized z = 0; existing SVG primitive/coordinate/identity
assertions are retained. The previous unsupported-bounds regression now uses
invalid bounds and still checks atomic failure preservation.

Built benchmark functional checks also passed: all four stress Preview scenes
(3000/5000 roots, points/mixed), dense 3000/mixed Preview and sparse smoke for
Atlas SVG, Leaflet SVG and Leaflet Canvas. These use the existing SVG/picking/adapter
checks. No timing suite or new CSV/manifest exports ran; historical artifacts remain
unchanged. Library, benchmark and example builds were run in order because the
library build clears the common `dist` directory.

Limits: point/line/route geometry and axis-aligned bounds only; current vertex
symbols and four-pixel strokes remain temporary until materials/point interaction.
The SVG projection and camera remain 2D. Clipping traverses all segments of each
changed route; membership changes still reconcile layer/root candidates. Physical
mobile validation, volumetric zones, polygons, materials, labels, batch, LOD,
layer groups, editor, 3D and new performance measurements are outside this request.
Floating-point calculations use finite double-precision coordinates; this is not an
arbitrary-precision geometry engine.

### Files changed in the automatic stage

- Engine: [src/components/map-element/map-element.ts](../../src/components/map-element/map-element.ts), [src/definitions/map-definition.ts](../../src/definitions/map-definition.ts), [src/definitions/map-layer-definition.ts](../../src/definitions/map-layer-definition.ts), [src/index.ts](../../src/index.ts), [src/math/distance.ts](../../src/math/distance.ts), [src/math/intersection-bounds.ts](../../src/math/intersection-bounds.ts), `src/math/point.ts` (replaced by `point2.ts`/`point3.ts` in the migration), [src/objects/map-layer.ts](../../src/objects/map-layer.ts), [src/objects/map-point.ts](../../src/objects/map-point.ts), [src/spatial/clipped-appearance.ts](../../src/spatial/clipped-appearance.ts), [src/spatial/geometry.ts](../../src/spatial/geometry.ts), [src/spatial/intersection.ts](../../src/spatial/intersection.ts), [src/spatial/scene-geometry.ts](../../src/spatial/scene-geometry.ts), [src/spatial/spatial.ts](../../src/spatial/spatial.ts), [src/validators/intersection-bounds.validator.ts](../../src/validators/intersection-bounds.validator.ts), [src/validators/map-point.validator.ts](../../src/validators/map-point.validator.ts), [src/validators/point.validator.ts](../../src/validators/point.validator.ts).
- Application: [examples/index.html](../../examples/index.html).
- Regressions: [tests/automatic-layers.test.ts](../../tests/automatic-layers.test.ts), [tests/browser/intersection.browser.test.ts](../../tests/browser/intersection.browser.test.ts), [tests/browser/layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [tests/e2e/example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts), [tests/intersection.test.ts](../../tests/intersection.test.ts), [tests/layers.test.ts](../../tests/layers.test.ts), [tests/map-element.test.ts](../../tests/map-element.test.ts), [tests/map-model.test.ts](../../tests/map-model.test.ts), [tests/map-object-collection.test.ts](../../tests/map-object-collection.test.ts), [tests/map-point.test.ts](../../tests/map-point.test.ts), [tests/map-route.test.ts](../../tests/map-route.test.ts), [tests/spatial.test.ts](../../tests/spatial.test.ts), [tests/z.test.ts](../../tests/z.test.ts).
- Contract and status: [docs/DESIGN_MAIN.md](../../docs/DESIGN_MAIN.md), [docs/design/GEOMETRY_AND_ROUTES.md](../../docs/design/GEOMETRY_AND_ROUTES.md), [docs/design/LAYERS_AND_INTERACTION.md](../../docs/design/LAYERS_AND_INTERACTION.md), [docs/design/PROTOTYPE.md](../../docs/design/PROTOTYPE.md), [docs/design/RENDERER_AND_COMPONENT.md](../../docs/design/RENDERER_AND_COMPONENT.md), [docs/design/RUNTIME_AND_LOADING.md](../../docs/design/RUNTIME_AND_LOADING.md).

## Explicit-layer first stage — implemented for review, 2026-10-08

Current status: merged, confirmed by the user on 2026-10-08 after the review fixes.

The authorized stage implements direct ID-based content, backgrounds, composition,
visibility and consistent picking on the existing invalidation foundation.
`map.layers` exposes runtime layers; stable `layer.objectIds.add/remove/has` controls
membership and `layer.objects` returns frozen current roots. Layers are mandatory,
without a default or flat compatibility layer. See the
[public contract](LAYERS_AND_INTERACTION.md#explicit-layers--accepted-and-implemented-for-review-2026-10-08)
and [renderer boundary](RENDERER_AND_COMPONENT.md#layer-display-and-invalidation--implemented-for-review-2026-10-08).

Factory now has a background-only layer and two independently toggled content layers
sharing one runtime route. Editing its point updates both displays; click details
identify the object, owning route when applicable, and hit layer. Existing dynamic
add/remove/detached-edit/restore controls use explicit ID membership. The built-example
e2e covers both appearances and picking after layer switches. Benchmark examples
are migrated to explicit content layers and select added IDs; historical measurement
artifacts remain unchanged. No new Atlas/Leaflet benchmark or speed claim is included.

The next automatic `intersectionBounds`/z/clipping stage is now implemented for
review above, preserving direct-content meaning, source geometry and runtime/event
identity. Bounds rejection was the first-stage boundary and is superseded. Volumetric zones, materials, labels, batch,
LOD, layer groups and public standalone model lifecycle remain later work. Physical
mobile and full prototype/load validation remain outstanding.

Validation on 2026-10-08: `npm run check`, `npm test` (130 Node tests),
`npm run test:browser` (57 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built-example smoke test) passed. Lint has no errors;
non-blocking duplicate-string warnings remain. Library declarations were also
inspected: runtime layer and ID-collection construction stays internal, with only
their types exported. The background-free replacement regression verifies display
after pending frames finish and unchanged camera center/zoom. Built stress Preview
with 3000 points, a short `position-single` Run and Atlas SVG sparse smoke also pass.
Post-review functional checks also cover sparse smoke for all three comparison
variants and all four stress Preview scenes. These are functional checks, not new
performance measurements.

### Files in this implementation review

The PR also includes the current Geometry and routes and Materials decisions.

- Runtime and loading: [src/components/map-element/map-element.ts](../../src/components/map-element/map-element.ts), [src/definitions/map-definition.ts](../../src/definitions/map-definition.ts), [src/definitions/map-layer-definition.ts](../../src/definitions/map-layer-definition.ts), [src/index.ts](../../src/index.ts), [src/interaction/object-click-event.ts](../../src/interaction/object-click-event.ts), [src/objects/map-layer-object-id-collection.ts](../../src/objects/map-layer-object-id-collection.ts), [src/objects/map-layer.ts](../../src/objects/map-layer.ts), [src/objects/map-model.ts](../../src/objects/map-model.ts), [src/renderers/renderer.ts](../../src/renderers/renderer.ts), [src/renderers/svg/svg-renderer.ts](../../src/renderers/svg/svg-renderer.ts), [src/renderers/svg/svg-renderer.utils.ts](../../src/renderers/svg/svg-renderer.utils.ts), [src/spatial/scene-geometry.ts](../../src/spatial/scene-geometry.ts), [src/spatial/spatial.ts](../../src/spatial/spatial.ts), [src/validators/layer-object-id.validator.ts](../../src/validators/layer-object-id.validator.ts).
- Application and benchmark input migration: [examples/comparison.adapter.ts](../../examples/comparison.adapter.ts), [examples/comparison.bench.ts](../../examples/comparison.bench.ts), [examples/comparison.leaflet.ts](../../examples/comparison.leaflet.ts), [examples/index.html](../../examples/index.html), [examples/stress.bench.ts](../../examples/stress.bench.ts), [examples/stress.check.ts](../../examples/stress.check.ts), [examples/stress.instrument.ts](../../examples/stress.instrument.ts), [examples/stress.scene.ts](../../examples/stress.scene.ts).
- Regressions and explicit-layer fixtures: [tests/browser/fixtures.ts](../../tests/browser/fixtures.ts), [tests/browser/layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [tests/browser/map-element.browser.test.ts](../../tests/browser/map-element.browser.test.ts), [tests/browser/svg-renderer.browser.test.ts](../../tests/browser/svg-renderer.browser.test.ts), [tests/e2e/example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts), [tests/fixtures.ts](../../tests/fixtures.ts), [tests/layers.test.ts](../../tests/layers.test.ts), [tests/map-element.test.ts](../../tests/map-element.test.ts), [tests/map-model.test.ts](../../tests/map-model.test.ts), [tests/map-object-collection.test.ts](../../tests/map-object-collection.test.ts), [tests/scene-invalidation.test.ts](../../tests/scene-invalidation.test.ts), [tests/spatial.test.ts](../../tests/spatial.test.ts).
- Current contract and status: [docs/DESIGN_MAIN.md](../../docs/DESIGN_MAIN.md), [docs/design/LAYERS_AND_INTERACTION.md](../../docs/design/LAYERS_AND_INTERACTION.md), [docs/design/PROTOTYPE.md](../../docs/design/PROTOTYPE.md), [docs/design/RENDERER_AND_COMPONENT.md](../../docs/design/RENDERER_AND_COMPONENT.md), [docs/design/RUNTIME_AND_LOADING.md](../../docs/design/RUNTIME_AND_LOADING.md).

[Main navigation](../DESIGN_MAIN.md)

## Goal — agreed

Validate the idea, identify limitations, and clarify or determine the next steps.
Do not try to finish all design work in advance: the prototype should allow mistakes
and architectural corrections based on a working example.
A final public API and polished UI are not the goals of this stage.

## Scope — agreed

- One map with several buildings and layers, with local floor switching.
- Backgrounds, markers, lines, routes, and zones.
- Clipping validation, including vertical polygon extrusion.
- SVG renderer, camera, events, and an external description panel.
- Runtime objects, incremental updates, and batch.
- Minimal materials with explicit inheritance.
- Property registration using a label as the example.
- Desktop/mobile validation and loads of 3000/5000 objects.
- A complex behavior system, full editor, and 3D renderer are outside this stage.

## Expected outcome — agreed

Validated subsystem boundaries; identified limitations; necessary contract changes;
and a justified direction for the next steps.
Accepting this scope does not itself settle previously open signatures,
the layer-group contract, or the complete volumetric-zone schema.

## Revised implementation plan — solution review, 2026-10-06

This replaces the earlier proposed sequence following solution-review findings 5–18.
The agreed prototype scope remains unchanged. The sequence is the working plan;
architecture details, new public signatures, ownership restrictions, and tooling
choices still require their own review. No implementation is authorized by this document.

The initial vertical slice is implemented: background, camera/input, points, lines,
routes, runtime edits, and application events. The next work must validate the risky
parts of the prototype rather than expand route editing or ID handling. Freeze further
route-operation and ID-API expansion; preserve existing behavior. Range replacement
remains recorded as implemented for review, not automatically approved by this plan.

1. **Protect current behavior with focused tests (finding 15).** Choose the test runner
   and component-test environment as a concrete tooling step. Model/spatial/camera
   regression tests are merged: Vitest with the Node environment (77 tests).
   Component load/lifecycle contract tests using browser stand-ins are merged with
   the scene extraction in PR #23. Real-SVG Chromium coverage is implemented for
   review: 16 renderer tests and 13 focused component integrations. See
   [browser coverage](RENDERER_AND_COMPONENT.md#browser-svg-regression-coverage--implemented-for-review-2026-10-06).
   This protects current results and surviving nodes before explicit invalidation;
   it does not validate mobile support or bounded geometry writes. Cover validation atomicity,
   route membership/order and surviving identity, immediate picking before render,
   stale-click suppression, detach/reconnect, reattachment during removal handlers,
   failed-load preservation, and camera behavior. Start with DOM-independent model,
   spatial, and camera tests; use component tests for browser-boundary behavior.
   These tests must run before and after the following refactors.
2. **Establish an early load baseline (findings 10, 16–18).** Add a reproducible stress
   example for 3000 and 5000 root objects, with documented point/line/route counts and
   owned-vertex counts. Measure initial load, mass additions/removals, pan, zoom,
   hit testing, and individual geometry edits. Record frame timing, SVG attribute
   writes, scene synchronization work, and repeated layout reads where useful.
   Record device/browser and distinguish synthetic desktop results from actual mobile
   measurements. Do this before optimization so the next steps have a comparison.
3. **Separate scene ownership from the browser view (finding 8).** Extract the current
   object collection, scene geometry, spatial queries, and their subscriptions into
   a DOM-independent model with a concrete consumer: the existing component.
   Keep camera, renderer, input, client-coordinate conversion, and browser lifecycle
   at the view boundary. Preserve atomic scene replacement after successful load.
   The bounded ownership extraction is now implemented for review as internal
   `MapModel`; see the status below. Public model lifetime/exposure remains a separate
   decision. Multiple simultaneous viewports remain outside mandatory prototype scope.
4. **Make updates explicit and bounded (findings 9, 10, 17, 18).** Replace structural
   scans in geometry reads with explicit invalidation from root membership, route
   membership/order, and position changes. Select the simplest internal revision or
   dirty-state mechanism under review; a new public event payload API is not a
   prerequisite. Picking must still see current state before painting, including
   disconnected edits and synchronous handlers. Preserve surviving entries/nodes.
   Update SVG geometry only for affected objects; pan should update the view without
   rewriting unchanged object geometry, and zoom should update only the output that
   depends on screen scale. Address repeated membership scans, collection-copy costs,
   and layout reads using baseline evidence. Do not claim a Set alone fixes immutable
   array copying. Rerun the same load scenes and record before/after results.
5. **Validate layers, z, and clipping as the next feature (findings 6, 11).** First
   review the minimal scene/renderer contract with explicit layer object lists,
   optional bounds for automatic intersections, backgrounds,
   composition order, clipping, and picking eligibility together. Avoid cementing
   the current separate background argument or flat list as the final scene API.
   The [outer map structure](LAYERS_AND_INTERACTION.md#accepted-map-structure--2026-10-08)
   is accepted: common object definitions, a layers array, layer object-ID lists,
   layer backgrounds, and optional `intersectionBounds`. Omitted object lists are
   empty, layers start visible, unknown references reject loading, and references
   select all matching root instances. The first stage above settles mandatory
   explicit layers and direct runtime membership. Adding/removing/reordering layers
   and direct/automatic appearance precedence remain outside that implemented stage.
   Build two buildings with independent floor selection, a connecting route, and
   a vertically extruded zone with slices. Validate that clipping retains original
   object identity and source geometry. The 2026-10-08 [layer clarification](LAYERS_AND_INTERACTION.md#layer-contract-clarification--2026-10-08)
   accepts automatic display clipping of a whole route without manual floor subdivision
   or new runtime points at cuts. Repeat the load measurements with layers,
   labels when available, and a heavy background. This is the central prototype
   validation gate; broader API work must not postpone it.
6. **Complete the remaining agreed slice.** Add synchronous nested batch, minimal
   materials with explicit inheritance, and the label registration example in
   separate reviewable steps. Reuse the update boundaries established above.
   Complete desktop/mobile input and accessibility validation, then document the
   prototype's demonstrated limits and justified next steps.

Each implementation substep needs its relevant checks and concrete mini review.
Commit authorization follows the repository instructions; this plan does not grant it.
Numerical performance targets must be agreed before calling the load gate passed.
If SVG falls short, use measurements to choose a bounded correction or document a
limitation; neither `<use>` nor a different renderer is selected in advance.

## Scene-ownership substep — implemented for review, 2026-10-06

The user authorized only the first architecture substep: internal DOM-independent
scene ownership with current public behavior preserved. `MapModel` owns the resolved
input snapshot, runtime collection, prepared geometry, spatial queries and observation;
`MapElement` remains the viewport/browser consumer. See the
[concrete boundary and lifecycle](RENDERER_AND_COMPONENT.md#internal-scene-model--accepted-2026-10-06-implemented-for-review).

The committed regression foundation uses Vitest in Node. Focused model tests and
component load/lifecycle/stale-click contract tests are added in the same tooling,
without new dependencies. Component tests supply minimal browser stand-ins and a
renderer double. Seven additional real DOM/SVG checks passed in the Codex in-app
browser, including surviving nodes, reconnect and failed image preparation. The
model imports and queries without DOM or renderer globals. Physical mobile testing
remains outstanding.

This extraction preserves current geometry synchronization rather than implementing
step 4. Public model lifecycle/core entry point, explicit invalidation/revisions,
SVG performance work and later prototype features remain unimplemented. No benchmark
or speed claim belongs to this substep; stress-baseline work is separate. Mini review
and separate commit authorization are still required.

## Explicit invalidation substep — implemented for review, 2026-10-07

Step 4 is implemented on `origin/master` at `1c2e54b`, which already contains
`MapModel`, the real-SVG browser regressions, and the Atlas benchmark. Internal
mutation marks replace unchanged structural scans; the renderer updates affected
entries and separates viewport/viewBox from screen-scale changes. See the
[mechanism and lifecycle](RENDERER_AND_COMPONENT.md#explicit-scene-invalidation--implemented-for-review-2026-10-07).
The work is prepared for PR after mini review. The original Node/browser tests passed
on the combined base; after the reattachment review correction, 110 Node and 40 browser tests, check, and both builds passed.

The same four Atlas scenes and full scenario suite were measured before and after,
with separate timing and instrumentation before the reattachment correction. Its newer functional/counter checks are recorded separately; the old CSV/manifests remain unchanged. See [results and limits](../performance/INVALIDATION.md).
Initial load, mass updates, and membership operations are assessed alongside camera
and individual edits. Numerical targets remain unapproved; this does not complete
the prototype load gate, actual mobile testing, or layers/z/clipping validation.
Leaflet work is independent and unchanged.

## Contract and documentation follow-up

- **Current contract summary (finding 7):** consolidate a short description of the
  implemented public contract, distinguishing merged behavior, work under review,
  temporary contracts, and future design. Move superseded history to linked archives
  without deleting original documents. Start with the boundaries touched by the
  plan; do not require a full documentation rewrite before prototype validation.
- **Ownership/sharing (finding 12):** existing instance attachment and shared-point
  behavior remain accepted. Review their concrete consumer, lifetime, and eventual
  export semantics during the model-boundary step. Single ownership or unsupported
  shared export are alternatives requiring a user decision, not changes adopted
  from the review. Do not add more sharing machinery meanwhile.
- **Validation/constructors (finding 13):** inventory public construction paths and
  choose one clear validation/copying boundary before changing constructors. Keep
  validation at every public input boundary while avoiding redundant validation of
  trusted internal data. Constructor signature unification is a proposal, not a
  prerequisite or an approved breaking change.
- **Geometry dispatch (finding 14):** when zones introduce the next geometry kind,
  review where kind-specific logic belongs within each subsystem. Consolidate only
  repeated logic with a concrete consumer; no plugin registry or generic extension
  framework is planned.
- Findings 5–7 establish direction and scope discipline. Findings 8–11 and 15–18
  drive the ordered work above; findings 12–14 remain bounded decision points.

## Proposed verifiable success criteria

- Switching one building's floor does not change another building's selected view.
- Clipping does not change source geometry; events identify the original object and layer.
- Runtime object changes appear on the map; batch combines rendering updates.
- Materials and the label extension require no changes to SVG renderer business logic.
- The external application handles events and displays descriptions without accessing
  the renderer's internal DOM.
- Load scenes measure pan/zoom, hit testing, layer switching, object updates, and loading;
  the device, browser, and scene composition are recorded.
  Numerical performance thresholds are not yet approved.
- Problems and decision changes are documented rather than concealed by a more complex API.

These are proposed working steps and criteria, not additional approved requirements.
Source-map research: [TARKOV_MAP_AUDIT.md](../TARKOV_MAP_AUDIT.md).

## Benchmark step one — implemented for review, 2026-10-06

A standalone real-browser Atlas SVG benchmark now exercises deterministic 3000/5000
root point-only and mixed point/line/route scenes with the current Factory background.
Load, pan, zoom, internal picking, geometry edits, add/remove, route membership, and
wheel dispatch are measured before runtime architecture changes. Production timing
and intrusive counters are separate. See [baseline and method](../performance/BASELINE.md).
Leaflet SVG/Canvas comparison is pending the user's approval of step one. Mobile,
layers/z/clipping, labels, and full prototype validation remain outstanding; no
numerical load gate has been passed or new architecture contract accepted.
