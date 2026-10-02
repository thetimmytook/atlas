# Atlas — main design navigation

## How to read

Start here, then open only topics relevant to the current task.
The user leads design; the assistant validates and advises. Implementation has started
with the component shell, map definition, and camera, under step-by-step review. Discuss broad blocks and preserve specific ideas as decisions or open
decision points. Do not turn API examples into approved signatures.
When an answer covers several topics, use continuous numbering so the user can
refer to a number without copying text. Numbering starts at 1 after this clarification;
continue between answers rather than relying on HTML anchors.

## Current foundation

- Desktop/mobile, map viewing; the editor is a separate library consumer.
- Serializable JSON and runtime instances with behavior are separate.
- Atlas objects contain geometry; marker/zone semantics belong to the application.
- Coordinates: x right, y down, z up. SVG first; real 3D is a future direction.
- Shared objects; layers select objects and clip them using clip. No separate level concept.
- stackIndex defines composition; it is neither height z nor a substitute for depth in 3D.
- Routes contain lines, with no intermediate segments or shared route.points.
  Route behavior maintains continuity.
- Materials are named, with explicit inheritance. Specificity selects one material
  rather than automatically mixing materials across levels. Meta/styles are outdated terms.
- Properties/behaviors are registered in isolated configuration before creating a map.
- label is an explicit data object; the runtime label belongs to its owner and has behavior.
- Synchronous nested batch defers only rendering, without rolling back changes.
- Data/resource loading is strict; a new map replaces the current map only after preparation succeeds.
- Runtime objects form the internal scene representation. A separate geometry subsystem
  prepares geometry and performs spatial queries; the renderer updates backend output.
- Framework adapters are separate. The application stores user state.
- Resources are described once in the map registry and referenced by ID;
  a pluggable application loader is provided for.

## Topic documents

| Topic                                                   | Document                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| Use cases and responsibility boundaries                 | [Scope](design/SCOPE.md)                                             |
| Coordinates, objects, IDs, and routes                   | [Geometry and routes](design/GEOMETRY_AND_ROUTES.md)                 |
| Layers, clipping, hit testing, screen sizes             | [Layers and interaction](design/LAYERS_AND_INTERACTION.md)           |
| Camera, constraints, homeView                           | [Camera](design/CAMERA.md)                                           |
| Runtime, loading, updates, batch, route operations      | [Runtime and loading](design/RUNTIME_AND_LOADING.md)                 |
| Materials and open alter/replace/reset questions        | [Materials](design/MATERIALS.md)                                     |
| Registration, labels, deprecation, validator            | [Properties and labels](design/PROPERTIES_AND_LABELS.md)             |
| Renderer and component lifecycle                        | [Renderer and component](design/RENDERER_AND_COMPONENT.md)           |
| Console logging                                         | [Diagnostics](design/DIAGNOSTICS.md)                                 |
| Resources and serialization                             | [Resources and serialization](design/RESOURCES_AND_SERIALIZATION.md) |
| Agreed first-prototype scope                            | [Prototype](design/PROTOTYPE.md)                                     |
| Browsers, accessibility, keyboard, and load reference   | [Platforms and performance](design/PLATFORMS_AND_PERFORMANCE.md)     |
| Distant future of the appearance system                 | [Exploration](MATERIAL_SYSTEM_EXPLORATION.md)                        |
| Research into all tarkov.dev maps, not new requirements | [Map audit](TARKOV_MAP_AUDIT.md)                                     |

Topic files still retain clarification history: the current summary above and
explicit later corrections take precedence over earlier wording.
Full contract consolidation is a separate future step, not performed automatically.

## Where we stopped

A basic internal web-library setup has been prepared: [tooling](TOOLING.md).
The Web Component shell and Factory background with `MapDefinition` are merged.
Camera center/zoom, fit, and example buttons are merged. Mouse/touch controls and
map/client coordinate conversion are merged; see
[camera status](design/CAMERA.md).
Point geometry display, mutable runtime objects, object click/tap events, and the
external example panel are merged; see
[object interaction](design/LAYERS_AND_INTERACTION.md#first-surface-events-and-object-clicktap--merged).
Hit testing has moved out of the renderer into the internal spatial subsystem;
both consume shared scene geometry. This refactor is merged; see
[spatial implementation](design/RENDERER_AND_COMPONENT.md#spatial-implementation--merged).
Straight line geometry, SVG display, spatial picking, and runtime endpoint updates
are the current reviewable step; see
[line geometry](design/GEOMETRY_AND_ROUTES.md#line-geometry--pending-review).
Route composition and continuity are the proposed next step, subject to review
against the generic object model.

The first architecture pass is sufficient to proceed to prototype validation.
The user agreed to the prototype scope and goal: validate the idea, identify
limitations, and clarify next steps. Not every question needs closing before implementation.
The assistant's latest numbered points were 3 (scope) and 4 (outcome), both confirmed;
continue numbering from 5.
The runtime/renderer boundary and Web Component lifecycle foundation are agreed.
Resize changes viewport dimensions while preserving center and zoom without refitting.
The resource registry, pluggable loader, and map-document contents are accepted;
executable configuration stays outside JSON. Modern browsers, mouse/touch, and basic
accessibility are confirmed; keyboard handlers remain an open question.
The prototype load reference is 3000/5000 objects. All tarkov.dev map configurations,
data, and an overview of primary screens were studied; findings are stored separately.
Both building-view scenarios are useful, but UI, Escape, and Back belong to the application.
Multiple-map/viewport mechanisms and layer groups remain decision points.
The default layer is tied to stackIndex; responsiveness and zone extrusion are noted
for subsequent design work.

## Major remaining blocks

1. Complete lifecycle, public API, and the agreed event contract.
2. Consolidate minimal material/property/label contracts while preserving decision points.
3. Refine resources and Map JSON export contents (schemaVersion is accepted).
4. Browser, accessibility, input, and expected data-volume requirements.
5. Prototype scope is agreed; refine measurable criteria and limitations through validation.
6. Produce a clean specification and move historical variants out of working contracts.

## Sources and history — do not read in full unnecessarily

- [Original architecture draft](ATLAS_DESIGN_ORIGINAL.md).
- [Complete pre-split log](archive/DESIGN_DECISIONS_PRE_SPLIT.md) — an archive,
  not a current source of decisions; its decisions are not updated after the split.
- [Original pre-design PDF](references/pre-design.pdf).

## Maintaining the documents

Record new decisions in the relevant topic; update only the main summary, navigation,
and current stage here. Distinguish accepted decisions from proposals.
Historical wording must not override new decisions. Do not begin implementation
solely on the basis of architectural discussion.
