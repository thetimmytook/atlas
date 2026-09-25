# Atlas — Design Document

**Status:** Draft / architectural direction  
**Repository:** https://github.com/thetimmytook/atlas  
**Project name:** Atlas  
**Package name:** TBD

## 1. Overview

Atlas is a renderer-independent interactive map engine intended for reusable web applications.

The core idea is to separate:

- map data and geometry;
- semantic object types;
- visual presentation;
- interaction behavior;
- rendering technology.

Atlas should not expose SVG, Canvas, WebGL, Leaflet, D3, React, or CSS concepts as part of the canonical map model.

The initial implementation is expected to use a Web Component with Shadow DOM and an SVG-first renderer, with selected D3 modules used as low-level utilities for interaction and geometry where they are useful.

The architecture must leave room for Canvas, WebGL, pseudo-3D, and true 3D renderers later without changing the map data model.

---

## 2. Goals

Atlas should provide:

1. A reusable map component that can be embedded in React or used without React.
2. A serializable JSON-based map representation.
3. Semantic map objects such as markers, routes, zones, labels, and future custom object kinds.
4. A presentation layer that is independent from a concrete rendering backend.
5. A small material system instead of CSS as the canonical styling contract.
6. Declarative, event-oriented behaviors attached through map metadata.
7. Renderer-independent normalized map events.
8. An SVG-first implementation that does not prevent future Canvas or WebGL renderers.
9. A stable public component/domain API even if the internal renderer is replaced.

---

## 3. Non-goals

At this stage Atlas is **not** intended to define:

- a full GIS platform;
- a geographic projection system equivalent to Leaflet;
- a CSS parser or CSS-compatible styling engine;
- a shader graph or Unreal-style material editor;
- a final 3D engine;
- final public TypeScript interfaces for every subsystem.

The exact contracts for scene, renderer, camera, materials, events, and behavior context remain open until the first prototype proves the model.

---

## 4. High-level architecture

```text
Application / AI / Backend
          |
          v
     Map JSON
geometry + semantics + data
          |
          v
      Map Meta
type -> material + behaviors
          |
          v
   <atlas-map> Web Component
          |
      Shadow DOM
          |
          v
 Scene / Interaction Runtime
          |
          v
      Renderer
   /       |       \
 SVG     Canvas    WebGL
```

The public model must not depend on the renderer chosen underneath.

---

## 5. Web Component boundary

Atlas should expose a reusable Web Component as the main browser integration boundary.

Conceptually:

```html
<atlas-map></atlas-map>
```

Responsibilities of the component may include:

- lifecycle;
- scene loading and updates;
- renderer ownership;
- input/event normalization;
- viewport/camera state;
- dispatching public domain events;
- Shadow DOM and style isolation.

React should see the component as a normal custom element rather than directly managing the map's internal DOM.

Conceptually:

```text
React / Vue / plain HTML
          |
          v
      <atlas-map>
          |
     Shadow DOM
          |
      Atlas runtime
```

This isolates imperative rendering code from framework lifecycle and prevents renderer-specific DOM/CSS concerns from leaking into application code.

---

## 6. Shadow DOM

The component should use Shadow DOM.

This is intentional.

Benefits include:

- renderer DOM is isolated from application styles;
- application CSS does not accidentally affect map internals;
- map styles do not leak into the host application;
- SVG/DOM implementation details remain private;
- renderer internals can later change without affecting consumers.

A global Leaflet-style stylesheet dependency is specifically something Atlas should avoid.

---

## 7. Map data model

The canonical map representation should remain plain serializable data.

A map object should describe **what the object is**, not how a specific renderer draws it.

Example:

```json
{
  "id": "extract-zb1011",
  "kind": "marker",
  "type": "extract",
  "position": {
    "x": 10,
    "y": 10
  }
}
```

Another example:

```json
{
  "id": "route-main",
  "kind": "route",
  "type": "recommended",
  "points": [
    { "x": 10, "y": 10 },
    { "x": 20, "y": 16 },
    { "x": 32, "y": 25 }
  ]
}
```

### `kind`

`kind` represents the structural/geometry category understood by Atlas.

Possible examples:

```text
marker
route
zone
label
image
```

The final set is not yet fixed.

### `type`

`type` is semantic and application-defined.

Examples:

```text
marker + extract
marker + loot
marker + quest

route + recommended
route + danger
route + evacuation

zone + danger
zone + quest
```

Atlas should not require a globally fixed list of semantic types.

This separation is important:

```text
kind = what kind of map object this is
type = what this object means in the current domain
```

---

## 8. Map Meta

Presentation and default behavior should be defined separately from geometry/data.

Conceptually:

```ts
const meta = {
  marker: {
    extract: {
      material: "marker.extract",
      behaviors: {
        click: "selectObject",
        pointerenter: "highlightObject",
        pointerleave: "unhighlightObject"
      }
    }
  },

  route: {
    danger: {
      material: "route.danger",
      behaviors: {
        click: "selectObject",
        pointerenter: "highlightObject",
        pointerleave: "unhighlightObject"
      }
    }
  }
};
```

This gives Atlas a clean resolution model:

```text
MapObject
  |
  +-- kind
  +-- type
        |
        v
     Map Meta
      /    \
 material  behaviors
```

The same map JSON can therefore be rendered with different presentation metadata.

Potential examples:

- normal application theme;
- editor mode;
- debug mode;
- print mode;
- simplified mobile presentation;
- alternative branded theme.

---

## 9. Styling principle: no CSS contract

CSS must **not** be the canonical styling API of Atlas.

CSS is tied to DOM/SVG rendering and does not translate naturally to Canvas, WebGL, materials, shaders, or true 3D.

Atlas therefore should not expose something like this as its primary presentation model:

```ts
{
  className: "danger-route"
}
```

or:

```ts
{
  style: "stroke: red; width: 3px"
}
```

Renderer-specific CSS may still exist internally as an implementation detail, but canonical map metadata must not depend on it.

---

## 10. Mini material system

Atlas should have a small renderer-independent **Material** concept.

The exact schema is intentionally not fixed yet.

At a high level, a material may express presentation concepts such as:

```ts
{
  color: "...",
  opacity: 0.8,
  fill: "...",
  stroke: "...",
  width: 3,
  size: 24,
  dash: [8, 4],
  icon: "extract"
}
```

These fields are examples only.

The important architectural rule is:

> A material describes visual intent, not renderer implementation.

A semantic material could therefore be interpreted differently by different renderers.

Example:

```text
route.danger
    |
    +-- SVG renderer
    |     -> stroke / stroke-width / stroke-dasharray
    |
    +-- Canvas renderer
    |     -> strokeStyle / lineWidth / setLineDash
    |
    +-- WebGL renderer
          -> material properties / uniforms / shader parameters
```

Material values may later reference design tokens rather than literal colors:

```ts
{
  stroke: "color.danger",
  width: 3
}
```

---

## 11. Material inspiration

The conceptual inspiration is closer to game-engine material systems than to CSS.

Useful ideas include:

### Source / Source 2

A material is effectively:

```text
material/shader model
+
parameters
+
optional dynamic behavior
```

### Unreal Engine

Useful concepts include:

- base materials;
- parameterized materials;
- material instances;
- per-instance parameter overrides.

Atlas should borrow the **concept**, not reproduce those systems.

A future material model may support something conceptually like:

```ts
{
  name: "route.danger",
  extends: "route.base",
  parameters: {
    color: "color.danger",
    dash: [8, 4]
  }
}
```

Per-object overrides may also eventually be useful.

This remains a design direction rather than a committed schema.

---

## 12. Behaviors

Interaction behavior should be declarative and event-oriented.

The preferred direction is:

```ts
behaviors: {
  click: "selectObject",
  pointerenter: "highlightObject",
  pointerleave: "unhighlightObject"
}
```

This mapping belongs in map metadata.

The behavior implementation itself lives in the Atlas runtime or in a registered behavior/action registry.

The canonical map JSON should never contain executable callbacks.

Bad:

```ts
{
  onClick: () => {
    // ...
  }
}
```

Preferred:

```json
{
  "kind": "marker",
  "type": "extract"
}
```

with metadata:

```ts
{
  marker: {
    extract: {
      behaviors: {
        click: "selectObject"
      }
    }
  }
}
```

Benefits:

- map data remains JSON-serializable;
- backend-generated maps remain safe data;
- AI-generated maps can reference only known behavior names;
- behavior implementation can change without changing map files;
- behavior works across SVG, Canvas, and WebGL.

---

## 13. Normalized events

Renderer-specific input must be normalized before higher-level behavior runs.

Example:

```text
SVG pointer event
       |
       v
 SVG element -> MapObject
       |
       v
 normalized Atlas event
       |
       v
 behavior
```

For WebGL:

```text
pointer event
       |
       v
 raycast / hit-test
       |
       v
 MapObject
       |
       v
 normalized Atlas event
       |
       v
 behavior
```

Higher layers should not care how the object was hit.

A normalized event may eventually contain concepts such as:

```ts
{
  type: "click",
  objectId: "extract-zb1011",
  object: ...,
  position: ...,
  originalEvent: ...
}
```

The exact contract is still open.

---

## 14. Public events

The Web Component may expose domain-oriented events to host applications.

Potential examples:

```text
object-click
object-select
object-hover
viewport-change
action
```

The distinction between internal behavior events and external public events should remain explicit.

Conceptually:

```text
raw input
   |
renderer hit detection
   |
normalized map event
   |
behavior
   |
Atlas state/action
   |
public CustomEvent
   |
host application
```

---

## 15. Renderer strategy

Atlas should not commit the overall architecture to a single rendering technology.

### Initial renderer: SVG

SVG is currently the preferred starting point because:

- JSON geometry maps naturally to SVG primitives;
- DOM nodes provide a useful scene graph;
- individual objects remain addressable;
- element IDs and `data-*` attributes are easy to maintain;
- pointer interaction is native;
- browser debugging is excellent;
- vector routes/zones/markers are straightforward;
- D3 works naturally with SVG;
- an initial map workload is unlikely to justify Canvas complexity.

Example internal scene:

```html
<svg>
  <g data-layer="routes">
    <path
      id="route-main"
      data-kind="route"
      data-type="recommended"
    />
  </g>

  <g data-layer="markers">
    <g
      id="extract-zb1011"
      data-kind="marker"
      data-type="extract"
    />
  </g>
</svg>
```

Element IDs are useful for identity and debugging, but semantic styling should primarily come from Atlas materials rather than CSS selectors.

---

## 16. Background versus semantic layers

Atlas does not require the entire map artwork to be SVG.

A useful initial composition may be:

```text
static expensive artwork
        -> raster image / tiles

interactive semantic objects
        -> SVG
```

For example:

```html
<div class="viewport">
  <img class="map-background" />
  <svg class="interactive-overlay">
    <!-- routes -->
    <!-- zones -->
    <!-- markers -->
    <!-- labels -->
  </svg>
</div>
```

This avoids creating a massive SVG DOM for detailed static artwork while preserving the benefits of SVG for interactive semantic content.

---

## 17. Canvas

Canvas should **not** be the default renderer merely because it can be faster.

Canvas trades a DOM/scene graph for explicit rendering logic.

With Canvas, Atlas would need to own more infrastructure:

- hit testing;
- hover detection;
- selection;
- z-order;
- redraw scheduling;
- dirty state;
- pointer-to-world coordinate mapping;
- accessibility equivalents.

Canvas becomes attractive for specific workloads such as:

- very large point clouds;
- heatmaps;
- thousands or tens of thousands of dynamic objects;
- frequent redraws;
- animation-heavy layers.

Therefore Canvas should initially be treated as an optional backend or specialized layer renderer, not the foundation of Atlas.

A hybrid renderer remains possible:

```text
background -> raster
routes/zones -> SVG
large heatmap -> Canvas
3D layer -> WebGL
UI -> DOM
```

---

## 18. WebGL and 3D

Atlas should preserve a path toward pseudo-3D and real 3D.

The canonical object model therefore should not assume that all geometry is permanently 2D.

A future point model may include elevation:

```ts
{
  x: 10,
  y: 20,
  z: 4
}
```

An SVG renderer could project that into 2D or 2.5D.

A WebGL renderer could later use the same world data directly.

Conceptually:

```text
Map JSON / world data
        |
        +-- SVG projection
        |
        +-- Canvas projection
        |
        +-- WebGL / Three.js
```

The material and behavior systems should survive this transition.

---

## 19. D3

D3 is a candidate low-level utility layer, **not** the Atlas public API and not necessarily the renderer itself.

Atlas should prefer importing focused D3 packages rather than the entire umbrella package.

Possible uses include:

- `d3-selection` for DOM/SVG selection/update;
- `d3-zoom` for pan/zoom transforms;
- `d3-shape` for path generation where useful;
- interpolation or geometry utilities as needed.

Conceptually:

```text
Atlas renderer
    |
    +-- D3 utilities
    |
    +-- browser SVG/DOM APIs
```

The public map format should never become D3-shaped.

D3 is an implementation tool.

---

## 20. Why not Leaflet

Leaflet is intentionally not the foundation of Atlas.

The main concerns are architectural rather than feature-related:

- Leaflet owns an imperative object graph and parts of the DOM lifecycle.
- React integration requires an adapter layer.
- Leaflet styling commonly relies on global CSS and Leaflet-specific classes.
- marker, popup, vector, and control rendering use different mechanisms.
- non-geographic applications often use `L.CRS.Simple`, reducing the value of Leaflet's GIS abstraction.
- Atlas requires a stable domain API that can eventually target SVG, Canvas, or WebGL directly.

Atlas may reproduce useful concepts such as:

- pan/zoom;
- layer grouping;
- viewport management;
- marker interaction;

but these should exist as Atlas-native abstractions rather than Leaflet API wrappers.

---

## 21. Object identity

Stable object identity should exist throughout the stack.

Conceptually:

```text
Domain object
    id = "engine-room"
          |
          v
Rendered object
    data-id = "engine-room"
          |
          v
Normalized event
    objectId = "engine-room"
```

In SVG an object may additionally expose a DOM `id`.

Example:

```svg
<g
  id="engine-room"
  data-id="engine-room"
  data-kind="marker"
  data-type="location"
>
</g>
```

This improves:

- debugging;
- event resolution;
- tooling;
- editor integration;
- possible references between SVG elements.

DOM IDs should not become the sole semantic API.

---

## 22. Separation of concerns

The intended separation is:

### Map JSON

Contains:

- geometry;
- semantic identity;
- object data.

Does not contain:

- executable code;
- CSS rules;
- SVG elements;
- Canvas commands;
- WebGL materials;
- React components.

### Map Meta

Contains mappings such as:

```text
kind + type
    -> material
    -> behaviors
```

### Material

Contains renderer-independent visual intent.

### Behavior

Contains declarative:

```text
event -> named action/handler
```

### Renderer

Interprets scene + material for a particular rendering technology.

### Web Component

Owns:

- lifecycle;
- renderer;
- public API;
- event bridge;
- Shadow DOM;
- viewport/runtime integration.

---

## 23. Example end-to-end flow

Map:

```json
{
  "objects": [
    {
      "id": "extract-01",
      "kind": "marker",
      "type": "extract",
      "position": {
        "x": 100,
        "y": 250
      }
    }
  ]
}
```

Meta:

```ts
{
  marker: {
    extract: {
      material: "marker.extract",
      behaviors: {
        click: "selectObject",
        pointerenter: "highlightObject",
        pointerleave: "unhighlightObject"
      }
    }
  }
}
```

Material:

```ts
{
  "marker.extract": {
    model: "icon",
    icon: "extract",
    color: "color.extract",
    size: 24
  }
}
```

Runtime:

```text
marker.extract
     |
     v
SVG renderer
     |
     v
<g data-id="extract-01">...</g>
```

User interaction:

```text
pointerenter
     |
     v
renderer identifies extract-01
     |
     v
normalized map event
     |
     v
highlightObject
```

No part of the map JSON needs to know whether the final implementation uses SVG, Canvas, or WebGL.

---

## 24. Initial implementation direction

A reasonable first prototype is:

1. Create `<atlas-map>` as a Web Component.
2. Attach Shadow DOM.
3. Accept a small serializable map scene.
4. Support a minimal set of object kinds:
   - marker;
   - route;
   - zone.
5. Add a small map-meta registry.
6. Add a minimal material registry.
7. Implement:
   - click;
   - pointer enter;
   - pointer leave.
8. Implement named behaviors:
   - `selectObject`;
   - `highlightObject`;
   - `unhighlightObject`.
9. Render semantic objects in SVG.
10. Use D3 only where it clearly reduces implementation complexity.
11. Keep renderer internals private.
12. Validate the public model before defining more formal interfaces.

---

## 25. Open design questions

The following should remain intentionally unresolved until prototyping:

- final `MapObject` schema;
- coordinate system;
- 2D versus optional 3D point representation;
- map/layer hierarchy;
- exact material properties;
- material inheritance;
- material parameter overrides;
- whether `kind` is fixed or extensible;
- behavior registry API;
- behavior context;
- action versus behavior distinction;
- public CustomEvent names and payloads;
- camera and viewport contract;
- renderer lifecycle interface;
- renderer capabilities negotiation;
- layering and z-order model;
- hit testing abstraction;
- background image versus tile abstraction;
- asset loading;
- animation model;
- accessibility strategy;
- package/module layout;
- final npm package name.

---

## 26. Core architectural rules

These rules summarize the current direction.

### Rule 1 — Data is not rendering

Map JSON describes the map and its semantic objects, not SVG/Canvas/WebGL instructions.

### Rule 2 — Semantic types drive presentation

Objects use a structural `kind` and an application-defined semantic `type`.

### Rule 3 — Presentation is separate

`kind + type` resolves through map metadata into materials and behaviors.

### Rule 4 — No CSS contract

CSS may be used inside a renderer, but it is not part of the canonical Atlas API.

### Rule 5 — Materials are renderer-independent

Atlas uses a small material model that expresses visual intent.

### Rule 6 — Behaviors are declarative

Map metadata may contain mappings such as:

```ts
behaviors: {
  click: "selectObject",
  pointerenter: "highlightObject",
  pointerleave: "unhighlightObject"
}
```

### Rule 7 — JSON contains no executable callbacks

Named behaviors are resolved by the runtime.

### Rule 8 — Renderer-specific events are normalized

SVG events, Canvas hit-tests, and WebGL raycasts should produce the same higher-level map event model.

### Rule 9 — SVG first, not SVG forever

SVG is the preferred initial renderer, while the architecture remains open to Canvas and WebGL.

### Rule 10 — Frameworks do not own renderer internals

React or another host framework talks to the Atlas Web Component rather than directly controlling its internal scene graph.

---

## 27. Repository

Origin:

https://github.com/thetimmytook/atlas
