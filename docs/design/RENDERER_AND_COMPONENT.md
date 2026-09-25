# Renderer And Component

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Runtime / renderer boundary — agreed

- Runtime owns objects and their behavior, validation, material and inheritance
  resolution, layers/visibility/clip bounds, camera state, normalized events,
  change tracking, and batch.
- The renderer draws using a specific technology, translates material parameters,
  applies clipping and camera projection, identifies the object under the pointer,
  and updates affected display content.
- The renderer receives a prepared display description and returns interaction-target
  results; it does not define object business behavior, route changes, or the
  application's response to clicks.
- Start with an SVG renderer and validate the contract against it. Future backends
  connect through this boundary; exact interfaces are not defined yet.
- Continue discussion in broad blocks; preserve the user's specific ideas as decisions
  or decision points so they are not lost before signature design.

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
