# Camera

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

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

## First camera implementation — pending review

The user requested center/zoom, fitting the background, and example buttons as a
separate step before pointer gestures. The following API is the implementation
proposal for review, not the complete camera contract:

- `map.camera` exposes a renderer-independent `Camera` instance.
- Assign `camera.center = new Point(x, y)` in map coordinates and `camera.zoom` as CSS
  pixels per map unit. Zoom changes preserve the center; center values must be
  finite and zoom must be finite and greater than zero.
- `map.fit()` fits the current background; before a map is loaded it does nothing.
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

Pointer/touch gestures, animation, fit padding, homeView, configurable camera
constraints, and multiple-camera management remain later steps. No new runtime
dependencies or browser input handlers were introduced.

## Shared math primitives — accepted

Use `src/math/` for the internal math module, without a dependency or separate
package. Start with immutable `Point(x, y)` and `Rect(x, y, width, height)` classes,
one per file. Their constructors encapsulate freezing; they currently store values
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
