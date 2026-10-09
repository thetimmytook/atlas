# Atlas — main design navigation

## How to read

Start here, then open only topics relevant to the current task.
The user leads design; the assistant validates and advises. Implementation has started
with the component shell, map definition, and camera, under step-by-step review. Discuss broad blocks and preserve specific ideas as decisions or open
decision points. Do not turn API examples into approved signatures.
When an answer covers several topics, use continuous numbering so the user can
refer to a number without copying text. Numbering starts at 1 after this clarification;
continue between answers rather than relying on HTML anchors.

## Current foundation

Read [Current contract](design/CURRENT_CONTRACT.md) for the short public-contract
baseline, checked on 2026-10-09 against merged `bc87449`. It distinguishes
implemented/merged behavior, temporary implemented contracts, accepted future work
and open/deferred decisions. The topic documents below retain decision history;
illustrative future APIs do not extend the available exports.

- Desktop/mobile map viewing is the goal; SVG is the current renderer, and real 3D
  remains future work. Framework adapters, editor and application UI are separate consumers.
- Merged object kinds are `point`, `line`, `route`, `polygon`: `MapPoint`, `MapLine`,
  `MapRoute`, `MapPolygon`, with corresponding definitions. Internal geometry views
  and spatial picking are renderer-independent.
- Frozen `Point2` serves planar coordinates; runtime point positions use `Point3`.
  Position assignment replaces all coordinates; omitted z becomes 0. Polygon
  contours contain only x/y, with independent `baseZ`/`height` and positive-area clipping.
- Layers are explicit and required. Direct ID membership selects whole roots;
  optional `intersectionBounds` derives clipped appearances, with direct content
  taking priority. Visibility and hit-layer context are implemented. Duplicate root
  IDs are accepted: a layer selects all matches, while `get(id)` returns the first.
- Runtime additions/attachments/removals and route point editing are merged.
  `map.definition` remains an immutable resolved load snapshot, not live export.
- `press`, `release`, `objectclick` and the JavaScript `clickTrigger` property are
  implemented. A first-hit press consumes the gesture; the second-pointer defect
  and bounded route-membership invalidation fixes remain under review.
- Internal `MapModel` ownership and explicit scene invalidation are merged.
  Scene changes still have one consumer. Temporary background, appearance and
  notification contracts are listed separately in [Current contract](design/CURRENT_CONTRACT.md#temporary-implemented-contracts).
- Accepted but unimplemented: route geometry/symbol/picking separation (including
  no-symbol/no-point-picking defaults), batch, minimal materials, labels/property
  registration, resource registry, schemaVersion, homeView and camera constraints.
  Current route vertices still display/pick temporary symbols when eligible.
- Public core/model lifecycle, multiple viewports, live export and unfinished API
  schemas remain open/deferred. No ID registry, new tooling policy or architectural
  requirement follows automatically from a review finding.

## Topic documents

| Topic                                                   | Document                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| Verified current public contract                        | [Current contract](design/CURRENT_CONTRACT.md)                       |
| Use cases and responsibility boundaries                 | [Scope](design/SCOPE.md)                                             |
| Coordinates, objects, IDs, and routes                   | [Geometry and routes](design/GEOMETRY_AND_ROUTES.md)                 |
| Layers, clipping, hit testing, screen sizes             | [Layers and interaction](design/LAYERS_AND_INTERACTION.md)           |
| Camera, constraints, homeView                           | [Camera](design/CAMERA.md)                                           |
| Runtime, loading, updates, batch, route operations      | [Runtime and loading](design/RUNTIME_AND_LOADING.md)                 |
| Materials and open alter/replace/reset questions        | [Materials](design/MATERIALS.md)                                     |
| Registration, labels, deprecation, validator            | [Properties and labels](design/PROPERTIES_AND_LABELS.md)             |
| Renderer and component lifecycle                        | [Renderer and component](design/RENDERER_AND_COMPONENT.md)           |
| Console logging                                         | [Diagnostics](design/DIAGNOSTICS.md)                                 |
| Resources and serialization                             | [Resources and serialization](design/RESOURCES_AND_SERIALIZATION.md) |
| Agreed first-prototype scope                            | [Prototype](design/PROTOTYPE.md)                                     |
| Browsers, accessibility, keyboard, and load reference   | [Platforms and performance](design/PLATFORMS_AND_PERFORMANCE.md)     |
| Distant future of the appearance system                 | [Exploration](MATERIAL_SYSTEM_EXPLORATION.md)                        |
| Research into all tarkov.dev maps, not new requirements | [Map audit](TARKOV_MAP_AUDIT.md)                                     |

For the proposed platform matrix, reproducible scenarios and evidence protocol,
see the [Platform acceptance plan](validation/PLATFORM_ACCEPTANCE_PLAN.md).

Topic files retain clarification history. [Current contract](design/CURRENT_CONTRACT.md)
and explicit later accepted corrections take precedence over superseded wording.
Updating this baseline does not approve pending runtime work or unfinished API examples.

## Where we stopped

Polygon/extrusion PR #30 is merged. The current work is the
[Repeat-review follow-up](design/PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09):
representative baseline, two bounded runtime fixes under review, identical measurements
after integration, then the remaining agreed prototype slice. Current-contract
consolidation is documented here and in [Current contract](design/CURRENT_CONTRACT.md).
Performance documents belong to that separate measurement work; no new load-gate
result or merged status for pending runtime changes is implied.

## Implementation history — original review stages

The dated notes below retain the implementation sequence and working links. Earlier
review-stage wording is historical; current status is the contract baseline above.
Findings 5–18 came from the earlier conversation and are not stored in this repository;
those numbers are historical context, not independently resolvable requirements.
The saved [repeat review, findings 19–33](archive/SOLUTION_REVIEW_2026_10_09.md)
and its accepted follow-up are available locally.

The first explicit-layer stage is merged, as confirmed by the user on 2026-10-08:
direct ID membership, layer backgrounds, composition,
independent visibility, shared-object updates and hit-layer event context. See
[scope and next step](design/PROTOTYPE.md#explicit-layer-first-stage--implemented-for-review-2026-10-08).
Automatic intersections/z/clipping and the `Point2`/`Point3` migration are merged,
as confirmed by the user on 2026-10-09. See
[the current stage, checks and changed files](design/PROTOTYPE.md#coordinate-migration--implemented-for-review-2026-10-09).
The source route/points, merged layer behavior, local decision edits and historical
benchmark artifacts are preserved. The accepted polygon/extrusion contract is now
merged in PR #30, including strict x/y contour input, atomic vertical
setters, positive-area clipped appearances and the combined two-building example. See
[the contract and next steps](design/PROTOTYPE.md#polygon-and-extrusion-contract--accepted-2026-10-09).
The accepted next steps after the repeat review are a representative load baseline,
bounded route-membership invalidation and gesture corrections, the same measurements
after integration, and current-contract consolidation. The two corrections and
documentation can proceed with separate file ownership after baseline capture.
Batch, materials and labels follow this validation work. See the
[current follow-up plan](design/PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09).

Possible shared generic storage for the root and layer-ID collections is recorded
as [deferred exploration](design/RUNTIME_AND_LOADING.md#shared-generic-collection-storage--deferred-exploration-2026-10-08).
Its implementation and public contract remain undecided.

The 2026-10-06 solution review (findings 5–18) revised the then-current plan:
merged model/spatial/camera regression tests → Atlas baseline and Leaflet comparison
under mini review → DOM-independent
scene ownership (merged) → explicit invalidation and affected SVG updates (subsequently merged in PR #27) → layers/z/clipping
validation → remaining batch/material/label and platform work. See the
[revised prototype plan](design/PROTOTYPE.md#revised-implementation-plan--solution-review-2026-10-06).
Internal `MapModel` ownership and browser SVG regression tests are merged in PRs #23
and #24. Explicit scene invalidation and affected SVG updates subsequently merged in PR #27,
with public behavior preserved. See the
[implementation status](design/PROTOTYPE.md#explicit-invalidation-substep--implemented-for-review-2026-10-07)
and [comparable Atlas before/after measurements](performance/INVALIDATION.md).
Public model lifecycle and a core entry point remain separate work.
Further route-operation and ID-API expansion is paused. Existing accepted contracts
remain in effect; ownership restrictions, constructor changes, browser-test environment
and new public model/renderer signatures require separate review. Performance claims need measured
results and agreed numerical targets. This plan does not authorize implementation.

The reproducible browser stress example and Atlas SVG baseline merged in PR #22;
the 2026-10-06 stage is recorded in [method and results](performance/BASELINE.md). The benchmark step itself left
runtime architecture unchanged.
The separately requested Leaflet SVG/Canvas comparison merged in PR #25:
[method, fresh Atlas/Leaflet results and limitations](performance/LEAFLET_COMPARISON.md).
Mobile and full prototype scope remain unvalidated.

At the 2026-10-07 invalidation stage, the combined base passed 103 Node and 29
browser tests; the corrected implementation passed 110 Node and 40 browser tests, including actual SVG
mutation boundaries and synchronous/disconnected picking. Full before/after measurements predate the reattachment review correction, whose functional/counter evidence is separate. This desktop Chromium
run does not complete mobile/prototype validation.

A basic internal web-library setup has been prepared: [tooling](TOOLING.md).
Project-check GitHub Actions and one smoke test of the built Factory example are
merged in PR #26; execution of a GitHub Linux run was not verified by this documentation task. See
[CI and e2e](TOOLING.md#ci-and-built-example-smoke-test).
The Web Component shell and Factory background with `MapDefinition` are merged.
Camera center/zoom, fit, and example buttons are merged. Mouse/touch controls and
map/client coordinate conversion are merged; see
[camera status](design/CAMERA.md).
Point geometry display, mutable runtime objects, object click/tap events, and the
external example panel are merged; see
[object interaction](design/LAYERS_AND_INTERACTION.md#first-surface-events-and-object-clicktap--merged).
Hit testing has moved out of the renderer into the internal spatial subsystem;
both consume shared scene geometry. This refactor is merged; see
[spatial implementation](design/RENDERER_AND_COMPONENT.md#spatial-implementation--merged).
Straight line geometry, SVG display, spatial picking, and runtime endpoint updates
are merged; see [line geometry](design/GEOMETRY_AND_ROUTES.md#line-geometry--merged).
Route loading, point-ID resolution, polyline display, and point/path interaction
are merged in PR #13. `MapRoute.addPoint` is merged in PR #14: append a copied
point definition, replace the readonly point array, and update SVG and spatial picking.
`addLine` is removed from route plans. Point insertion and removal are merged in
PR #19: `insertPoint(index, definition)` copies a point, and `removePoint(point)`
detaches the exact owned instance. Internal geometry now follows current membership
and order while reusing surviving coordinate views and SVG nodes. Range replacement
is merged in PR #20: `replacePoints(startIndex, endIndex, definitions)` replaces
`[startIndex, endIndex)` in one operation and returns the new points. It validates all
input before changing membership and preserves outside instances and IDs. The example
can insert/remove a middle point and replace the route interior while retaining endpoints.
Event payloads and `map.batch` remain separate steps after the validation foundations
in the revised prototype plan. See
[range replacement](design/RUNTIME_AND_LOADING.md#route-point-range-replacement--accepted-2026-10-06-implemented-for-review).
See [route append](design/RUNTIME_AND_LOADING.md#route-append--accepted-2026-10-05-implemented-for-review).
Dynamic root-object addition through `map.objects.add` is merged in PR #15.
It uses the same validation, copying, and ID generation as loading; existing scene
entries and SVG nodes are reused. The example adds and moves an independent point.
Root removal through `map.objects.remove(object): boolean` is merged in PR #16.
It uses reference identity, updates scene membership and SVG, and releases the map's
change subscription while keeping the detached instance usable. The example can
remove the added point. Root removal does not edit a route's owned-point membership.
Runtime-instance attachment through `map.objects.add(instance)` is merged in PR #17.
It preserves root and owned-point references, permits use in multiple maps,
and resumes observation after removal. The example moves a detached point and restores
it. A shared point has separate scene entries for its root and route-owned appearances.
PR #18 fixes subscription cleanup when a removal handler disconnects the component.
`MapRouteDefinition` uses `points` directly; the runtime derives polyline geometry. `RouteLine`, `RouteLines`, and endpoint snapping are removed.
See [route polylines](design/GEOMETRY_AND_ROUTES.md#route-polylines-and-point-identity--accepted-2026-10-05).
All JSON objects explicitly declare their structural kind. Scene entries separate
live geometry from runtime identity. Scene entries and click events preserve the
`MapEntry` union, allowing narrowing by `kind`. A path click returns its `MapRoute`; a vertex
click returns its `MapPoint` with the owning route. Point symbols use temporary
appearance defaults independent of whether IDs were supplied or generated.
Map-object definitions and runtime classes now use the `Map` prefix consistently.
Standalone and route-owned points share `MapPointDefinition` (`id?`, `kind: 'point'`,
`position: { x, y }`) and `MapPoint`. Changing an owned point notifies its owner and
the component; internal geometry views read the current position without being
rebuilt. Route point appending is merged in PR #14; insertion/removal are merged in PR #19,
and range replacement is merged in PR #20. See
[shared point object and naming](design/GEOMETRY_AND_ROUTES.md#shared-point-object-and-naming--accepted-2026-10-05).
Independent lines now use `MapLineDefinition` / `MapLine` with `kind: 'line'`.
The generic geometry-object wrapper and standalone polyline loading are removed;
`PolylineGeometry` remains route geometry. See
[concrete map objects](design/GEOMETRY_AND_ROUTES.md#concrete-map-objects--accepted-2026-10-05).
Point positions and background sizes are grouped under `position` and `size`.
Lines and routes both own points. See
[grouped data](design/GEOMETRY_AND_ROUTES.md#grouped-positions-sizes-and-owned-points--accepted-2026-10-05).
Runtime geometry accessors are removed: points expose `position`, and owners forward
changes without rebuilding geometry. Stable internal spatial views read those
positions. See [object positions](design/GEOMETRY_AND_ROUTES.md#object-positions-and-internal-geometry-views--accepted-2026-10-05).

The first architecture pass is sufficient to proceed to prototype validation.
The user agreed to the prototype scope and goal: validate the idea, identify
limitations, and clarify next steps. Not every question needs closing before implementation.
The assistant's latest numbered points were 3 (scope) and 4 (outcome), both confirmed;
continue numbering from 5.
The runtime/renderer boundary and Web Component lifecycle foundation are agreed.
Resize changes viewport dimensions while preserving center and zoom without refitting.
The resource registry, pluggable loader, and map-document contents are accepted but unimplemented;
executable configuration stays outside JSON. Modern browsers, mouse/touch, and basic
accessibility are confirmed; keyboard handlers remain an open question.
The prototype load reference is 3000/5000 objects. All tarkov.dev map configurations,
data, and an overview of primary screens were studied; findings are stored separately.
Both building-view scenarios are useful, but UI, Escape, and Back belong to the application.
Multiple-map/viewport mechanisms and layer groups remain decision points.
Explicit layers use stackIndex for composition; no default is created. Responsiveness and zone extrusion are noted
for subsequent design work.

## Major remaining blocks

1. Complete lifecycle, public API, and the agreed event contract.
2. Consolidate minimal material/property/label contracts while preserving decision points.
3. Refine resources and Map JSON export contents (schemaVersion is accepted).
4. Browser, accessibility, input, and expected data-volume requirements.
5. Prototype scope is agreed; refine measurable criteria and limitations through validation.
6. Maintain the current-contract baseline and mark superseded variants without losing history.

## Sources and history — do not read in full unnecessarily

- [Repeat solution review, findings 19–33, 2026-10-09](archive/SOLUTION_REVIEW_2026_10_09.md).
  User-supplied reviewer report preserved verbatim; its relative file paths refer
  to the repository root. The [accepted triage and next-work sequence](design/PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09)
  distinguish confirmed gaps from proposed remedies; the report does not itself
  authorize implementation.
- [Original architecture draft](ATLAS_DESIGN_ORIGINAL.md).
- [Complete pre-split log](archive/DESIGN_DECISIONS_PRE_SPLIT.md) — an archive,
  not a current source of decisions; its decisions are not updated after the split.
- [Original pre-design PDF](references/pre-design.pdf).

## Maintaining the documents

Record new decisions in the relevant topic; update only the main summary, navigation,
and current stage here. Distinguish accepted decisions from proposals.
Historical wording must not override new decisions. Do not begin implementation
solely on the basis of architectural discussion.
