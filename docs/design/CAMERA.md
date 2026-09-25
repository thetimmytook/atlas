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
