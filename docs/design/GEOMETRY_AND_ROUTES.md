# Geometry And Routes

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Current clarification — objects and geometry

Atlas owns generic objects, geometric primitives, materials, and shared runtime
mechanisms. Markers, loot, quest zones, and other application concepts are defined
outside Atlas. This replaces the earlier built-in `kind: marker` object model below.
`geometry.kind` describes a supported geometric primitive, not application meaning.
The merged implementation supports point geometry; straight lines are the current
reviewable step. Polygons and circles remain subsequent primitives. This does not
add an arbitrary geometry plugin API.

The current review uses `ObjectDefinition` with `id?` and
`geometry: { kind: 'point', position: { x, y } }`, and an `AtlasObject` runtime
instance. Assigning geometry validates, copies, and emits a change event. Geometry
is immutable when read. Application metadata, material assignment, and composite
behavior remain separate steps. Previously discussed route continuity remains a
requirement; its placement in this generic model needs a later review.

Earlier kind/type material selection must be revisited against this separation;
this clarification does not silently finalize a new material assignment API.

## Line geometry — pending review

The user approved a small line-geometry step before route composition. The
reviewable data shape is `{ kind: 'line', start: { x, y }, end: { x, y } }` inside
an ordinary `AtlasObject`. `ObjectGeometry` is the union of point and line geometry;
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

- Common fields: id, kind, type, optional label and data.
  id is optional in input data — see the identity section.
- kind describes structure; type is freely defined by the application.
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
- A segment has its own ID under the general AtlasId rules: optional on input,
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
- A route point has an optional type. Without type, it is an ordinary bend point
  and is not rendered separately by default. When type is present, Meta determines
  its icon, label, and interactivity. All points participate in route geometry.
- Point type is independent of route type: for example, a recommended route contains
  quest and extract points. A point event includes its ID, type, and route ID.
- Route direction arrows are optional and configured through Meta/material.
  Direction follows the point order from first to last; arrows do not define
  traversability rules. Their exact placement and frequency are not yet defined.
- There is no separate closed flag for now: the last point may repeat the first
  point's coordinates while having its own ID.
- Objects, points, and segments share one ID namespace; uniqueness is checked across
  the entire map, not separately within each route.
- id is optional on input. Atlas generates it when absent. The string "auto" is unnecessary.
- Every object, point, and segment has an ID at runtime.
- The public generator function is named AtlasId (instead of the proposed createId).
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
