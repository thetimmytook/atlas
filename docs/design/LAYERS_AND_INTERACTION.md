# Layers And Interaction

## Explicit layers — accepted and implemented for review, 2026-10-08

Current status: merged, confirmed by the user on 2026-10-08 after the review fixes.
The direct-content contract below remains in effect. The automatic stage is implemented
for review in the intersection-bounds section below.

The first implementation supports direct full appearances, layer backgrounds,
composition and independent visibility. `intersectionBounds` remains the accepted
next direction. The merged first stage rejected it with
`UNSUPPORTED_INTERSECTION_BOUNDS`, including an explicit `undefined` value.
The next stage below supersedes that rejection; volumetric zones remain deferred.

`MapDefinition.layers` is required: no default layer or flat-input compatibility.
`layers: []` is valid and displays nothing; a top-level `background` is rejected.
Shared definitions stay in optional `MapDefinition.objects`.

```ts
interface MapLayerDefinition {
  readonly id?: string;
  readonly stackIndex?: number;
  readonly objects?: readonly string[];
  readonly background?: BackgroundDescription;
}

// MapElement
get layers(): readonly MapLayer[];

// MapLayer
get id(): string;
get stackIndex(): number;
get background(): BackgroundDescription | undefined;
get objects(): readonly MapEntry[];
get objectIds(): MapLayerObjectIdCollection;
get visible(): boolean;
set visible(value: boolean);

// Stable MapLayerObjectIdCollection; cannot be replaced or mutated as a raw Set
add(id: string): boolean;
remove(id: string): boolean;
has(id: string): boolean;
[Symbol.iterator](): Iterator<string>;
```

Layers start visible; their frozen array follows declaration order and is replaced
only by successful loading. IDs are non-empty opaque strings, omitted IDs use
`createId()`, and duplicate layer IDs reject loading. Layer and object ID namespaces
are independent. Finite `stackIndex` defaults to zero and permits negative values.
Composition uses ascending indices; later declarations are above earlier ones at
equal indices. The background is below its layer's objects and passes clicks through.
Root collection order determines object order; there is no object-level zIndex.
`MapLayer` and `MapLayerObjectIdCollection` are exported as types; application code receives
their instances from the loaded map. Adding/removing/reordering layers is deferred.

`layer.background` reuses `{ source, size: { width, height } }` at map origin. This
URL/explicit-size description remains provisional until the resource/background
placement contract is implemented.

Omitted `objects` and `[]` are equivalent. A reference selects every matching root
instance without merging duplicate root IDs or changing `map.objects.get(id)`.
Repeated references create no duplicate appearance in one layer. Owned point IDs
are not root references unless those points are separately attached as roots.

`objectIds.add/remove` validate non-empty strings, commit and invalidate membership
before notification, and return whether references changed. Repeated addition and
absent removal are no-ops. Removal excludes all matching roots from that layer,
retaining them in `map.objects`. ID iteration follows insertion order, which does
not determine rendering order. Missing runtime IDs are allowed; new matching
instances automatically appear in all corresponding layers. Unknown load references
reject the entire load.

`layer.objects` means only current roots selected through direct `objectIds`.
Its frozen arrays cannot be changed with `push/splice`; retained arrays preserve
old membership and live references. Future automatic clipped appearances are prepared
separately and will not change this getter's meaning. Root/reference edits reconcile
synchronously on read before RAF, including disconnected state. Coordinate, camera
and visibility changes retain current arrays and composition.

```ts
const layer = map.layers.find(layer => layer.id === 'first')!;
const point = map.objects.add({ kind: 'point', position: { x: 40, y: 60 } });
layer.objectIds.add(point.id);
layer.visible = false;
const ids = [...layer.objectIds];
layer.objectIds.remove(point.id); // retains the root object
```

`press/release` describe the entire surface. Picking checks all visible layers from
top to bottom. `objectclick.detail.layer` is the runtime layer of the hit;
`detail.object` is the original shared object. A route path returns `MapRoute`;
a vertex returns its `MapPoint` with owning `detail.route`. Editing the object needs
no layer argument and updates every appearance. The event constructor is
`ObjectClickEvent(object, mapPoint, clientPoint, layer, route?)`.
A synchronous surface handler hiding the hit layer, removing its reference or
detaching the hit suppresses the stale object click without a second hit test.

SVG and picking share layer order and live eligibility. Hide/show preserves camera,
background resources, geometry and SVG nodes. The Factory application has a
background-only layer, two independent content layers sharing one runtime route,
external toggle/edit buttons and hit-layer IDs in its panel. Temporary route vertex
symbols remain unchanged until the separate appearance/interaction step.

## Intersection bounds contract — accepted and implemented for review, 2026-10-08

The user approved the coordinate and bounds corrections; they are now implemented
for mini review. The picking rule below is the tested implementation proposed for
review, including screen stroke thickness.

Use the existing [Point with optional height](GEOMETRY_AND_ROUTES.md#optional-height-on-point--accepted-and-implemented-for-review-2026-10-08):

```ts
export interface IntersectionBounds {
  readonly min?: Partial<Point>;
  readonly max?: Partial<Point>;
}

// MapLayerDefinition
readonly intersectionBounds?: IntersectionBounds | undefined;

// MapLayer
get intersectionBounds(): IntersectionBounds | undefined;
```

`Partial<Point>` retains the readonly coordinate fields; an additional `Readonly`
wrapper is unnecessary. Omitted bounds or `undefined` disable automatic display.
Supplied bounds require at least one finite coordinate constraint. Reject `{}`,
`{ min: {} }`, `{ max: {} }`, and other forms without an effective constraint;
they do not implicitly enable an automatic display of every root object.
One-sided limits are valid, and omitted axis limits remain unbounded. For an axis
with both limits supplied, reject `min >= max`. Invalid shape, coordinates or
range use `AtlasError` with `INVALID_INTERSECTION_BOUNDS` and structured details.
The runtime getter exposes the copied, frozen loaded bounds, including nested
limits. No runtime setter is added in this stage.

Use a simple parametric segment algorithm: axis constraints narrow the admissible
interval in `t` from `[0, 1]`. A route retains sequential disconnected fragments
and its original direction. Cut coordinates do not create runtime objects or
markers; rendering and picking share the derived geometry.

Automatic candidates are all current `map.objects` roots, including roots selected
in another layer. Owned points are not independent candidates unless separately
attached as roots. Direct `objectIds` selection wins for that runtime instance in
the same layer: it appears whole, with no additional automatic appearance. Distinct
roots with the same ID stay distinct. `layer.objects` and `objectIds` still describe
only direct roots. Mixed direct/automatic appearances retain root collection order;
`stackIndex` controls layer composition, not height. Backgrounds remain independent.

### Boundary picking — implemented for review

Spatial membership of centerline positions and marker centers is `[min, max)`.
SVG strokes reach the cut plane, including a visually closed round cap. Picking
asks whether **any eligible centerline position** is within the existing stroke
radius (`strokeWidth / (2 * zoom)`) of the 2D query. The camera does not infer a click z.
This retains hits near an excluded endpoint when eligible interior positions fall
inside the hit disk. At exactly the outer tangent, an excluded endpoint alone does
not qualify; an included endpoint or an eligible interior position does. There is
no tolerance added to the height/axis ownership rules or new hit-area setting.

For projected zero-length segments, every admissible source position shares the
same x/y; that projection remains pickable, including the hit disk's tangent. An
interval with no admissible position has no display or hit. Markers at z = 3 occur
only in `[3, 6)`. Strokes of neighboring floors may have overlapping screen hit areas;
when both are visible, the top composed layer wins. Hiding it reveals the other
eligible path. This is screen composition, not a height estimate from the pointer.

Concrete Node and native Chromium checks use a four-pixel stroke at zoom 1:

| Eligible centerline / query                                                 | Result                                  |
| --------------------------------------------------------------------------- | --------------------------------------- |
| x in `[50, 150)`, query `(48, 100)` on the min cap tangent                  | hit                                     |
| same segment, `(150, 100)` or `(151, 100)` near max                         | hit through eligible interior           |
| same segment, `(152, 100)` or `(150, 102)` at max cap tangent               | miss                                    |
| same segment, `(150, 101.9)`                                                | hit                                     |
| same segment at zoom 2, `(150.5, 100)` / `(151, 100)`                       | hit / miss                              |
| floor transition z `0 → 6`, shared cut `(120, 100)`                         | upper layer; lower when upper is hidden |
| vertical transition at `(100, 100)` through both floors, query `(100, 101)` | upper layer; lower when upper is hidden |

Clicks identify the original `MapLine`/`MapRoute` and runtime layer. Eligible original
vertices identify their `MapPoint` and owning route. After synchronous press/release
handlers, only the captured appearance is revalidated against current membership,
visibility and geometry. A removed/ineligible/moved-away hit is suppressed without
picking an object underneath; a reference in `objectIds` is not required for an
automatic hit. The source route and points remain unchanged by clipping.

## Clarifications after studying tarkov.dev

- Both scenarios are useful: local building floor switching on the main map
  and a separate detailed view with side navigation/a mini-plan. Their UI, Escape,
  Back button, and restoration of the main view belong to the application.
- Possible mechanisms for loading/switching multiple maps, multiple viewports of
  one map, and layer groups are decision points to discuss closer to implementation.
- The earlier default-layer proposal is superseded by the explicit first-stage
  contract above: layers are required and no default is created. stackIndex controls
  composition rather than geometric height.
- Responsive appearance must be considered. Conditions based on component viewport
  dimensions have been proposed; syntax and supported parameters are not yet defined.
- Vertical polygon extrusion with a height has been proposed for volumetric zones.
  The exact geometry schema remains open.

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Layer contract clarification — 2026-10-08

Accepted in the current contract discussion:

- A background belongs to a layer as its property. A background shared across floor
  views lives in a separate layer that the application keeps visible. This supersedes
  the earlier proposal to register backgrounds in the shared map-object collection.
  The background property's exact data/resource format remains open.
- Runtime layers expose `visible`; the application controls each layer independently.
  Layers are initially visible. The serialized form of visibility remains open.
- Layers retain explicit object lists for their content. The user prefers this
  familiar container model; the assistant's proposal to replace lists with automatic
  spatial selection is superseded. Shared runtime objects still live in the map
  collection. A layer's ordinary content list defines its full object appearances.
  The accepted input structure uses `MapDefinition.objects` for object definitions,
  `MapDefinition.layers` for layer definitions, and `layer.objects` for object-ID
  references. An omitted list means an empty list; unknown references reject loading,
  and a reference selects all root instances with the matching ID.
- Automatic intersection display is a separate optional input: the author supplies
  spatial bounds, and the engine finds and clips intersecting geometry itself.
  The author supplies no additional intersecting-object list. The accepted field
  name is `intersectionBounds`; `intersectingObjects` describes a
  computed result, not another required input collection. Without intersection
  bounds, this automatic mechanism is inactive; ordinary layer content still displays.

`intersectionBounds` is optional. Omitting it leaves the layer's direct `objects`
and background working independently, with no automatic intersection discovery or
partial geometry clipping. Supplying it additionally enables automatic intersection
display within those bounds. Within supplied bounds, an omitted axis constraint
remains unbounded under the agreed min/max rules; omitting the entire property
disables the automatic mechanism.

After reviewing the floor-clipping illustration, the user accepted automatic
geometric clipping: the author describes a whole route once, and each layer displays
the portions within its bounds. Floor switching changes layer visibility; it does
not change or split the runtime route. This confirms the earlier spatial-clipping
decision. Author-prepared separate lines remain an available authoring choice;
manual subdivision by floor is not required for displaying a shared route.

Cut coordinates belong to derived display geometry. They create no runtime
`MapPoint`, ID, marker, or separate point hit area. Rendering and picking use the
same clipped portions; path interaction identifies the original route and the layer
where it occurred. Source geometry and existing object/vertex identity are preserved.
The author supplies spatial coordinates, including height for floor transitions,
and the layer bounds. The internal clipping algorithm, precise event shape, and
coordinate and detailed property schemas remain open; this is a design decision, not implemented
layer behavior. The shared collection, current ordered-point route representation,
and volumetric-zone prototype scope remain in effect.

The separate `intersectingObjects` input-list proposal is superseded. Automatic
intersection candidates come from the map's common object collection. The implemented intersection-bounds contract above now settles eligibility
across layers and direct appearance precedence by runtime instance. Implicit
default-layer behavior and runtime layer-management signatures also need separate decisions. This accepted
input structure does not silently settle those rules or promise scanning performance.

### Accepted map structure — 2026-10-08

The user approved this outer structure and the field names shown below. Named
values stand for serializable object/background definitions; their detailed formats
are not defined by this structural example. Runtime layer objects and management
methods remain a separate contract. This does not authorize engine implementation.

Accepted content and visibility defaults:

- Omitting `layer.objects` is equivalent to `objects: []`. A background-only layer
  can omit both `objects` and `intersectionBounds`. Supplied intersection bounds
  still enable automatic appearances independently of the direct content list.
- Each runtime layer starts with `visible: true`; the application can then switch
  layers independently.
- An object-ID reference with no matching root object rejects map loading. Under
  atomic replacement, a failed load preserves the currently active map.
- When several root objects have the referenced ID, the layer selects all matching
  runtime instances without merging them by ID or copying them. This does not change
  `map.objects.get(id)`, which returns the first matching root object.

```ts
{
  objects: [
    routeDefinition,
    firstFloorMarkerDefinition,
    secondFloorMarkerDefinition,
  ],

  layers: [
    {
      id: 'common-background',
      stackIndex: -1,
      background: commonBackground,
    },
    {
      id: 'floor-1',
      stackIndex: 0,
      background: firstFloorBackground,
      objects: ['marker-1'],
      intersectionBounds: {
        min: { z: 0 },
        max: { z: 3 },
      },
    },
    {
      id: 'floor-2',
      stackIndex: 1,
      background: secondFloorBackground,
      objects: ['marker-2'],
      intersectionBounds: {
        min: { z: 3 },
        max: { z: 6 },
      },
    },
  ],
}
```

`routeDefinition` is registered once in the map's object definitions. Each layer
automatically derives its relevant route portions from `intersectionBounds`, without
listing that route among its direct content. Each marker is selected explicitly
through its layer's object-ID list. A common background can be declared on a separate
layer with no direct objects and no automatic intersection bounds.

## Route point and path interaction — current clarification

The [polyline decision](GEOMETRY_AND_ROUTES.md#route-polylines-and-point-identity--accepted-2026-10-05)
replaces nested route-line identities with a route path and identifiable points.
A click on the connecting stroke returns the `MapRoute` in `detail.object`, without
an extra owning-route field. A point click returns its `MapPoint` in `detail.object`
and its owner in `detail.route`. Both retain map/client interaction coordinates.
Point symbols compose above their own path; root map-object order remains unchanged.

`ObjectClickDetail.object` and the constructor argument of `ObjectClickEvent` use
`MapEntry` (`MapPoint | MapLine | MapRoute`). Spatial scene entries preserve this
union, allowing consumers to narrow the object by `kind` and access `position` or
`points` without a cast. The shared `MapObject` base still owns identity and events.

Point IDs do not control visibility. Layer visibility and clipping determine which
spatial portion can participate; point materials and interaction properties will
control vertex presentation. The accepted [route-vertex separation](GEOMETRY_AND_ROUTES.md#route-vertex-geometry-symbol-and-picking--accepted-2026-10-08)
keeps position, symbol appearance, and separate point picking independent. A bend
with no symbol remains part of the route; when its point interaction is disabled,
clicks on the eligible path return the route. Layer visibility constrains all its
appearances; intersection bounds additionally constrain automatic appearances.
Route vertices default to no symbol and no separate point picking; appearance and
interaction are explicitly assigned for a point of interest and stay independent.
The current prototype draws all route vertices with
the temporary point symbol to exercise clicks, independent of supplied/generated
IDs. It adds no visibility flag to route-point data. Surface press/release behavior
is unchanged. Older line-identity wording below is historical.

## 5. Layers and floors — discussion ongoing

- Floors must be supported in the first version.
- The term layer is not yet defined. The assistant's proposal to treat a layer only
  as a drawing order was not accepted. Drawing order, physical levels, and filtering
  groups must be distinguished; the exact contract remains open.
- The proposal of one layer per object and multiple groups has not yet been accepted.
- A layer is a container of displayed content. Under the later first-stage contract,
  even a simple map declares its layer explicitly; no default is created.
- A background follows its layer's visibility. The 2026-10-08 clarification above
  makes it a layer property; a permanent background lives in a separate layer
  that the application keeps visible. The exact property format remains open.
- Layer order uses stackIndex (zIndex was rejected because it could be confused
  with the height coordinate z). Default 0; higher values appear above lower ones;
  negative values are allowed; for equal values the last layer in the data is on top.
  In 2D, objects cannot appear above a layer with a higher stackIndex.
- In a future 3D map, floors may be parts of the environment model in separate layers.
  All such layers can be enabled for a complete view. They occupy one shared map
  space and use the same camera/transformation for the entire map: rotation and
  movement must not rotate floors independently around their own centers.
- Assistant recommendation for refining the 3D contract: determine occlusion of
  world objects using depth rather than unconditional stackIndex; composition,
  transparency, and possible overlay-layer rules are not yet agreed.

### Clarification: spatial clipping by layers — accepted

- No separate level concept is introduced. The layer itself defines spatial bounds
  and clips displayed geometry: for example, a box is visible as a slice.
- Geometry uses z even in flat 2D rendering. This is the general basis for showing
  parts of objects on floors, rather than slicing by stackIndex.
- The requirement is to display the slice, not merely check intersection and show
  the entire object. A separate public intersection-detection mechanism is unnecessary;
  the internal clipping algorithm has not been chosen.
- An object should be described as a whole, without manually registering ToLayer(object)
  for every floor or dividing a route specifically by layer. Registration location,
  rules for including such objects in layers, and ownership still need definition.
- stackIndex remains a composition order, not a spatial coordinate.
- Undefined: clipping-boundary shape, shared boundaries between adjacent layers,
  cut-surface display in 3D, icon/label clipping, and identification of slice events.
- Earlier examples of floors as containers of separate objects and segments[].layer
  are not the final schema; this clarification takes precedence.
- Confirmed model: the map stores a shared objects collection; each object is registered
  once without mandatory layer references; layers display its geometry through their
  clipping bounds. Specific object filtering/layer-interaction fields are not defined yet.
- Routes are simplified to route.lines[]. There is no intermediate segments array.
  This replaces earlier route.segments and segments[].lines schemas. Points live
  inside lines; the route maintains matching adjacent endpoints through behavior.
  Lines have IDs under the common rules. A section event must identify the nested
  line and the route (the earlier payload term segment needs clarification).
- Example future volumetric object: kind box with geometry.min/max containing x/y/z,
  describing a complete axis-aligned rectangular box. A layer displays its slice.
  The principle is accepted; the exact schema and inclusion of box in version one are not approved.
- Independent map objects live in the shared objects collection; layers define content
  selection, clipping, and stackIndex. The earlier inclusion of backgrounds in that
  collection is superseded by the 2026-10-08 layer-property clarification above.
- The earlier combined object-selection/clipping proposal is superseded by the
  2026-10-08 clarification: an explicit ordinary content list and separate optional
  bounds for automatically computed intersections. The accepted map structure above
  defines the object-ID list, its empty default, and reference resolution.
- Nested lines stay inside the route: the shared collection of independent objects
  does not turn internal parts into independently reusable map objects.
- Layer references do not introduce overrides for position, label (title), or other
  object properties. An object displayed in multiple layers remains the same object.
- Repeated markers at different locations are separate objects with their own IDs,
  positions, and labels. Shared appearance is defined through materials. Application
  classification is stored in data.type; its use in material assignment remains open.
- Templates and instances for reusing complex objects may be added separately
  when a use case emerges; this mechanism is not introduced now.
- Separation principle: the object describes itself; the layer determines selection
  and display of its content. Possible layer-specific appearance rules are not defined yet.
- Agreed slice-event data: the original object's ID and the ID of the layer where
  interaction occurred. The exact event shape remains open.
- The earlier `clip` term now refers to the automatic-intersection mechanism,
  with `intersectionBounds` as its accepted field name. It displays intersecting
  geometry within the bounds without changing source objects; the ordinary layer
  content list displays full appearances independently of those bounds.
- In version one, intersection bounds define an axis-aligned region using min/max with optional
  x, y, and z limits. It may specify only a floor's z range or also x/y bounds;
  omitted constraints are unbounded.
  Example: intersectionBounds: { min: { z: 3 }, max: { z: 6 } }.
- Arbitrary clipping shapes are deferred.
- clip bounds are half-open: min is inclusive and max exclusive on the specified axes.
  For example, a marker at z = 3 belongs to [3, 6), not [0, 3).
  Lines and surfaces are cut to the boundary itself without visible gaps;
  the membership rule also applies to labels and events.
- Multiple layers may be visible simultaneously. Each layer's visibility is controlled
  independently; the application decides whether to switch floors one at a time or enable several.
- An object may have an optional stackIndex for ordering within its layer. Higher
  indices appear above lower ones; layer order takes precedence. This is 2D composition
  order; 3D depth rules are discussed separately.
- Without stackIndex, objects follow Atlas registration/creation order, with the last
  above previous objects; JSON loading uses objects order. No stackIndex needs to be
  generated or stored for this. For sorting, a missing index is treated as 0;
  equal indices use registration order. The user allowed registration order instead
  of generating an index.
- Where objects overlap, the default click target is the topmost interactive object
  under the pointer, respecting layer and object order. Visibility and interaction
  participation are independent: a visible background/zone may pass clicks through.
- Hidden appearances do not participate in target identification. Automatic
  appearances only participate within their intersection bounds.
- The behavior is agreed, but the name interactive, placing the setting in Meta,
  object overrides, and the exact API are not yet approved.
- Thin lines need an expandable hit area independent of visible stroke width.
  Its size uses screen units to remain easy to hit during zoom, including on mobile.
  The line's appearance does not change. Configuration enables/disables expansion
  and specifies hit-area width in screen units. No automatic mobile rules are introduced.
  Defaults and the exact API are not defined yet.
- Markers (icons) and labels retain their screen size during zoom by default.
  Scaling with the map can be enabled optionally. Size concerns display;
  the object's position remains in map space.
  Where this setting belongs in the contract is not yet defined.
- Line and zone-outline widths retain their screen size during zoom by default;
  they may optionally scale with the map. Geometry itself (route path, polygon
  contour, zone radius) stays in map coordinates and scales when zooming in.
  The exact configuration API remains open.

## Zoom-dependent detail and marker aggregation — future proposal, 2026-10-06

The user identified visual crowding at a whole-map view and proposed optional LOD
as a later, non-priority direction. This records an open proposal, not an approved
API or an addition to the current prototype implementation sequence.

Two approaches remain separate:

- Zoom-dependent presentation: keep important objects visible at an overview scale,
  reveal secondary symbols and labels when zooming in, and optionally reduce zone
  presentation at small scales. The application determines semantic importance;
  Atlas must not infer it from a marker category. Threshold units, configuration,
  material integration, and overrides for focused/selected objects remain open.
- Marker aggregation: replace crowded eligible point symbols with a derived summary
  that expands back into individual symbols as scale increases. The user proposed
  a rectangular summary containing one symbol per category with counts. Category
  grouping and summary appearance belong to application configuration; this does
  not settle a built-in widget or automatically merge zone/route geometry.

Architectural recommendations for later review:

- Derive presentation for a specific view without changing runtime membership,
  object positions, IDs, or serializable source geometry. Rendering and picking
  must agree about individual symbols, hidden representations, and summaries.
- Apply active-layer selection, clipping, and application filters before deriving
  summaries. Define the counted entity and deduplication policy explicitly; repeated
  appearances and duplicate IDs must not accidentally inflate or collapse counts.
- Use screen-space proximity for marker grouping. A simple grid at discrete detail
  levels is a candidate; stable membership during pan and zoom-threshold transitions
  need validation. No spatial index or clustering dependency is selected now.
- A summary interaction must remain distinguishable from an individual-object
  click. The application chooses whether to zoom, open a list, or take another
  action; event payloads and summary identity remain open.
- Zone detail needs separate semantic rules: suppressing an outline/label, reducing
  fill, and hiding a hazard are different choices. Marker aggregation does not
  automatically define zone LOD.

Suggested order after the current prototype work: validate simple zoom-dependent
detail first, then aggregation if crowding remains. Preserve unaggregated load
benchmarks so LOD does not conceal the cost of the underlying scene.

Reference mechanisms, not Atlas dependencies or contracts:
[Google Maps marker visibility by zoom](https://developers.google.com/maps/documentation/javascript/advanced-markers/collision-behavior#control_marker_visibility_by_map_zoom_level)
and [Leaflet marker clustering](https://github.com/Leaflet/Leaflet.markercluster).

## First surface events and object click/tap — merged

`press` and `release` are surface events emitted by the map component, including
when the pointer is over empty/background space. `MapSurfaceEvent.detail` contains
`mapPoint` and `clientPoint` in browser viewport CSS pixels. A release also supplies
`isClick`, indicating whether this release is eligible to trigger an object click/tap. A drag
or pinch still produces release on pointer-up, but with `isClick: false`. Pointer
cancellation and lost capture are not normal releases. These events describe input,
not selected objects. Names are the current reviewable API.

`map.clickTrigger` configures when the component identifies an object and emits
`objectclick`: `release` by default, or `press` for immediate response. Default
release handling requires `isClick: true` and performs one hit test at the release
position. It does not retain or compare the object at pointer-down. Press mode
responds immediately. When it hits an object, the gesture is consumed: subsequent
pointer movement and pinch do not move or zoom the camera, and release does not
produce a second object click. The gesture stays consumed until all tracked pointers
are released or cancelled; wheel zoom is suppressed while it is consumed. Pressing
empty space does not consume the gesture, so background panning remains available.
Changing the trigger or successfully replacing the map
cancels pending release-click eligibility. Disconnect discards the pending gesture.

`ObjectClickEvent.detail` contains the runtime `object`, `mapPoint`, and
`clientPoint`. Both surface and object events bubble and cross enclosing Shadow DOM
boundaries; they are notifications without a default action to cancel. Atlas does
not create selection state, a description panel, or a popup. The Factory example
renders object details in ordinary application HTML, displays surface events, and
provides a press/release selector.

The spatial subsystem identifies the topmost eligible point using the shared
symbol description, runtime position, and camera projection. It does not inspect
SVG elements; see [spatial implementation](RENDERER_AND_COMPONENT.md#spatial-implementation--merged). Pointer capture does not determine the hit target. Object hit
tests exclude positions outside the viewport. Empty/background clicks produce surface
events but no object event. Point symbols still use temporary built-in appearance.

The input recognizer waits for movement beyond 5 client CSS pixels before panning,
so small tap movement does not move the camera. Once dragging starts, returning to
the starting point does not restore release-click eligibility. Multi-pointer input,
pointer cancellation/lost capture, and wheel zoom also cancel that eligibility.
The threshold is explicitly temporary and will be replaced by input configuration.

Picking scans shared scene points in reverse composition order. Spatial indexing
remains dependent on measurements. Interaction participation settings, layer IDs,
hover, keyboard activation, and configurable hit-area expansion remain later steps.

The subsequent [line step](GEOMETRY_AND_ROUTES.md#line-geometry--merged)
extends the same event contract to straight segments. Points and lines use one
composition order for both rendering and picking. The temporary round line stroke
also defines its hit area, including collapsed segments with coincident endpoints.
Hit-area expansion is still a separate configuration decision.

The [first route slice](GEOMETRY_AND_ROUTES.md#first-route-slice--pending-review)
keeps the same events and adds optional `detail.route` for an owned line.
`detail.object` is the clicked runtime line; `detail.route` is the same route
instance stored in `map.objects`. Independent objects omit this field. Route lines
use their owner's position in composition order, with later lines on top within
the route. The surface press/release contract and gesture handling do not change.
