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

- Desktop/mobile, map viewing; the editor is a separate library consumer.
- Serializable JSON and runtime instances with behavior are separate.
- One `MapDefinition` may be reused to initialize multiple map instances. See
  [definition reuse](design/RUNTIME_AND_LOADING.md#map-definition-reuse--accepted-2026-10-06).
- Every object shares `MapObjectDefinition` (`id?`, `kind`) and the runtime `MapObject`
  base (identity and events). `MapPoint`, `MapLine`, and
  `MapRoute` specialize this foundation. Independent, line-owned, and route-owned points use
  the same `MapPointDefinition` / `MapPoint` pair. Materials and other common properties will
  extend it when their contracts are implemented.
- Atlas objects contain geometry; marker/zone semantics belong to the application.
- Internal `Geometry` views cover point, line, and polyline forms. Compound geometry is deferred
  until a concrete use case needs it. Routes use `polyline` with ordered,
  identifiable points; consecutive points define connected segments without line objects.
  Owners keep behavior and validation. See
  [route polylines](design/GEOMETRY_AND_ROUTES.md#route-polylines-and-point-identity--accepted-2026-10-05).
- Route vertices keep position, symbol appearance, and separate point picking independent.
  They default to no symbol and no separate point picking; bends still shape the path.
  Point-of-interest appearance and interaction are explicitly assigned; exact fields remain open.
  See [the accepted separation](design/GEOMETRY_AND_ROUTES.md#route-vertex-geometry-symbol-and-picking--accepted-2026-10-08).
- Application classification lives in `data.type`, with no separate object-level
  `type` field. `kind` remains structural. See
  [classification decision](design/GEOMETRY_AND_ROUTES.md#application-classification--accepted-2026-10-05).
- Coordinates: x right, y down, z up. SVG first; real 3D is a future direction.
  The automatic-intersection stage now uses frozen `Point2` for camera/input/query
  coordinates and `Point3` for runtime spatial positions and clipped geometry.
  Position input accepts either type; omitted height becomes zero. The former
  `Point` export is removed. See [the accepted coordinate migration](design/GEOMETRY_AND_ROUTES.md#planar-and-spatial-coordinates--accepted-and-implemented-for-review-2026-10-09).
- `MapDefinition.objects` holds object definitions; required `MapDefinition.layers` declares layers.
  Each layer's `objects` lists IDs for ordinary full content; optional `intersectionBounds`
  lets the engine find and clip geometry from the common collection automatically.
  Omitted lists are empty; unknown references reject loading, and duplicate root IDs
  select all matching instances for layer content.
  Direct content, backgrounds, order and visibility are now merged;
  no default layer or flat input is accepted. Runtime membership uses stable
  `layer.objectIds.add/remove/has`; `layer.objects` exposes frozen current direct roots.
  `intersectionBounds` is now implemented for review with shared clipped display/picking geometry;
  direct content remains whole and has priority within its layer.
  See [the implemented layer contract](design/LAYERS_AND_INTERACTION.md#explicit-layers--accepted-and-implemented-for-review-2026-10-08).
  No additional intersecting-object input list or separate level concept. See the
  [accepted map structure](design/LAYERS_AND_INTERACTION.md#accepted-map-structure--2026-10-08).
- A background is a layer property; a shared background lives in a separate layer.
  Runtime layers expose `visible` and start visible. A whole route is automatically clipped for each layer
  that supplies `intersectionBounds`; omission leaves ordinary content without automatic clipping.
  Derived cut coordinates create no runtime points or markers. See the
  [layer contract clarification](design/LAYERS_AND_INTERACTION.md#layer-contract-clarification--2026-10-08).
  Supplied bounds must contain at least one coordinate constraint; empty bounds
  are rejected. Boundary picking accounts for the eligible centerline and screen stroke
  thickness, with concrete Node/native Chromium regressions for mini review. See
  [the bounds contract](design/LAYERS_AND_INTERACTION.md#intersection-bounds-contract--accepted-and-implemented-for-review-2026-10-08).
- stackIndex defines composition; it is neither height z nor a substitute for depth in 3D.
- Line and route definitions expose `points` directly; point definitions group
  coordinates in `position`. IDs are optional in input and stable at runtime.
  A line owns exactly two points; route point order guarantees continuity.
- Routes support copied point insertion by index, removal by exact instance, and
  replacement of a half-open index range with copied definitions.
  Surviving points, coordinate views, and SVG nodes retain their identity. See
  [route point editing](design/RUNTIME_AND_LOADING.md#route-point-insertion-and-removal--accepted-2026-10-06-implemented-for-review)
  and [range replacement](design/RUNTIME_AND_LOADING.md#route-point-range-replacement--accepted-2026-10-06-implemented-for-review).
- Validated, copied definitions with completed IDs use `Resolved` / `resolve` names.
  `WithId` requires only the root ID; resolved line and route definitions explicitly
  require IDs on their owned points. See
  [identity types](design/GEOMETRY_AND_ROUTES.md#required-identity-type--accepted-2026-10-05).
  `map.definition` retains this guarantee as `ResolvedMapDefinition | undefined`.
- Missing IDs are generated with `createId()` using `crypto.randomUUID()`.
  Explicit duplicate IDs are accepted; their meaning and prevention belong to the
  application or editor. Runtime objects need no ID registry, injection, or
  uniqueness decorators. Collections retain every object, and `get(id)` returns
  the first matching root object in collection order. See
  [ID handling](design/RUNTIME_AND_LOADING.md#id-handling--accepted-2026-10-06-implemented-for-review).
- `map.objects.add(definition)` appends a copied point, line, or route and returns
  its runtime instance. Rendering and picking observe additions; later instance
  edits update the map. See
  [runtime additions](design/RUNTIME_AND_LOADING.md#runtime-object-addition--accepted-2026-10-06-implemented-for-review).
- `map.objects.add(instance)` attaches an existing `MapPoint`, `MapLine`, or `MapRoute`
  and returns that same reference with its current state and ID. Repeated attachment
  to the same collection changes no membership and emits no event. See
  [runtime instance attachment](design/RUNTIME_AND_LOADING.md#runtime-instance-attachment--accepted-2026-10-06-implemented-for-review).
- `map.objects.remove(object)` detaches the exact root instance and returns whether
  it was present. Rendering, picking, and map subscriptions release it; an externally
  retained reference remains functional. See
  [runtime removal](design/RUNTIME_AND_LOADING.md#runtime-object-removal--accepted-2026-10-06-implemented-for-review).
- Background dimensions use `size: { width, height }`. A future optional third
  dimension is deferred. Runtime objects expose `position` or owned `points`;
  the spatial subsystem prepares live geometry views for rendering and queries.
- Materials are named, with explicit inheritance. Specificity selects one material
  rather than automatically mixing materials across levels. Meta/styles are outdated terms.
- Properties/behaviors are registered in isolated configuration before creating a map.
- label is an explicit data object; the runtime label belongs to its owner and has behavior.
- Synchronous nested batch defers only rendering, without rolling back changes.
- Data/resource loading is strict; a new map replaces the current map only after preparation succeeds.
- Runtime objects form the internal scene representation. Internal `MapModel` now owns
  the definition snapshot, runtime collection, shared geometry, spatial queries and
  scene observation; `MapElement` retains the camera and browser view. This ownership
  extraction is merged in PR #23; see
  [the scene-model boundary](design/RENDERER_AND_COMPONENT.md#internal-scene-model--accepted-2026-10-06-implemented-for-review).
  Explicit internal invalidation and affected SVG updates are now implemented for
  review; see [the mechanism](design/RENDERER_AND_COMPONENT.md#explicit-scene-invalidation--implemented-for-review-2026-10-07).
  Public model lifecycle/core entry point remains unimplemented.
- Framework adapters are separate. The application stores user state.
- Resources are described once in the map registry and referenced by ID;
  a pluggable application loader is provided for.

## Topic documents

| Topic                                                   | Document                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
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

Topic files still retain clarification history: the current summary above and
explicit later corrections take precedence over earlier wording.
Full contract consolidation is a separate future step, not performed automatically.

## Where we stopped

The first explicit-layer stage is merged, as confirmed by the user on 2026-10-08:
direct ID membership, layer backgrounds, composition,
independent visibility, shared-object updates and hit-layer event context. See
[scope and next step](design/PROTOTYPE.md#explicit-layer-first-stage--implemented-for-review-2026-10-08).
Automatic intersections/z/clipping are now implemented for mini review in the primary
repository, with the 2026-10-09 `Point2`/`Point3` migration applied. See
[the current stage, checks and changed files](design/PROTOTYPE.md#coordinate-migration--implemented-for-review-2026-10-09).
The source route/points, merged layer behavior, local decision edits and historical
benchmark artifacts are preserved. Volumetric zones and the other prototype blocks
remain separate future work.

Possible shared generic storage for the root and layer-ID collections is recorded
as [deferred exploration](design/RUNTIME_AND_LOADING.md#shared-generic-collection-storage--deferred-exploration-2026-10-08).
Its implementation and public contract remain undecided.

The solution review (findings 5–18) has revised the next-work plan:
merged model/spatial/camera regression tests → Atlas baseline and Leaflet comparison
under mini review → DOM-independent
scene ownership (merged) → explicit invalidation and affected SVG updates (prepared for PR) → layers/z/clipping
validation → remaining batch/material/label and platform work. See the
[revised prototype plan](design/PROTOTYPE.md#revised-implementation-plan--solution-review-2026-10-06).
Internal `MapModel` ownership and browser SVG regression tests are merged in PRs #23
and #24. Explicit scene invalidation and affected SVG updates are prepared for PR
in the primary repository, with public behavior preserved. See the
[implementation status](design/PROTOTYPE.md#explicit-invalidation-substep--implemented-for-review-2026-10-07)
and [comparable Atlas before/after measurements](performance/INVALIDATION.md).
Public model lifecycle and a core entry point remain separate work.
Further route-operation and ID-API expansion is paused. Existing accepted contracts
remain in effect; ownership restrictions, constructor changes, browser-test environment
and new public model/renderer signatures require separate review. Performance claims need measured
results and agreed numerical targets. This plan does not authorize implementation.

The reproducible browser stress example and Atlas SVG baseline are implemented for
review: [method and results](performance/BASELINE.md). The benchmark step itself left
runtime architecture unchanged.
The separately requested Leaflet SVG/Canvas comparison is implemented for mini review:
[method, fresh Atlas/Leaflet results and limitations](performance/LEAFLET_COMPARISON.md).
Mobile and full prototype scope remain unvalidated.

The combined base passed 103 Node and 29 browser tests before invalidation changes;
the corrected implementation passes 110 Node and 40 browser tests, including actual SVG
mutation boundaries and synchronous/disconnected picking. Full before/after measurements predate the reattachment review correction, whose functional/counter evidence is separate. This desktop Chromium
run does not complete mobile/prototype validation.

A basic internal web-library setup has been prepared: [tooling](TOOLING.md).
Project-check GitHub Actions and one smoke test of the built Factory example are
implemented for review; the first GitHub Linux run remains unverified. See
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
is implemented for review: `replacePoints(startIndex, endIndex, definitions)` replaces
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
and range replacement is implemented for review. See
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
The resource registry, pluggable loader, and map-document contents are accepted;
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
6. Produce a clean specification and move historical variants out of working contracts.

## Sources and history — do not read in full unnecessarily

- [Original architecture draft](ATLAS_DESIGN_ORIGINAL.md).
- [Complete pre-split log](archive/DESIGN_DECISIONS_PRE_SPLIT.md) — an archive,
  not a current source of decisions; its decisions are not updated after the split.
- [Original pre-design PDF](references/pre-design.pdf).

## Maintaining the documents

Record new decisions in the relevant topic; update only the main summary, navigation,
and current stage here. Distinguish accepted decisions from proposals.
Historical wording must not override new decisions. Do not begin implementation
solely on the basis of architectural discussion.
