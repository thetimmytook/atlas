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

## First implementation step — merged

The user requested only the Web Component as the first reviewable step.
`AtlasMap` extends `HTMLElement`, creates an open Shadow DOM with an empty SVG
surface, and observes the host content size while connected. Detaching disconnects
the observer; reconnecting reuses the surface and resumes observation.
The host application provides the element's size and explicitly registers
`atlas-map`; importing the library does not register a custom element automatically.

This is a component shell, not the final renderer interface. Runtime access,
asynchronous map loading, backgrounds, camera behavior, and public interaction
events remain subsequent steps. The synchronous browser custom-element constructor
does not establish the future asynchronous loading contract.

Following the user's review, static markup and CSS now live in `atlas-map.html`
beside `atlas-map.ts`. Vite imports the template as a string through `?raw`; component styles remain isolated inside Shadow DOM. This separation
is prepared for review and does not define the map material system.

## Map definition and background step — merged

Following review, the component accepts `MapDefinition`: serializable map data
with a `background` description (image URL and explicit map-space width/height).
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

The renderer now has an abstract `AtlasRenderer` base and an SVG-specific
`SvgRenderer` implementation, as requested during review. The component types its
renderer through the base class. Background preparation returns a `show()` handle,
so SVG elements stay inside the concrete renderer and a load is displayed only
after preparation succeeds. This is a minimal prototype contract,
not the complete renderer API.

## Camera integration — merged

The component now owns an independent camera and subscribes to its changes while
connected. `AtlasRenderer.render(viewport, bounds)` receives display dimensions
and the calculated map-space rectangle; `SvgRenderer` only applies these values.
The previous renderer-owned center/scale calculations moved to `Camera`.
See [camera implementation](CAMERA.md) for the proposed API and scope.

## Object display — pending review

The first object slice adds optional `objects` to `MapDefinition`, currently using
`{ id?, geometry: { kind: 'point', position: { x, y } } }`. Atlas renders geometry;
marker and zone semantics belong to the application. Explicit IDs must be non-empty
and unique within the map; omitted IDs are generated by `AtlasId()` and retained
in the prepared definition and runtime objects. IDs are opaque strings.

`element.objects` is an iterable collection with `size` and `get(id)`. Each
`AtlasObject` is an `EventTarget`; assigning `object.geometry` validates and copies
its value, then emits `change`. The component coalesces changes into its next render
frame and reuses SVG elements. Geometry is immutable when read. Collection mutation,
nested setters, and batch are later steps. A successful map load replaces the
collection; retained old objects remain usable but no longer update this component.
Failed preparation preserves the previous collection and display. Disconnect and
reconnect release and restore subscriptions while keeping the objects.

`element.definition` remains the immutable input snapshot with resolved IDs;
runtime edits do not mutate it. Live export is a separate planned API.

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
Hit testing, click/tap events, and popups are not implemented in this slice.
