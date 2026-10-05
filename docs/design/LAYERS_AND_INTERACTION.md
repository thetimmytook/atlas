# Layers And Interaction

## Clarifications after studying tarkov.dev

- Both scenarios are useful: local building floor switching on the main map
  and a separate detailed view with side navigation/a mini-plan. Their UI, Escape,
  Back button, and restoration of the main view belong to the application.
- Possible mechanisms for loading/switching multiple maps, multiple viewports of
  one map, and layer groups are decision points to discuss closer to implementation.
- The default layer is chosen by stackIndex, not geometric height.
  The proposed fallback is the lowest stackIndex; an explicit default in the map definition
  should allow another layer. The exact contract and interaction with groups remain open.
- Responsive appearance must be considered. Conditions based on component viewport
  dimensions have been proposed; syntax and supported parameters are not yet defined.
- Vertical polygon extrusion with a height has been proposed for volumetric zones.
  The exact geometry schema remains open.

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

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
control vertex presentation. The current prototype draws all route vertices with
the temporary point symbol to exercise clicks, independent of supplied/generated
IDs. It adds no visibility flag to route-point data. Surface press/release behavior
is unchanged. Older line-identity wording below is historical.

## 5. Layers and floors — discussion ongoing

- Floors must be supported in the first version.
- The term layer is not yet defined. The assistant's proposal to treat a layer only
  as a drawing order was not accepted. Drawing order, physical levels, and filtering
  groups must be distinguished; the exact contract remains open.
- The proposal of one layer per object and multiple groups has not yet been accepted.
- A layer is understood as a container of displayed content, not merely drawing order.
  A default layer exists: a simple map need not select it explicitly.
- A background is displayed layer content and follows layer visibility together
  with other objects. A permanent background can live in a separate layer
  that the application does not offer to switch.
- This clarifies the assistant's proposal for a special optional background field:
  neither that field nor a one-background-per-layer restriction is fixed.
  The exact background object kind/contract remains open.
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
- Independent map objects, including backgrounds, live in the shared objects collection;
  layers do not duplicate geometry but define content selection, clipping, and stackIndex.
- A layer may select all objects or an explicit set by ID, then apply clipping.
  The source/objects field name and exact selection schema remain open;
  selecting all objects by default was proposed but not separately approved.
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
- clip is an optional layer property. The layer selects objects and then displays
  only geometry inside clip without changing the source objects. No clip means no clipping.
- In version one, clip defines an axis-aligned region using min/max with optional
  x, y, and z limits. It may specify only a floor's z range or also x/y bounds;
  omitted constraints are unbounded.
  Example: clip: { min: { z: 3 }, max: { z: 6 } }.
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
- Hidden objects and geometry outside clip do not participate in target identification.
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
