# Geometry And Routes

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Current clarification — objects and geometry

Atlas owns generic objects, geometric primitives, materials, and shared runtime
mechanisms. Markers, loot, quest zones, and other application concepts are defined
outside Atlas. This replaces the earlier built-in `kind: marker` object model below.
`geometry.kind` describes a geometric form, not application meaning.
The merged implementation supports point and straight line geometry.
Polygons and circles remain subsequent primitives. This does not
add an arbitrary geometry plugin API.

The current review uses `MapPointDefinition` (`id?`, `kind: 'point'`, `position: { x, y }`)
and `MapPoint` for independent and route-owned points. Independent straight lines
use `MapLineDefinition` and `MapLine`; routes use `MapRouteDefinition` and `MapRoute`.
Assigning `MapPoint.position` validates, copies, and emits a change event; owning
lines and routes forward changes. Internal spatial views read current coordinates.
Application metadata and material assignment remain
separate steps. Ordinary API names use no Atlas prefix; the error family retains
`AtlasError` to identify its origin.

Earlier kind/type material selection must be revisited against this separation;
this clarification does not silently finalize a new material assignment API.

## Object positions and internal geometry views — accepted 2026-10-05

Remove the `geometry` property from `MapObject`, `MapPoint`, `MapLine`, and
`MapRoute`. `MapPoint` stores `position: Point` directly; lines and routes store
their owned `points`. Moving a point uses `point.position = new Point(x, y)`.
The setter validates finite coordinates with `position.x` / `position.y` error
paths, copies the value, and emits `change`. Rejected changes preserve the previous
position and emit no event. Owners continue forwarding point changes without
rebuilding geometric data.

`Geometry`, `PointGeometry`, `LineGeometry`, and `PolylineGeometry` move to the
internal spatial subsystem and are removed from package-root exports. The obsolete
public geometry validator is removed. `prepareSceneGeometry` creates stable
geometry views for rendering and spatial queries. Point/line getters read current
positions; route coordinate views expose live x/y getters in one stable readonly
array. Reads and point edits do not recreate these views or copy route arrays.
Readonly live views are internal projections, not immutable coordinate snapshots.
Point membership editing remains a later step.

This supersedes the earlier public geometry getters/setters and geometry-rebuilding
descriptions below. Map definitions and ID rules are unchanged. The example edits
positions directly and displays positions/owned points in its object panel.

## Required identity type — accepted 2026-10-05

Keep the helper shallow. The recursive proof of concept below was checked and then
rejected for the current scope: its traversal rules and application-data boundary
cost more complexity than the few consumers justify.

Use the shared `WithId<T>` type from `definitions/identity.ts` wherever an input
definition's optional ID becomes required:

```ts
export type WithId<T extends { readonly id?: string }> = T & {
  readonly id: string;
};
```

The helper is exported publicly and is independent of `MapObjectDefinition`.
It changes only the type-level ID requirement; it does not generate IDs, validate
data, or recursively change nested properties. Input definitions continue to accept
omitted IDs; resolution generates them as before.

Use `WithId<MapPointDefinition>` directly instead of a separate resolved point
definition. Keep `ResolvedMapLineDefinition` and
`ResolvedMapRouteDefinition`: besides requiring their own IDs through `WithId`,
they explicitly require IDs on their owned points. The line retains its two-point
tuple. Runtime behavior is unchanged.

Use `Resolved` / `resolve` instead of `Normalized` / `normalize` for the completed
definitions and their preparation functions: `ResolvedMapDefinition`,
`ResolvedMapEntry`, `resolveMapDefinition`, `resolveMapPoint`, and `resolveMapPoints`.
Resolution validates and copies data, reserves explicit IDs, and generates missing
IDs. The term does not imply that resources have loaded or runtime objects exist.

### Recursive identity helper — superseded proof of concept 2026-10-05

Historical experiment only; the shallow helper and explicit resolved definitions
above are the current decision. Recursion may be reconsidered if repeated concrete
consumers make it worthwhile, not added in anticipation of them.

The user requested checking whether recursive identity requirements can live in
one helper, keeping object definitions free of generic point parameters and
repeated nested property declarations.

The prototype uses `WithId<MapLineDefinition>` and `WithId<MapRouteDefinition>`
directly. `NormalizedMapEntry` becomes `WithId<MapEntryDefinition>`; separate
normalized line and route types are removed. Runtime normalization is unchanged.

The shared helper requires the root ID and visits nested map-object definitions
and arrays/tuples. Nested definitions must structurally match `MapObjectDefinition`
and explicitly declare an `id` key, including an optional one. Checking the base
interface alone is insufficient: geometry also has `kind`, and the base ID is
optional. The key check prevents geometry from accidentally gaining identity.
Mathematical values and other non-object-definition values remain unchanged;
arbitrary wrapper objects are not traversed. Collection shape, property optionality,
literal kinds, and readonly modifiers are preserved.

`data` is an explicit opaque boundary, even when application data has its own
`kind` and `id`. TypeScript structural matching cannot infer domain ownership from
such a shape. No list of geometry kinds or child collection names is maintained.
This type helper does not generate IDs or imply runtime support for new fields;
actual validation and ID generation remain in the existing loader.

Compiler probes verified required root and nested IDs, line tuple length,
readonly and mutable collections, optional children, union narrowing, unchanged
positions/sizes/geometry, and unchanged application data. The unrestricted candidate
failed the geometry and data checks; the bounded candidate passed. Both probes are
temporary development checks outside the repository, not a new test framework.

The experiment used the earlier `Normalized` names; the user subsequently chose
`Resolved` for the current implementation.

## Grouped positions, sizes, and owned points — accepted 2026-10-05

Use `position`, without the `pos` abbreviation, for a point object's mathematical
coordinate: `{ id?, kind: 'point', position: { x, y } }`. `MapPointDefinition` owns
that coordinate instead of extending mathematical `Point`. Independent points,
line endpoints, and route vertices all use this same definition and runtime class.

Line and route definitions expose `points` directly, with no input `geometry`
wrapper. `MapLineDefinition.points` is a readonly tuple of exactly two
`MapPointDefinition` values; `MapRouteDefinition.points` is an ordered readonly
array. IDs are optional for both owners and points and share the map-wide namespace.
Resolution reserves every explicit ID before generating missing ones, copies
nested positions, and preserves IDs when resolved data is loaded again.

Runtime `MapLine.points` and `MapRoute.points` are stable readonly collections of
owned `MapPoint` instances. Their `geometry` getters expose derived `LineGeometry`
and `PolylineGeometry`, respectively, using the exact coordinate references held
by the points. Move an endpoint/vertex through its point's geometry setter; whole
line geometry assignment is superseded. Owners update their derived geometry and
emit `change` after each successful point edit. Reads do not allocate; invalid
edits preserve both point and owner state. Rendering still coalesces changes into
one pending frame. Point membership edits remain a separate step.

For this data-model step, line display/picking remains its stroke, returning the
`MapLine`. Owned endpoints are available through `line.points`; this does not add
endpoint symbols or a new public owner field in click events. Endpoint presentation
and interaction can be added with concrete material/property requirements. Routes
retain their temporary point symbols and existing point/path click behavior.

Group background dimensions under `background.size: { width, height }`, using the
existing mathematical `Size`. Both dimensions must be finite and positive. The
resolved size is copied and immutable; image dimensions and camera fitting use
it. Invalid dimensions use the shared size validator and `INVALID_NUMBER`, with a
full field path such as `background.size.width`, replacing the former
`INVALID_BACKGROUND_DIMENSION` error. Flat point coordinates, background dimensions,
and line/route geometry wrappers are not alternative supported input forms.

A future optional `z` dimension for `size` is recorded as a direction only. This
step adds no third coordinate/dimension, box primitive, 3D rendering, or placeholder
3D fields; names and semantics beyond the current 2D size can be refined with
that implementation.

## Concrete map objects — accepted 2026-10-05

`MapObject` is the shared base for identity, events, and geometry access. Its
concrete implementations are `MapPoint`, `MapLine`, and `MapRoute`. Remove the
temporary `MapGeometryObject` / `MapGeometryObjectDefinition` wrapper and its
`kind: 'geometry'` input. Each supported object declares its concrete kind.

`MapLineDefinition` extends `MapObjectDefinition` directly, retaining optional
`id`, and has `kind: 'line'` and exactly two owned points. For example:

```json
{
  "kind": "line",
  "points": [
    { "kind": "point", "position": { "x": 10, "y": 20 } },
    { "kind": "point", "position": { "x": 40, "y": 50 } }
  ]
}
```

The loader generates omitted IDs and creates a `MapLine` with two `MapPoint`
instances. Editing an endpoint updates the line with the existing validation,
copying, change event, and SVG-node reuse behavior. Its geometric kind stays fixed.
A click on the stroke identifies that `MapLine`.

`PolylineGeometry` remains the geometry of `MapRoute`. Independent polyline map
objects have no agreed use case, so their provisional loading path is removed;
do not add a `MapPolyline` class until one is needed. Remove the unused
`PathGeometry` union and generic path preparation helper. Old generic wrappers
and unsupported root kinds are rejected explicitly, without implicit migration.
Rendering and spatial queries still consume `Geometry`, independently of the
concrete map-object class.

## Shared point object and naming — accepted 2026-10-05

Use `Map` for map-object classes and their serializable definitions:

| Serializable input    | Runtime instance |
| --------------------- | ---------------- |
| `MapObjectDefinition` | `MapObject`      |
| `MapPointDefinition`  | `MapPoint`       |
| `MapLineDefinition`   | `MapLine`        |
| `MapRouteDefinition`  | `MapRoute`       |

`MapDefinition` still describes the whole map. Mathematical `Point`, `Rect`, and
`Size` retain their names and have no object identity. Input `id?: string` is
inherited from `MapObjectDefinition`; omitted IDs are generated and runtime IDs
are stable and required. Historical sections below may use the previous names
and the removed generic geometry-object wrapper.

Independent, line-owned, and route-owned points share `MapPointDefinition` and `MapPoint`.
A point is `{ kind: 'point', id?, position: { x, y } }` in each location. `RoutePoint` and
`RoutePointDefinition` are removed. Route membership is ownership, not a separate
point type. Point input no longer uses an outer `kind: 'geometry'`; legacy point
wrappers are rejected rather than silently converted.

The runtime point retains `MapObject.geometry` for spatial queries and rendering.
The existing geometry setter works for both independent and owned points. A route
listens to its points, rebuilds its immutable polyline view using their coordinate
references, and emits `change` before external point listeners run. It never keeps
a stale coordinate copy. Geometry reads do not allocate; the view is replaced on
successful changes. Invalid updates preserve both point and route geometry and
emit no change. Multiple changes still share the component's pending animation
frame. Adding, removing, and replacing route points remain subsequent API work;
this step does not introduce an editable collection or nested coordinate setters.

## Route polylines and point identity — accepted 2026-10-05

This decision supersedes the earlier route-owned-line model, composite route view,
and line-based editing contracts below. Object, renderer, spatial, and layer
responsibilities remain unchanged.

A route definition has `points: [...]` directly; the runtime derives
`geometry: { kind: 'polyline', points: [...] }` for geometry consumers. Each input
point is a `MapPointDefinition`: `{ kind: 'point', id?, position: { x, y } }`.
Consecutive points form connected straight segments; there are no independently
described route lines, no `RouteLine`/`RouteLines`, and no route `lines` field.
Connectivity follows from the point sequence, so endpoint snapping and its
tolerance are unnecessary here.

```json
{
  "id": "route-1",
  "kind": "route",
  "points": [
    { "kind": "point", "id": "start", "position": { "x": 0, "y": 0 } },
    { "kind": "point", "id": "checkpoint", "position": { "x": 10, "y": 10 } },
    { "kind": "point", "position": { "x": 20, "y": 5 } }
  ]
}
```

Point IDs are optional in input and generated when absent. They remain stable at
runtime, are retained in the resolved definition, and share the map-wide namespace
with object IDs. All explicit IDs are reserved before generation, including IDs of
later objects and points. The mathematical `Point` remains a coordinate without ID.
Application `data` and `label` on significant points remain future work; this step
adds no placeholder fields for them.

The runtime exposes immutable `MapRoute.geometry` and a stable read-only
`route.points` array of `MapPoint` instances. Each point owns its current geometry;
the polyline references those exact coordinate records. Points belong to their
route and are not independently registered in `map.objects`. Replacing a point's
geometry refreshes the route view and rendering, as described above. IDs live on
runtime objects and in resolved definitions; mathematical runtime polyline
coordinates do not duplicate point identity. `map.definition` remains the resolved
load input, not a live export of runtime edits.

Validation rejects non-finite coordinates, malformed/sparse point arrays, wrong
geometry kinds, and duplicate/invalid IDs. Input is copied without mutation.
Empty routes are valid and have no visible geometry. A single-point route has no
connecting stroke but can display its point. Coincident consecutive points and a
repeated closing coordinate are accepted; distinct point occurrences still have
distinct IDs. No implicit closed-path flag is added.

A path click identifies the route. A displayed point click identifies the runtime
point plus its owning route. ID presence does not enable visibility or interaction.
Layer visibility, clipping, and object visibility retain their agreed roles; actual
layer support is a later implementation step. This implementation introduces no separate
`visible` flag in point data; the exact presentation configuration remains open.
For current click testing, every vertex uses the existing temporary point symbol,
regardless of whether its ID was explicit or generated. Resolved point materials
and interaction properties will replace this presentation default; it is not a
settled rule that all future route vertices must show symbols.

The renderer draws one SVG polyline plus point symbols. Spatial queries use adjacent
coordinate pairs and do not allocate runtime line objects or inspect SVG. Route
points paint above their path within the owner's composition position; later map
objects still paint and pick above earlier ones. Polyline stroke width and point
symbol sizes use the existing temporary screen-sized defaults.

## Geometry structure and ownership — accepted 2026-10-05

### Current clarification — implement geometry types only when needed

Remove the unused `CompositeGeometry` and the redundant `PrimitiveGeometry` alias
from the implementation and public exports. `Geometry` now contains exactly
`PointGeometry | LineGeometry | PolylineGeometry`. The subsequent concrete-object
decision also removes `PathGeometry`, whose generic object consumer is gone.
Map objects, spatial queries, and the SVG renderer use the same supported geometry
union. Compound geometry can be reconsidered when a concrete use case needs it;
it has no current input or runtime contract.

The historical composite and route-line model below is superseded by this
clarification and the polyline decision above. The separation of geometry data,
owner behavior, and scene identity remains.

### Earlier model — historical

Geometry is data with an explicit `kind`. Primitive shapes retain their natural
parameters: a point has a position, a straight line has two endpoints, a polygon
has an ordered contour, and a circle has a center and radius. A composite has
ordered `parts`, each of which is geometry. This does not replace existing object,
route, renderer, or spatial responsibilities with a different scene model.

Every runtime `MapObject` exposes `geometry: Geometry`. The implemented union is
`PrimitiveGeometry | CompositeGeometry`; primitives currently comprise point and
line geometry. Polygons and circles remain later implementation steps, rather than
accepted input that the renderer cannot display. `ObjectGeometry` is replaced by
these geometry types in `definitions/geometry.ts`.

`Route.geometry` is a read-only composite view of its owned lines' geometry.
The view shares geometry references, without another copy of coordinates or a
shared point registry. Object identity and behavior stay on `route.lines`; there is
no second editable collection in `geometry.parts`. Empty routes have no parts.
Route JSON continues to specify only `lines`; it does not serialize the same shape
again under a synthetic `geometry` field.

The current route slice has immutable lines and composition, so it builds and
freezes this view once. Reads do not allocate an array. Future route editing must
refresh the view together with its owned lines; the view must never retain stale
line geometry. Independent `GeometryObject` input remains a primitive in this
slice; arbitrary editable composites and nested object ownership are not added.

Validation and behavior remain with owners:

- Functions in `validators` check incoming geometric data and copy valid input.
- The owning map object validates before applying a change and emitting `change`.
- `Route` additionally enforces ordered-line continuity; geometrically valid input
  can still be invalid for that route. Its composite is built from validated lines.
- `Spatial` performs geometric queries; the renderer translates prepared geometry
  into backend output. Geometry data has no event or ownership behavior of its own.

Scene entries expose current primitive geometry separately from object identity.
The identity is a `MapObject`, rather than a union of concrete object classes;
click events use that same common type and retain the existing owning-route context.
Geometry getters in prepared entries observe runtime replacements without keeping
a stale snapshot or copying coordinates per frame.

## Application classification — accepted 2026-10-05

- Move application-defined `type` into `data.type`. There is no separate
  object-level `type` field in the current object contract.
- `kind` stays outside `data`: it describes the structural object kind understood
  by Atlas. `geometry.kind` identifies a primitive or composite geometric form.
- Classification values such as `extract`, `loot`, `quest`, or `recommended`
  belong to the application; Atlas does not prescribe their vocabulary. `data.type`
  is optional application data, subject to the same JSON-serializability requirement
  as the rest of `data`.
- This applies to independent objects and owned parts, including routes and their
  lines. Earlier references to semantic object/point/route `type` now mean
  `data.type`; they do not establish another structural field or an event payload field.
- The earlier material-selection rules involving kind/type need adaptation.
  Moving the classification does not settle the selector or material-assignment API.
- This records the data-model decision only. Application-data storage and its
  runtime API remain a separate implementation step; no automatic migration is added.

Illustrative classification on a route:

```json
{
  "kind": "route",
  "data": { "type": "recommended" },
  "lines": []
}
```

## Common object contract — accepted

The common base remains current. References to owned lines below are historical;
the polyline decision replaces them with owned points and a route geometry field.

All object definitions share `ObjectDefinition` with optional input `id` and required
`kind`. `GeometryObjectDefinition` and `RouteDefinition` extend it; `LineDefinition`
specializes the geometry definition for straight lines, whether independent or
owned by a route. The common base is where materials, labels, application data,
and other shared properties belong as their contracts are implemented. This step
does not add placeholder material/label/data fields or settle their schemas.

Object kind selects the structural behavior: the current prototype uses `geometry`
and `route`. `geometry.kind` separately identifies a primitive (`point` or
`line`) or a `composite`. Route input owns lines; its runtime composite geometry
is derived from those lines, without another required field in route JSON.
These prototype discriminant names remain subject to refinement. Missing or unsupported
root object kinds reject with `INVALID_OBJECT_KIND`; a route part must explicitly
be a geometry object with line geometry. There is no implicit legacy-shape conversion.

At runtime, abstract `MapObject extends EventTarget` owns the ID and exposes the
read-only object kind and geometry access. `GeometryObject`, `Route`, and the currently read-only
`RouteLine` all inherit this foundation. Identity validation and event support are
shared. The mutable primitive behavior previously on `MapObject` now belongs to
`GeometryObject`; construct that class for independent geometry objects.
Route lines keep their read-only geometry until the route editing step can maintain
continuity. Adding the common base does not enable arbitrary object kinds in map loading.

## Route runtime — confirmed

The class and ownership boundary remain; the line-based contents below were replaced
by the route-polyline decision above.

`Route` is a runtime class extending `MapObject` within Atlas. The route itself belongs
to `map.objects` and owns its ordered `lines`. These are encapsulated route parts,
not references to independently registered map lines. The route implements the
already agreed `addLine()`, `addPoint()`, and continuity behavior. Application
meaning, such as a quest or evacuation route, stays outside Atlas.

Ownership and behavior were already recorded in the route and runtime decisions;
the subsequent confirmation names the class and establishes its placement within
the library. The JSON representation, collection read API, and numeric tolerance
remain subject to prototype review; the first slice below uses provisional choices.

## First route slice — pending review

This earlier line-based slice is retained as history and superseded by the
route-polyline implementation above. It is no longer the current JSON or runtime API.

The implementation covers loading, continuity validation, rendering, and click/tap
identification. The prototype JSON shape is an entry in `MapDefinition.objects`:

```json
{
  "id": "route-1",
  "kind": "route",
  "lines": [
    {
      "id": "line-1",
      "kind": "geometry",
      "geometry": { "kind": "line", "start": { "x": 0, "y": 0 }, "end": { "x": 10, "y": 10 } }
    }
  ]
}
```

`map.objects.get('route-1')` returns a `Route`. Its lines are owned `RouteLine`
instances, not independent entries in `map.objects`. IDs are optional in JSON for
both the route and its lines. Normalization reserves all explicit IDs before
generating missing IDs, with one namespace for routes, lines, and other objects.

`route.lines` is a stable `RouteLines` collection with `size`, `get(id)`, and
iteration, matching the existing read-access convention of `map.objects`.
The initial runtime lines expose read-only ID and geometry access. Read-only
geometry is a temporary limitation until route editing provides the agreed
continuity-preserving setters. `addLine`, `addPoint`, synchronized endpoint editing,
removal, and replacement remain planned for later review; this slice does not
expose edits that could break continuity.

Normalization validates finite endpoints and the complete ordered chain, without
mutating input. A gap beyond the provisional absolute tolerance of `1e-6` map units
rejects with `ROUTE_DISCONNECTED`; an adjacent start within tolerance is copied to
the previous end's exact coordinates. The tolerance is a marked prototype default,
to be replaced by an agreed configuration. Empty routes and zero-length lines are
accepted. Invalid route input preserves the previous displayed map.

Shared scene preparation places route lines consecutively at their owner's position
in composition order. Existing line rendering and numeric hit testing are reused.
Click/tap detail contains `object` (the runtime line), `route` (its owner), `mapPoint`,
and `clientPoint`. Independent object events omit `route`. At a shared endpoint or
overlap, reverse composition order still selects the topmost eligible primitive.
The Factory example displays the clicked line's ID and its route ID in application UI.

The later geometry clarification adds a composite data view over these owned lines;
it does not introduce a generic object hierarchy, layer selection, materials, or
route generation.

## Line geometry — merged

The merged implementation described below predates the concrete-object decision
above: independent lines now use `MapLineDefinition` / `MapLine`, and the shared
geometry union is `Geometry`. The validation and rendering behavior remains current.

The user approved a small line-geometry step before route composition. The
reviewable data shape is `{ kind: 'line', start: { x, y }, end: { x, y } }` inside
an ordinary `GeometryObject` (originally implemented as concrete `MapObject`, before
the common-base clarification above). The original `ObjectGeometry` union is now
named `PrimitiveGeometry` under the geometry clarification above;
`LineGeometry` describes one straight segment, not a route or an infinite line.
These names are prototype contracts, subject to refinement when route behavior,
z coordinates, and material resolution are implemented.

Both endpoints require finite coordinates. Normalization and runtime assignment
copy and freeze geometry and endpoints; rejected assignments preserve the previous
geometry and emit no change. Coincident endpoints are allowed: the temporary round
stroke displays and picks them as a dot. No minimum segment length is introduced.

Following review, an object's geometry kind is fixed at construction; no current
use case requires converting a point into a line or vice versa. Assigning
`object.geometry` can move its position/endpoints while retaining identity and
registration order. An assignment with a different supported kind rejects with
`GEOMETRY_KIND_CHANGE`, preserving the previous geometry and emitting no change.
Edits reuse the same SVG nodes; primitive replacement is unnecessary.
Events retain the same object/map-point/client-point payload. Independent
lines do not synchronize endpoints with other objects, even at coincident positions.
Route-owned continuity remains a separate behavior step.

Points and lines share one composition sequence. Picking visits it in reverse and
uses current runtime geometry without rendering or inspecting SVG. Line picking
uses distance to the closest point on the segment, including its round caps; it
does not use the line's bounding rectangle as the hit area.

Line appearance is explicitly temporary: orange, 4 viewport CSS pixels wide, with
round caps. Shared symbol dimensions drive both SVG output and numeric picking.
Resolved materials will replace the defaults. Width stays constant during camera
zoom; endpoints stay in map space. Optional hit-area expansion, configurable width,
arrows, dashes, and map-scaled stroke widths remain separate steps; this change does
not settle their public configuration API or add automatic mobile enlargement.

The Factory example includes two independent lines and a button that changes one
endpoint through the runtime instance. Their placement is illustrative, not a
verified traversable route.

## 2. Space and environment — agreed

- The Atlas format is independent of third-party formats; importers transform source data.
- Example source: https://github.com/the-hideout/tarkov-dev ; UX example:
  https://tarkov.dev/map/customs . These are references, not mandatory dependencies.
- Map space is independent of image resolution. Coordinates may be fractional
  or negative; the map/importer defines the units.
- By default, (0, 0) is at the top left, x points right, y down, and z is height upwards.
  An omitted z is 0. Bounds are specified separately from image resolution.
- Other coordinate systems are supported through transformation; the exact contract is open.
- First version: raster or SVG backgrounds positioned in map space.
  Floors are needed in the first version (the user's clarification after discussing routes).
  The earlier single-background restriction needs revision: how floor backgrounds
  are represented and switched has not yet been agreed.
  Roof controls are unnecessary. Tiles and internal SVG layers are currently out of scope;
  the need to use SVG layers for floors still needs evaluation.
- Map space, environment, semantic objects, and camera are separate.
- The longer-term goal is true volumetric terrain, elevation, and models, not merely
  a tilted flat image. An image may serve as a plane in 3D when needed.
- Provide an extension/renderer contract for 3D; the specific interface will be
  discussed later. A complete 3D implementation is not being designed now.
- The user wants to customize the transformation pipeline; extension boundaries
  and consistency between rendering and hit testing still need design work.
- In 3D, a screen point defines a ray: inverse conversion needs a surface or
  intersection plane. Route elevation/surface attachment remains open.
- Translucent 3D environments are a future possibility;
  their hit-testing behavior is not yet defined.

## 3. Objects — agreed

- Common fields: id, kind, optional label and data.
  id is optional in input data — see the identity section.
- kind describes structure; application classification is stored in optional
  data.type, replacing the earlier object-level type field.
- data is arbitrary serializable application JSON data.
- label is a standard optional label that Atlas can render.
  Appearance is defined through Meta/materials.
- marker: position { x, y, z? }; may display only a label without an icon.
- line: an independent map object, for example a divider; owns its geometry
  and has common object fields, events, and visibility.
- route: a composite object with ordered segments by layer; each segment
  contains lines. Lines are straight in the first version; composition details follow below.
- polygon: one closed filled contour without holes.
- circle: a center and radius in map units.
- A place name without boundaries is a marker with a label; an existing zone's label
  belongs to its polygon/circle so that the zone and label remain one object.
- Bézier curves are a future geometry extension, potentially for routes and contours.
- The exact geometry field schema and extensibility of kind are not yet finalized.

## 4. Routes and identity — discussion ongoing

Accepted:

- A route encapsulates its segments. They are not references to independent map lines;
  segments are not reused between routes.
- Independent lines and lines inside segments share the geometry/appearance model
  and rendering code. A line need not know whether it is being used inside a route.
- Width, color, dashes, and arrows belong to the line material. The route provides
  default appearance; a segment may override it. The exact schema is open.
- The route controls the behavior of its parts: hiding the route hides its segments
  and points; shared highlighting and appearance are coordinated by the route.
- User clarification: the route maintains continuity as behavior/a rule,
  not through a shared point registry. There is no separate route.points. Points live
  in line geometry; the route ensures neighboring line endpoints match.
  This replaces the earlier decision to store a shared point only once.
  Validation order, comparison precision, handling inconsistent input, and update
  synchronization are not yet defined; automatic repair of arbitrary input
  data has not been agreed.
  Rendering an independent or nested line takes geometry and a material.
- A route is a cross-layer object. Preliminary structure:
  segments: [{ layer: "layer-id", lines: [...] }]. A segment is a route section
  on a layer containing lines, not a synonym for one line. The term sections is unnecessary.
  This preliminary segment-to-layer association is revised below: spatial clipping
  is defined by the layer itself; routes need no special floor-based subdivision.
  The final segments/lines structure remains open.
- Removing an independent line does not affect routes.
- A segment has its own ID under the general createId rules: optional on input,
  generated when absent, unique in the map-wide ID namespace, and preserved on export.
  This does not make a segment an externally reusable object.
- Clicking a segment passes the segment itself, its parent route, and map/client
  interaction coordinates in the event. The application decides whether to describe
  the whole route or that section. The exact payload shape remains open.
- Route points store coordinates, without marker references.
  Moving a marker does not change the route: it cannot guarantee path readability/validity.
- Points may optionally have label and data and support independent interaction.
  Ordinary points define bends; significant points represent stops, objectives, etc.
- A label alone does not imply interactivity; point Meta details remain open.
- The earlier route-point appearance rules used an optional semantic type,
  now stored in data.type. Without it, the point is an ordinary bend point
  and is not rendered separately by default. When data.type is present, Meta determines
  its icon, label, and interactivity. All points participate in route geometry.
  The property/material mechanism for these rules remains subject to the newer
  object and material clarifications; data.type does not itself define engine behavior.
- Point classification is independent of route classification: for example, a
  recommended route contains quest and extract points. Classification is available
  through data.type; the earlier event example does not require a separate type field.
- Route direction arrows are optional and configured through Meta/material.
  Direction follows the point order from first to last; arrows do not define
  traversability rules. Their exact placement and frequency are not yet defined.
- There is no separate closed flag for now: the last point may repeat the first
  point's coordinates while having its own ID.
- Objects, points, and segments share one ID namespace; uniqueness is checked across
  the entire map, not separately within each route.
- id is optional on input. Atlas generates it when absent. The string "auto" is unnecessary.
- Every object, point, and segment has an ID at runtime.
- The public generator function is named createId.
  Its exact signature and generation algorithm are not yet defined.
- An ID is a string; it need not reproduce the MongoDB ObjectId format. The string is opaque:
  the application uses it as an identifier without extracting meaning from its internal format.
- A generated ID is stable throughout the object's lifetime and preserved on export.
  Reloading the original JSON without IDs creates new IDs.
- In a point event, routeId provides parent context and pointId identifies the point.

Unfinished: exact point and segment schemas, event payload shapes,
appearance/interactivity, duplicate ID handling, and geometry validation.
Hiding a stop independently while retaining its geometry was proposed but not approved.
Chat examples are not final interfaces.

## Selecting data fields

jq-like expressions and simple field selectors were discussed.
Assistant recommendation: do not introduce a query language yet; the application/importer
prepares label and other standard values. The user has not explicitly approved a selector contract.
