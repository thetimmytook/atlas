# Camera

Current baseline: [Current contract](CURRENT_CONTRACT.md). Camera, pointer controls
and planar conversions are merged; the press-mode second-pointer correction remains
under review. Animation, homeView and configurable constraints are accepted future
work; multiple viewports and keyboard APIs remain open.

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

<a id="planar-coordinate-contract--accepted-and-implemented-for-review-2026-10-09"></a>

## Planar coordinate contract — merged in PR #29, 2026-10-09

`Camera.center` uses frozen `Point2` values. Assignment validates and copies x/y,
including spatial values passed structurally; it does not retain a z coordinate.
`MapCoordinates.mapToClient(point: Point2): Point2` can read x/y from `Point3`.
`clientToMap(point: Point2): Point2` returns a planar location without inferring
height. Surface/object events also carry `Point2` coordinates. Object positions and
spatial clipping use `Point3`; see the [current coordinate contract](GEOMETRY_AND_ROUTES.md#planar-and-spatial-coordinates--accepted-and-implemented-for-review-2026-10-09).

The `Point` name in earlier implementation notes below is historical and is replaced
by `Point2` for camera/input consumers. Math constructors still store/freeze values;
finite-coordinate validation belongs at the consuming API boundary.

## 6. Camera — requirements identified while discussing layers

- Agreed application-invoked operations: show the entire map (choose center and zoom),
  focus/zoom to an object, and fit a route or several objects into the viewport
  with screen-space padding.
- The application decides when to move the camera: it handles an event and calls
  the camera API. Clicking does not imply an automatic camera response.
- Camera transitions support immediate and animated modes; animation and duration
  can be configured per call. Defaults and the exact API remain open.
- A sufficient API foundation is setting center/zoom and fitting a supplied area
  (a provisional fitBounds with padding). Method names, obtaining object bounds,
  and conflicts with camera constraints still need clarification.

- Camera constraints are needed; in future 3D they should also prevent uninformative
  angles such as viewing from below. Exact settings and values are not defined.
- A saved initial/normal view is needed for a quick return on application command
  (similar to recenter). This is a view state, not the map coordinate origin.
- The name homeView is approved; it is the shared initial view for the entire map:
  center, zoom, and orientation where applicable. The proposed resetView() is not approved yet.
- Agreed constraints: pan bounds, min/max zoom, permission/limits for rotation,
  and min/max tilt in 3D. Implementation and API will be discussed later.
- Open: exact camera behavior on floor changes and the initial view when homeView
  is absent. Keeping the current camera on a floor change has been proposed.
- The user raised multiple cameras without a concrete use case. This is currently
  an extensibility question, not a first-version requirement. Distinguish saved views,
  switchable cameras, and simultaneous viewports with different cameras.
- Agreed: one active camera per viewport. This does not limit the whole map to one
  camera: several viewports may show the map through different cameras simultaneously.
  The camera is a separate entity; its state is not embedded in layers. Multiple
  simultaneous viewports and a camera registry are not yet mandatory scope.

## First camera implementation — merged

The user requested center/zoom, fitting the background, and example buttons as a
separate step before pointer gestures. The following merged API is the initial subset of the camera design:

- `map.camera` exposes a renderer-independent `Camera` instance.
- Assign `camera.center = new Point2(x, y)` in map coordinates and `camera.zoom` as CSS
  pixels per map unit. Zoom changes preserve the center; center values must be
  finite and zoom must be finite and greater than zero.
- `map.fit()` fits all layer background extents, including hidden layers; before a map is loaded it does nothing.
  `camera.fit(new Rect(x, y, width, height))` fits an explicit rectangle.
- The component supplies viewport dimensions through `camera.resize(new Size(width, height))`. Camera
  bounds are calculated independently of SVG; the renderer applies them.
- Resize preserves center/zoom. A fit requested at zero viewport size waits for
  the first nonzero size. Explicit center/zoom changes cancel a pending fit.
- Loading a new map successfully fits its background. A failed load preserves
  both the displayed map and camera. Detaching retains camera state and removes
  the component's camera subscription; reconnecting displays the current state.
- Example buttons change zoom, move the camera, and fit the map. Moving right
  moves the camera center right, so the map content moves left on screen.

Pointer/touch gestures subsequently merged as described below. Animation, fit
padding, homeView, configurable camera constraints and multiple-camera management
remain later work. The initial center/zoom step introduced no runtime dependencies
or browser input handlers; pointer handlers arrived in the later merged step below.

<a id="camera-at-the-scene-model-boundary--accepted-2026-10-06-implemented-for-review"></a>

## Camera at the scene-model boundary — merged in PR #23

Internal scene ownership now lives in `MapModel`; the viewport's `Camera` remains
in `MapElement`. `Spatial.hitTest(point, camera)` receives the camera per query, so
the model has no single stored camera. Controls, coordinate conversion, resize,
fit after successful load, and RAF scheduling remain view responsibilities.
Failed preparation preserves the existing camera, and disconnect/reconnect retains
its state. This extraction adds no camera API or multiple viewport management.

## Shared math primitives — accepted

Use `src/math/` for the internal math module, without a dependency or separate
package. The original immutable `Point(x, y)` has been replaced by `Point2(x, y)`
and spatial `Point3(x, y, z = 0)`; `Rect(x, y, width, height)` remains. Keep one class
per file. Their constructors encapsulate freezing; they currently store values
only. Camera center and bounds use these shared types instead of camera-specific
point/rectangle interfaces. Camera validation stays at the camera boundary.
Vectors, matrices, arithmetic, and further dimensions wait for concrete consumers.

`Size(width, height)` is the shared immutable dimensions type and replaces
`CameraViewport`. Math primitives only store values; validation belongs at public
API boundaries, including camera setters and methods exposed through `map.camera`.
Internal renderer calls trust validated inputs.

Reusable number, point, and size validation belongs in `src/validators/`, separate
from `src/math/`. Public camera operations call these validators. Size validation
allows zero by default; `fit()` requests strictly positive dimensions. Validators
use generic error codes (`INVALID_NUMBER`, `INVALID_SIZE`) and structured context.

## Deferred optimization: reuse computed geometry

The user requested a later optimization of allocations in frequently executed
camera/render paths. In particular, `Camera.bounds` currently constructs a new
`Rect` on every read, even when the camera and viewport have not changed.
Avoid repeated temporary allocations and resulting garbage-collection pressure
by reusing computed structures. This is recorded work, not part of the current step.

Decide between caching immutable results until their inputs change and reusable
internal mutable buffers. Preserve the public immutable-value contract: objects
retained by consumers must not silently change. Measure allocations and frame times
before and after optimization; broader pooling is not prescribed by this decision.

## Change notifications and scheduling — accepted

`Camera` extends the standard `EventTarget` and dispatches `change` synchronously
following a successful state update. Consumers use `addEventListener` and
`removeEventListener`; there is no custom Observable/subscribe API.

The component schedules rendering on demand through `requestAnimationFrame`.
Multiple camera changes before the scheduled callback produce one render using
the latest state. There is no continuous render loop. Disconnecting removes the
listener and cancels a pending frame; reconnecting schedules the current view.
Events remain synchronous; only rendering is deferred. Completion of `load()`
means resource preparation/application is complete, not that a browser frame has
already been painted.

<a id="pointer-controls-and-coordinate-conversion--pending-review"></a>

## Pointer controls and coordinate conversion — merged

The user requested mouse drag, cursor-anchored wheel zoom, one-finger touch pan,
and two-finger pinch zoom as the next implementation step. Browser handlers live
in `CameraControls`, separate from camera state and renderer. The component connects
and disconnects them with its lifecycle, releasing captures and active gestures.

- Primary-button drag and single-pointer touch/pen movement pan the map. Pointer
  capture keeps dragging active outside the surface. Pointer cancellation and lost
  capture remove the pointer; lifting one pinch pointer continues as a one-finger pan.
- Up to two pointers participate. Pinch combines midpoint movement with the change
  in distance, preserving the map point under the moving midpoint. Rotation is absent.
- Wheel zoom preserves the map point under the cursor. Pixel, line, and page delta
  modes are normalized. Line height and zoom sensitivity are prototype constants,
  not a final settings contract. Wheel scroll is consumed over the map surface.
- `touch-action: none` applies to the surface so touch gestures control the map;
  gestures outside it remain browser/application behavior.
- `map.coordinates.mapToClient(point)` and `map.coordinates.clientToMap(point)` convert between map space
  and browser client coordinates (CSS pixels relative to the window viewport).
  They use current camera state and the surface rectangle, accounting for document
  scroll, host borders/padding, and positive axis-aligned CSS scaling. CSS rotation,
  skew, reflection, and perspective transforms are not supported by this prototype.
- Conversion requires a connected, nonzero surface and initialized camera viewport;
  otherwise it throws `VIEWPORT_UNAVAILABLE`. Coordinates outside the surface can
  still be converted, which supports captured dragging.

The existing camera change events and on-demand rendering remain in use. Camera
constraints, input configuration, configurable picking, keyboard bindings and input
allocation optimization are separate follow-ups. Object picking has since merged;
[the input contract](CURRENT_CONTRACT.md#input-and-events) records press consumption
and the pending second-pointer fix. Desktop and browser-emulated touch
are checked in Chrome; physical iOS/Safari and Android testing remains outstanding.

Browser references: [Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture),
[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action),
[wheel delta modes](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode).

## Public API grouping — accepted

Expose coordinate conversion through the read-only `map.coordinates` getter,
parallel to `map.camera`, rather than forwarding individual conversion methods
from the component. The same converter reads current camera and surface state.
`map.fit()` remains a convenience operation using the loaded map's bounds.

Renderer and input handlers remain internal. Future object/layer collections may
be exposed as `map.objects` and `map.layers` when implemented. Loading requests
remain a separate planned task; no empty API groups are added now.
