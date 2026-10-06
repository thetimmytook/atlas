# Renderer And Component

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Runtime / geometry / renderer boundary — current clarification

This replaces the earlier assignment of hit testing to the renderer.

Accepted direction:

- Runtime objects are the internal scene representation. They may evolve into a
  scene graph, but parent/child hierarchy and a scene-graph API are not yet defined.
- A separate geometry-processing stage/subsystem operates on that representation.
  Geometric operations, hit testing, intersections, and future collision queries
  belong here and must work without SVG DOM inspection or a particular renderer.
- The camera supplies the view/projection needed to form a spatial query from an
  input position. In the current flat view this can be understood as a ray
  perpendicular to the map plane, selecting the first eligible hit. Real 3D
  projection/ray implementation remains future work.
- The renderer efficiently transfers scene/display data into backend output
  (SVG elements in the first implementation) and updates affected output with
  minimal redundant work. Its contract must not own hit testing or collision queries.
- Runtime retains behavior, validation, material resolution, layer configuration,
  normalized events, change tracking, and batch. Geometric preparation and querying
  share this state with rendering rather than reconstructing it from rendered DOM.
- Application UI and the response to events remain outside these subsystems.

Proposals and open points:

- `Spatial` is a proposed subsystem name; `GeometryProcessing` is a proposed name
  for its preparation stage. Neither is an approved class or interface signature.
- Separate reusable geometry preparation from on-demand queries within that subsystem.
  A hit test should not require rerendering; rendering should not run unused collision
  queries. Cache/invalidation details require a concrete prototype, not a new global
  pipeline framework at this stage.
- Both picking and rendering need a consistent description of symbol geometry and
  screen-size policy. A mathematical point alone has no area; its displayed symbol
  or explicitly defined hit area must be represented outside the renderer. Avoid
  independently duplicating the temporary 24-pixel circle in the query subsystem.
- In the current 2D view, first-hit priority follows the existing layer/object
  composition order and interaction eligibility. Real 3D distance and occlusion
  remain subject to the future 3D contract.

## Spatial implementation — merged

`prepareSceneGeometry(objects)` prepares a shared `SceneGeometry` description before
renderer preparation. Each entry retains its runtime object and references a symbol
with radius and stroke width in viewport CSS pixels. The current circle symbol is
explicitly temporary until material resolution supplies it. Rendering and queries
use the same description and observe current runtime positions; no per-frame object
copying is introduced by this preparation step.

`Spatial.hitTest(mapPoint, camera)` performs numeric point-symbol picking without
DOM, SVG types, or a renderer dependency. It checks the camera viewport, accounts
for zoom to preserve screen-sized hit areas, and returns the first hit in reverse
composition order. This flat-view calculation represents a perpendicular ray; no
unused 3D ray abstraction or collision engine is introduced. Spatial implementation files
are internal modules, not new package-root exports.

`Renderer` no longer has a hit-testing method. The SVG backend consumes shared
geometry descriptions and only translates them into SVG output. Client-to-map
conversion remains at the component/browser boundary. Queries use current scene
state and do not read the last painted SVG state or request a render.

A successful load replaces runtime objects, shared geometry, and the spatial query
instance together after renderer preparation succeeds. Failure retains the previous
scene for both display and interaction. Future materials, non-point geometry,
layers/clipping, indexing, and cache invalidation will extend this boundary under
separate review.

The line-geometry step under review generalizes `SceneGeometry` to an ordered
`objects` array and shared `symbols` defaults for point and line primitives.
The defaults are temporary until per-object material resolution supplies them.
Both consumers read internal live geometry views, so endpoint changes do not leave
stale prepared geometry. SVG uses a non-scaling round stroke for lines; `Spatial`
uses the shared width and a numeric point-to-segment distance. The runtime fixes
geometry kind at object construction, so the renderer creates each primitive once
and reuses it for coordinate changes.
No per-frame scene copies, DOM-based hit tests, or spatial indexing are introduced.

Following review, SVG output separates preparation, map-space geometry, and
screen-size compensation. Preparation creates the SVG nodes; rendering calls
`applyGeometry` and `applyScreenScale` on them. Geometry writes placement/endpoints
without camera scale; the point's group holds its translation. Screen-size
compensation scales only the point symbol inside that group. Lines retain their
non-scaling stroke. No primitive-type synchronization runs during rendering.
These are internal SVG operations, not a new public pipeline API.

The route step prepares a polyline entry for the `MapRoute`, followed by point entries
with `MapPoint` identity and owning-route context. Scene identities use `MapEntry`
(`MapPoint | MapLine | MapRoute`), preserving the concrete object type through
picking and events. Both entries use internal live geometry views. The renderer draws SVG `polyline` geometry
with a round, non-scaling stroke and round joins; spatial queries test adjacent
coordinate pairs with the same width. No runtime line objects are created.
Point symbols are shared with existing point rendering/picking, with temporary
presentation independent of point IDs. Zero/one-point polylines have no stroke;
a lone route point can still render and receive clicks. Route coordinate getters
read each owned point's current position. Views and their readonly coordinate
array are created once during scene preparation; updates do not rebuild them.
Existing SVG nodes and scene entries are reused.

The route append step is implemented for review. Shared scene descriptions detect
replacement of a route's readonly point array and refresh their ordered entry array
on demand. Existing entries and coordinate views are reused; only the appended
vertex gains a new view and SVG node. The SVG renderer synchronizes changed membership
before painting while preserving composition order and existing nodes. Spatial queries
use the same current entries, so they see additions before the next render frame
and do not depend on the component's connection or listener order. Ordinary position
edits and camera changes retain the arrays and nodes. See the
[append contract](RUNTIME_AND_LOADING.md#route-append--accepted-2026-10-05-implemented-for-review).

Root-object addition is implemented for review. Shared scene descriptions also
detect growth in the root collection, refresh their ordered entries lazily, and
keep existing views and entries. The same SVG synchronization adds nodes for new
roots and route vertices. The component observes additions and subscribes to each
new object's changes while connected; reconnect observes roots added while detached.
Spatial queries see new objects before rendering. See
[runtime additions](RUNTIME_AND_LOADING.md#runtime-object-addition--accepted-2026-10-06-implemented-for-review).

## Component lifecycle

- Framework integrations (React, etc.), if needed, ship as separate libraries
  to avoid increasing the core bundle.
- Creation and loading are asynchronous; the application can await readiness or failure.
- Removing the component from the DOM stops rendering and releases browser subscriptions;
  data is not automatically destroyed.
- Reconnecting resumes display.
- The component exposes runtime access and forwards public events.
- Resizing the component changes viewport dimensions. Camera center and zoom are
  preserved; the map is not automatically fitted again.

## First implementation step — merged

The user requested only the Web Component as the first reviewable step.
`MapElement` extends `HTMLElement`, creates an open Shadow DOM with an empty SVG
surface, and observes the host content size while connected. Detaching disconnects
the observer; reconnecting reuses the surface and resumes observation.
The host application provides the element's size and explicitly registers
`atlas-map`; importing the library does not register a custom element automatically.

This is a component shell, not the final renderer interface. Runtime access,
asynchronous map loading, backgrounds, camera behavior, and public interaction
events remain subsequent steps. The synchronous browser custom-element constructor
does not establish the future asynchronous loading contract.

Following the user's review, static markup and CSS now live in `map-element.html`
beside `map-element.ts`. Vite imports the template as a string through `?raw`; component styles remain isolated inside Shadow DOM. This separation
is prepared for review and does not define the map material system.

## Map definition and background step — merged

Following review, the component accepts `MapDefinition`: serializable map data
with a `background` description (image URL and explicit map-space dimensions under
`size: { width, height }`).
The earlier `MapRuntime` wrapper was removed because it did not yet own runtime
behavior. This minimal definition is not the final map JSON schema/resource registry.

`await element.load(definition)` validates and takes an immutable copy before
asynchronous preparation. `element.definition` exposes the successfully loaded copy.
Browser-side image preparation rejects on failure and preserves the previous map.
Concurrent loading is not supported in this step: an overlapping `load()` rejects
with `MAP_LOAD_IN_PROGRESS`. Completion or failure allows the next load.

`MapSettings` is the intended separate configuration for display settings. It will
be introduced with its first concrete setting, rather than as an empty type.
Background width/height describe geometry, not the component's size on the page.
Existing material design decisions remain in effect.

The SVG renderer embeds the image without inserting its document into the host DOM.

The first nonzero viewport fits the background. Subsequent resizes preserve that
scale and the background center; public camera controls are a later step.
The Factory ground-floor example exercises this slice. Layers, mutable objects,
resource registry/custom loaders, and interaction are still outside this step.

The renderer now has an abstract `Renderer` base and an SVG-specific
`SvgRenderer` implementation, as requested during review. The component types its
renderer through the base class. Background preparation returns a `show()` handle,
so SVG elements stay inside the concrete renderer and a load is displayed only
after preparation succeeds. This is a minimal prototype contract,
not the complete renderer API.

## Camera integration — merged

The component now owns an independent camera and subscribes to its changes while
connected. `Renderer.render(viewport, bounds)` receives display dimensions
and the calculated map-space rectangle; `SvgRenderer` only applies these values.
The previous renderer-owned center/scale calculations moved to `Camera`.
See [camera implementation](CAMERA.md) for the proposed API and scope.

## Object display — merged

The first object slice adds optional `objects` to `MapDefinition`. With the later
concrete-object refactor, point data is `{ id?, kind: 'point', position: { x, y } }`. Line and route data
contain `points` directly; the spatial subsystem derives internal live geometry
views from their owned points. Atlas renders geometry;
marker and zone semantics belong to the application. Explicit IDs must be non-empty;
duplicates are accepted under the later
[ID handling decision](RUNTIME_AND_LOADING.md#id-handling--accepted-2026-10-06-implemented-for-review).
Omitted IDs are generated by `createId()` and retained
in the prepared definition and runtime objects. IDs are opaque strings.

`element.objects` is an iterable collection with `size` and `get(id)`. Each
`MapObject` is an `EventTarget`. The concrete `MapPoint`, `MapLine`, and `MapRoute` extend it;
assigning `MapPoint.position` validates and copies its value, then emits `change`.
Lines and routes forward point changes without storing or rebuilding geometry.
The component coalesces changes into its next render frame and reuses SVG elements.
Positions are immutable coordinate values; internal geometry views are readonly
and read current positions. Collection mutation,
nested setters, and batch are later steps. A successful map load replaces the
collection; retained old objects remain usable but no longer update this component.
Failed preparation preserves the previous collection and display. Disconnect and
reconnect release and restore subscriptions while keeping the objects.

`element.definition` returns `ResolvedMapDefinition | undefined`, retaining the
type-level guarantee of required IDs on objects and their owned points. This type
is exported from the package root. The value remains the immutable input snapshot
with resolved IDs; runtime edits do not mutate it. Live export is a separate planned API.

`load(definition)` has no appearance-settings argument. The proposed `MapSettings`
was removed after review: a global point-icon setting would bypass the planned
material system. The renderer temporarily draws a neutral circle, 24 CSS pixels
across, centered at the point position and preserving its size on camera zoom.
The size, stroke, and CSS colors are explicitly marked as temporary in code and
will be replaced by resolved point-material properties and material rendering.
Per-object appearance, labels, z, layers, and optional map-scaled sizes remain
subsequent work.

The Factory example uses these objects as markers at illustrative positions. Its
attributed tarkov.dev icon is retained as an unused asset for the material step.
Click/tap interaction is merged; see
[object events](LAYERS_AND_INTERACTION.md#first-surface-events-and-object-clicktap--merged).
Popups remain application UI.
