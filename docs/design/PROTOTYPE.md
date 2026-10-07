# First Atlas prototype

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
   review the minimal scene/renderer contract with layer content, backgrounds,
   composition order, clipping, and picking eligibility together. Avoid cementing
   the current separate background argument or flat list as the final scene API.
   Build two buildings with independent floor selection, a connecting route, and
   a vertically extruded zone with slices. Validate that clipping retains original
   object identity and source geometry. Repeat the load measurements with layers,
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
