# First Atlas prototype

[Main navigation](../DESIGN_MAIN.md)

## Goal — agreed

Validate the idea, identify limitations, and clarify or determine the next steps.
Do not try to finish all design work in advance: the prototype should allow mistakes
and architectural corrections based on a working example.
A final public API and polished UI are not the goals of this stage.

## Scope — agreed

- One map with several buildings and layers, with local floor switching.
- Backgrounds, markers, lines, routes, and zones.
- Clipping validation, including vertical polygon extrusion.
- SVG renderer, camera, events, and an external description panel.
- Runtime objects, incremental updates, and batch.
- Minimal materials with explicit inheritance.
- Property registration using a label as the example.
- Desktop/mobile validation and loads of 3000/5000 objects.
- A complex behavior system, full editor, and 3D renderer are outside this stage.

## Expected outcome — agreed

Validated subsystem boundaries; identified limitations; necessary contract changes;
and a justified direction for the next steps.
Accepting this scope does not itself settle previously open signatures,
the layer-group contract, or the complete volumetric-zone schema.

## Proposed implementation sequence

1. Vertical slice: data → runtime → SVG inside the component, one background,
   a marker, a camera, and an event delivered to the external application.
2. Geometry and layers: two buildings, independent floor selection, a route between
   them, a volumetric zone, and slices; define minimal contracts through this example.
3. Updates and appearance: runtime setters, batch, materials, and the label extension.
4. Load, mobile-input, and accessibility checks; record measurements and conclusions.

## Proposed verifiable success criteria

- Switching one building's floor does not change another building's selected view.
- Clipping does not change source geometry; events identify the original object and layer.
- Runtime object changes appear on the map; batch combines rendering updates.
- Materials and the label extension require no changes to SVG renderer business logic.
- The external application handles events and displays descriptions without accessing
  the renderer's internal DOM.
- Load scenes measure pan/zoom, hit testing, layer switching, object updates, and loading;
  the device, browser, and scene composition are recorded.
  Numerical performance thresholds are not yet approved.
- Problems and decision changes are documented rather than concealed by a more complex API.

These are proposed working steps and criteria, not additional approved requirements.
Source-map research: [TARKOV_MAP_AUDIT.md](../TARKOV_MAP_AUDIT.md).
