# Materials

Status on 2026-10-09: material design is accepted but unimplemented; assignment
schemas and operations remain open. [Current temporary appearance](CURRENT_CONTRACT.md#temporary-implemented-contracts)
is built into the prototype and is not a material API.

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Object-model clarification

The current map-object model keeps marker semantics in the application. Concrete
objects are `MapPoint`, `MapLine`, `MapRoute`, and `MapPolygon`. The older kind/type assignment
examples below need adaptation to this model; their replacement API is not yet
settled. Named materials and explicit inheritance remain accepted. The proposed
`MapSettings.point` API was removed after review. Temporary point size, stroke,
and CSS colors will be replaced by resolved material properties; they are not a
public appearance contract.

All objects, including routes and their owned points, share the `MapObjectDefinition`
and `MapObject` foundations. Material assignment belongs to this common contract
when implemented; this refactor does not choose its field schema or add a separate
route-only appearance API. Object `kind` is `point`, `line`, `route`, or `polygon` in the current
prototype. Points expose `position`; lines and routes expose owned `points`.
Polygons expose x/y `contour` and independent `baseZ`/`height`.
Geometric forms (`point`, `line`, `polyline`, `polygon`) are internal spatial views used by
rendering and queries, not a public `geometry` property on map objects. Earlier
`ObjectDefinition`, `kind: 'geometry'`, and route-owned-line wording is historical.
Material selection must account for the current object model when its earlier
kind/type rules are revised.

The accepted [route-vertex separation](GEOMETRY_AND_ROUTES.md#route-vertex-geometry-symbol-and-picking--accepted-2026-10-08)
requires point appearance to support a vertex without a symbol while preserving
its contribution to the route geometry. Separate point picking is another concern;
a symbol does not by itself settle interaction participation. The material/property
fields remain open. The accepted, unimplemented route-vertex default is no symbol and no separate
point picking; the author explicitly assigns appearance and enables interaction
for a point of interest. The merged renderer still draws/picks temporary symbols for all eligible original
route vertices. Defaults for independent point appearances are unchanged.

The accepted [classification decision](GEOMETRY_AND_ROUTES.md#application-classification--accepted-2026-10-05)
moves application `type` to `data.type`; objects have no separate semantic `type`
field. References to semantic type in the earlier rules below mean this application
classification. They do not introduce an implicit data selector: how material
assignment uses application data remains open. Named materials, explicit inheritance,
and selection of one assigned material remain accepted.

## Appearance — clarification replacing Meta

This is future design. Built-in _materials_ in these proposals are not implemented
by the current hardcoded symbols/fills. Older styles and alter/replace/reset
statements below are superseded by the explicit relationship/open-operation
clarifications; they do not settle an API.

### Current decision: explicit material relationships

- Accepted foundation: named materials, explicit inheritance, and material assignment
  to objects. A name such as line.base is an arbitrary identifier; the dot does not
  define a hierarchy. The relationship is explicit through a parent (provisional inherits field).
- Unspecified properties inherit from the explicitly specified parent; a material's
  own values override inherited ones. Built-in materials allow maps to work without
  manually defining their appearance.
- Motivation: explicit dependencies and encapsulation instead of an implicit CSS-like cascade.
- Previously agreed specificity kind → kind + semantic classification → object
  selects one assigned material. Classification now lives in data.type; the exact
  mapping remains open. The principle is to select one material
  rather than blending properties from materials at these levels. Properties resolve
  only through the selected material's explicit inheritance chain.
- Each kind has a built-in material; the application may assign materials by kind/type
  and explicitly to a particular object. More specific assignments take precedence.
  Example: marker {color: gray, size: 24}; extract inherits marker and sets green;
  special inherits extract and sets size: 32. An object using special is green with size 32.
  The exact assignment-table schema is not defined yet.
- A route defines the default material for its lines. An individual line may use
  another material; it replaces the route's selection without implicit property mixing.
  Property inheritance still occurs only through inherits. The specific reassignment
  mechanism/API will be discussed later; the user explicitly left it open.

### Decision points: material operations and behavior

- alter/replace/reset are open decision points again: the provisionally accepted
  semantics below are retained as history, not a final API commitment.
- alter: is a separate property-merging method needed if explicit inheritance
  already describes partial overrides? Changing runtime properties and describing
  inheritance are different operations; the final API has not been chosen.
- replace: what is replaced — the assigned material, instance parameters,
  or a behavior's temporary appearance? Its scope is not defined yet.
- reset: which state should it restore, and which changes should it remove? A generic
  reset must not implicitly undo independent changes by the application or other behaviors.
- Hover and other effects are considered together with future behavior registration:
  an effect may be defined by a registered behavior or a property change. Applying/removing
  effects and composing simultaneous changes need definition.
- The user supplied these remarks as architectural context, not as a request
  to define signatures or implement the system immediately.

Latest clarification: the user restores material/materials instead of styles.
No separate style concept is introduced on top of the previously chosen materials.
Exact API names and the separation of material registry and assignment rules are still discussed.
Three application levels were accepted: kind → kind + semantic classification → specific object;
classification now lives in data.type and its assignment mechanism remains open.
The more specific level overrides specified properties. Built-in appearance,
partial overrides, and updates independent of data remain.
The user confirmed specificity as an Atlas approach that can be adapted later.
Source/Unreal were discussed only as examples; their architecture, shader graphs,
or material-instance hierarchy need not be reproduced.
References to styles below describe the earlier name and yield to this clarification.

- The public term styles for appearance rules was agreed. The name theme is not
  used as the primary contract. The former Meta container needs revision;
  earlier references reflect prior discussions, not the final API.
- Atlas provides built-in appearance: a map works without custom styles. Base styles
  cover supported kinds, labels, route points, and highlighting. An unknown semantic
  type receives the base appearance of its kind.
- Custom styles override only the necessary parts of built-in appearance;
  the application need not supply a complete rule set.
- Styles can be supplied when creating a map and changed at runtime independently
  of object data, without recreating objects. Illustrative example: map.styles = customStyles.
- Styles are Atlas's own renderer-independent contract, not CSS. Materials may remain
  an internal/component concept, but the exact structure, rule priorities, and styles
  update mechanism are not yet defined.
- Appearance is separate from event handling and behavior; earlier behaviors in Meta
  do not automatically carry over into styles.
- Currently agreed object runtime-material semantics:
  alter(properties) merges local overrides, changing only supplied properties
  (not arithmetic addition); replace(properties) completely replaces local overrides;
  reset() removes them and restores appearance resolved through kind/type and built-in values.
- Properties unspecified after replace inherit from the base material rather than
  becoming undefined. Changing object.material affects only that object, not a shared
  material used by other objects.
- The application may call these operations on hover/click or other events; special
  built-in hovered/selected states are unnecessary. Nested-property details and
  management of simultaneous effects are undefined. The user accepted these semantics
  provisionally ("for now, yes").
- User-confirmed extension direction: registering named behaviors/classifiers to link
  events, states, and materials flexibly. Hover is a possible example, not a mandatory
  fixed state set. The example XXX.register("hover", onClick()) illustrates the idea,
  not a specific signature or a conflation of event and state semantics.
- The current alter/replace/reset satisfy the agreed requirements. The extensible
  system will be revisited separately: state priorities, effect removal, registration
  lifecycle, and material relationships are undefined. Storing functions in runtime
  and names in JSON fits the general serializable model, but the exact registration
  contract is not yet approved.
- Automatically propagating shared-material changes while retaining local overrides
  was proposed but has not been separately confirmed.
