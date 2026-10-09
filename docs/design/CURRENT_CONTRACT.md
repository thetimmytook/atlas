# Current Atlas contract

[Main navigation](../DESIGN_MAIN.md) · [Current work](PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09)

Verified on 2026-10-09 against merged commit `bc87449`, including polygon PR #30.
The authority for available names is [src/index.ts](../../src/index.ts); behavior
was checked in the runtime, validators, scene preparation and SVG renderer at that
commit. Parallel runtime fixes under review are excluded from this baseline.
This summary takes precedence over older implementation notes and design examples;
topic documents retain decisions and their history.

## Status key

| Status                         | Meaning and current examples                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented and merged         | Available in the checked baseline: four object kinds, explicit layers, spatial clipping, camera/input, load snapshots and runtime editing.                                                                                                                  |
| Temporary implemented contract | Available, but provisional: URL/size backgrounds, built-in appearance, payload-free `change` and collection `add`/`remove` notifications, internal single-consumer scene changes.                                                                           |
| Accepted, not implemented      | Route geometry/symbol/picking separation and its no-symbol/no-point-picking default; batch; minimal materials and labels/property registration; resource registry, schemaVersion, homeView and camera constraints. Exact unfinished APIs remain unfinished. |
| Open or deferred               | Public core/model lifecycle, multiple viewports, runtime export, material/interaction field schemas, polygon outlines/holes/nonhorizontal geometry, broader browser/mobile validation and numerical load targets.                                           |

## Public entry and map input

The exported runtime values are `MapElement`, `Camera`, `Point2`, `Point3`, `Rect`,
`Size`, `MapObject`, `MapPoint`, `MapLine`, `MapRoute`, `MapPolygon`, `createId`,
`AtlasError`, `MapSurfaceEvent` and `ObjectClickEvent`. Definitions and event details
are exported types. `MapObjectCollection`, `MapEntry`, `MapLayer`,
`MapLayerObjectIdCollection` and `MapCoordinates` are type exports; their instances
are obtained through the component. `MapModel`, spatial helpers and renderers are
internal, with no package-root export or public standalone core lifecycle.

`map.load(definition)` accepts `MapDefinition`: required `layers` and optional
`objects` (omission means empty). Every object explicitly declares a structural
kind. Top-level backgrounds and implicit/default layers are unsupported;
`layers: []` is valid and displays nothing.

| Kind / definition / runtime                       | Implemented geometry and editing                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `point` / `MapPointDefinition` / `MapPoint`       | `position`; complete validated replacement.                                                                                                                                                            |
| `line` / `MapLineDefinition` / `MapLine`          | Exactly two owned `MapPoint` instances in `points`; edit their positions.                                                                                                                              |
| `route` / `MapRouteDefinition` / `MapRoute`       | Ordered owned `points`; adjacent pairs form a polyline, with no line objects. `addPoint`, `insertPoint`, `removePoint` by exact instance and `replacePoints` over `[startIndex, endIndex)` are merged. |
| `polygon` / `MapPolygonDefinition` / `MapPolygon` | One horizontal x/y `contour`, independent `baseZ` and `height`; `setVertex`, `setContour` and validated vertical setters.                                                                              |

`MapEntry` is `MapPoint | MapLine | MapRoute | MapPolygon`; the definition union
contains the corresponding four definitions. Application marker/zone meaning stays
outside the engine. `data.type` is an accepted future classification location;
`data`, labels and materials are not implemented object fields.

## Coordinates and polygons

Coordinates use x right, y down, z up. Frozen `Point2(x, y)` serves camera, input,
conversion and query coordinates; frozen `Point3(x, y, z = 0)` serves runtime point
positions. The old `Point` export has no compatibility alias. Position input accepts
plain x/y or x/y/z values and `Point2 | Point3`; `MapPoint.position` returns `Point3`.
Assignment replaces the **whole** position and copies it: omitted z becomes 0,
even when the previous point was above zero. To retain height, supply its current z.
Camera/client conversion uses x/y and does not infer pointer height.

Polygon contour vertices are frozen `Point2` snapshots, without point IDs or
separate vertex symbols/picking. Any vertex z property, including `z: undefined`,
is rejected. Simple convex/concave contours in either winding are supported;
repeated vertices, self-intersections and holes are rejected. `baseZ` and `height`
default to 0. Base may be negative; height is nonnegative, and the resulting upper
height must be finite and strictly above base for positive height. Each setter
validates the complete candidate state before mutation.

Zero height is a plane; positive height is a vertical extrusion over
`[baseZ, baseZ + height)`. A plane uses half-open z membership; a volume requires
positive-length vertical overlap. Every clipped cell without positive x/y area is
discarded from both display and picking. No remaining cells means no appearance;
disconnected retained regions share the original polygon identity. SVG shows the
x/y fill projection. External result contours are required before outline support.
See [polygon details](GEOMETRY_AND_ROUTES.md#horizontal-polygons-and-vertical-extrusion--accepted-contract-2026-10-09).

## Layers, identity and runtime state

Each explicit layer has optional `id`, `stackIndex` (default 0), direct object-ID
`objects`, background and `intersectionBounds`. Layers start visible. Layer IDs
must be unique; root/owned-point IDs may duplicate. Missing IDs use `createId()` /
`crypto.randomUUID()`; explicit nonempty IDs are preserved without a registry.
A direct ID selects **all matching roots**; `map.objects.get(id)` returns the
**first root** in collection order. Owned points are not root references unless
separately attached as roots. Unknown references reject loading; runtime ID
membership may precede attachment of a matching root.

`layer.objectIds.add/remove/has` controls direct membership; `layer.objects` is a
frozen current array of direct roots only. `layer.visible` controls background,
display and picking together. Composition is ascending `stackIndex`, then declaration
order; roots follow collection order, and route point symbols follow their path.
Backgrounds are below their layer's objects and do not intercept picking.

Optional frozen `intersectionBounds` uses partial x/y/z min/max limits, with at
least one finite constraint and min < max on doubly bounded axes. Omitted bounds
disable automatic appearances; omitted axes are unbounded. There is no runtime
bounds setter. Bounds derive appearances from all current roots. Direct content
stays whole and takes priority over clipping of that root in the same layer.
Cuts create no runtime points or IDs; SVG and picking share the derived geometry
and original identity. Axis membership is `[min, max)`; stroke picking also
accounts for screen thickness. See [boundary rules](LAYERS_AND_INTERACTION.md#intersection-bounds-contract--accepted-and-implemented-for-review-2026-10-08).

`map.objects` supports `size`, iteration, `get`, `add` of any of the four definitions
or runtime instances, and `remove` by exact root instance. Definitions are copied;
instance attachment retains identity and repeated attachment is a no-op. Detached
instances remain usable and may be reattached/shared between maps. This does not
provide multiple views of one model. Frozen owned-point arrays retain old membership
when saved, while the contained runtime points remain live.

`map.definition` is `ResolvedMapDefinition | undefined`: a deeply frozen, copied
**load snapshot** with completed IDs. Runtime root, point, polygon, layer-membership
and visibility edits never update it; it is not current-state serialization.
Validation and background preparation precede replacement; failure preserves the
active map/camera. Concurrent loads reject with `MAP_LOAD_IN_PROGRESS`.
Disconnect stops observation/rendering and reconnect resumes current state; it
does not cancel an in-flight load. See [loading](RUNTIME_AND_LOADING.md#layered-map-input--accepted-2026-10-08-first-stage-implemented-for-review).

## Input and events

`map.camera` exposes center/zoom setters and `fit(rect)`; zoom is positive CSS pixels
per map unit. `map.fit()` fits all layer backgrounds, including hidden ones, and
does nothing without backgrounds. Resize preserves center/zoom. `map.coordinates`
converts map/client positions when the connected surface has nonzero size.

`press` and `release` describe the surface, including empty space, with planar
`mapPoint` in map units and viewport-CSS `clientPoint`. Release has `isClick`; dragging, pinch
and wheel cancel release-click eligibility. Pointer cancellation/lost capture are
not normal releases and emit no `release`. `objectclick` carries the original
`object`, hit runtime `layer`, both coordinates, and `route` for an owned route
point. A path hit returns the route; a polygon hit returns the polygon. These events
bubble and cross Shadow DOM; they create no selection or application UI.

Set the JavaScript property `map.clickTrigger`: `release` is default and picks only
eligible releases; `press` picks immediately. It is not an observed HTML attribute.
An accepted first-hit press consumes the gesture until all tracked pointers end:
pan, pinch and wheel are suppressed, and release produces no second object click.
Empty-space presses permit panning. A surface handler runs before object delivery;
the captured hit is revalidated against current geometry/membership/visibility,
without selecting an underlying replacement hit.

**Pending fixes, excluded from this baseline:** route-owned membership edits still
cause global reconciliation; a second pointer can incorrectly trigger press-mode
picking and consume a valid pinch. The accepted correction preserves first-hit
press consumption and surface events. Its implementation/signatures and new gesture
coverage remain under review. A public cancellation notification is still open.
See [accepted follow-up](PROTOTYPE.md#repeat-review-follow-up--accepted-2026-10-09).

## Temporary implemented contracts

| Current implementation                                                                                                                                                                                                                    | Intended replacement / limit                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Point circles: radius 11 CSS px, 2 px white stroke, blue `#2775d9` fill. Every original route vertex has a symbol and separate picking when its appearance is eligible. Cut coordinates have neither.                                     | Resolved materials and independent point interaction. Accepted future route default is no symbol and no separate point picking; it is **not implemented**. Line endpoints have no separately prepared symbols. |
| Line/route stroke: 4 CSS px, orange `#d95012`, round caps/joins. Polygon fill: `#f59e0b`, opacity 0.3, no outline.                                                                                                                        | Material-derived appearance; polygon outlines additionally need external contours.                                                                                                                             |
| Background `{ source, size: { width, height } }` at map origin; decoded as an image.                                                                                                                                                      | Accepted resource/background-placement design, without a current registry or pluggable loader.                                                                                                                 |
| Payload-free synchronous object/layer `change`; root-collection synchronous `add`/`remove` with the runtime object as detail after mutation.                                                                                              | Future agreed collection/change-event contract; property/old/new-value payloads are not implemented.                                                                                                           |
| Internal `MapModel` owns snapshot, roots/layers, geometry, spatial queries and observation. Internal `SceneGeometry.takeChanges()` drains one renderer's pending set; picking does not drain it. Component RAF coalesces display updates. | Provisional single-consumer mechanism, not public lifecycle, `map.batch` or multi-viewport support.                                                                                                            |

## Accepted future work and open decisions

Batch, minimal materials, label/property registration and resource/schemaVersion
design remain accepted future work; their illustrative APIs are not available now.
Home view, camera constraints and animation also remain unimplemented.
Public model lifecycle, multiple viewports, current-state export, exact material and
interaction schemas, cancellation notification, broader browser/mobile validation
and numerical performance targets remain open/deferred. Historical counts and
measurements belong to their dated stages in [Prototype](PROTOTYPE.md) and
[Tooling](../TOOLING.md); they do not certify this whole prototype or pending fixes.
