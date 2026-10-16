# Materials

Status on 2026-10-16: the revised first slice is implemented and accepted for PR,
pending merge. This includes data and
selection-property registration, named materials/rules, explicit assignment,
whole-value runtime edits, SVG/PNG icons and independent contextual point picking.
The named runtime lookup remains provisional. Broader interaction/material APIs
remain open; dated design notes below retain their original stage wording.

[Navigation and current summary](../DESIGN_MAIN.md)

[First-slice public contract](MATERIALS_FIRST_SLICE_CONTRACT.md) describes the
accepted signatures and semantics; [implementation and checks](PROTOTYPE.md#first-material-slice--implemented-for-review-2026-10-12)
record the concrete review state. Internal defaults replace the temporary SVG
appearance without exposing mutable built-in materials.

### First-slice review corrections — accepted, 2026-10-12

- Standard appearance and parameter defaults remain internal. This slice exposes
  no reserved names, inheritance references or mutable handles for built-in
  materials. The earlier public `builtin.*` proposal is withdrawn. Only
  user-declared named materials are available through the provisionally accepted
  lookup; a user material plus a kind-only rule defines a common appearance.
  Missing parameters resolve through explicit parents, then parameter defaults.
- `object.material` is only the explicit assigned name or `undefined`. Automatic
  selection still produces a material and supported resolved parameters for
  every concrete appearance through rules and internal fallback, even with no
  symbol. Shared instances may select differently across maps and roles; no
  public computed-material getter is added. `material.properties` remains the
  named material's own explicit parameter set, not its resolved appearance.
- Point picking belongs to the point definition/runtime, independently of a
  material. Independent appearances default on, route-owned appearances default
  off; an explicit boolean overrides this and removing it restores context
  defaults. The proposed `pickable` spelling/getter/setter and route example await
  mini review in the [contract](MATERIALS_FIRST_SLICE_CONTRACT.md#point-picking--proposed-minimal-flag).
- Selector and appearance names are separate: for example, registered `when.color`
  and material `properties.color` have different meanings. Strict readers and
  the frozen candidate-data projection are documented in
  [Properties and labels](PROPERTIES_AND_LABELS.md#first-slice-review-selector-names-and-strict-readers--accepted-2026-10-12).

The user accepted the rest of the original contract proposal, including sizes,
anchor, whole-image inheritance and type-only runtime material interfaces. None
of these decisions authorizes implementation.

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
when implemented; the later
[explicit assignment decision](#explicit-object-material-assignment--accepted-2026-10-12)
selects the `material` name reference for definitions and runtime objects.
No separate route-only appearance API is introduced. Object `kind` is `point`,
`line`, `route`, or `polygon` in the current prototype. Points expose `position`;
lines and routes expose owned `points`.
Polygons expose x/y `contour` and independent `baseZ`/`height`.
Geometric forms (`point`, `line`, `polyline`, `polygon`) are internal spatial views used by
rendering and queries, not a public `geometry` property on map objects. Earlier
`ObjectDefinition`, `kind: 'geometry'`, and route-owned-line wording is historical.
The material selection rules below apply to the current object kinds.

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
classification. The subsequent clarification removes the assumption that materials
know the `data.type` path: the application explicitly connects its data to a
registered property used in material selection. See
[application-defined selection properties](#application-defined-selection-properties--clarification-2026-10-09).
Named materials, explicit inheritance, and selection of one assigned material
remain accepted.

## Appearance — clarification replacing Meta

This is future design. Built-in _materials_ in these proposals are not implemented
by the current hardcoded symbols/fills. Older styles and alter/replace/reset
statements below are superseded by the explicit relationship/open-operation
clarifications; they do not settle an API.

### Current decision: explicit material relationships

- Accepted foundation: named materials, explicit inheritance, and material assignment
  to objects. A name such as line.base is an arbitrary identifier; the dot does not
  define a hierarchy. The relationship is explicit through the `inherits` field.
- Unspecified properties inherit from the explicitly specified parent; a material's
  own values override inherited ones. When the selected material and its parent
  chain omit an appearance parameter, the property's default applies; see the
  [accepted default rules](#appearance-property-defaults--accepted-2026-10-12).
  Internal standard appearance/defaults allow maps to work without manually
  defining their appearance; no public built-in material API is needed.
- Motivation: explicit dependencies and encapsulation instead of an implicit CSS-like cascade.
- Accepted specificity kind → kind + application-defined property → object selects
  one assigned material. The application connects its data to the registered
  property; the basic rule fields are accepted below. The principle is to select one material
  rather than blending properties from materials at these levels. Properties resolve
  through the selected material's explicit inheritance chain, falling back to
  appearance-property defaults for omitted parameters.
- Each kind has an internal fallback; the application may assign user materials by kind,
  registered application properties and explicitly to a particular object. More
  specific assignments take precedence.
  Example: marker {color: gray, size: 24}; extract inherits marker and sets green;
  special inherits extract and sets size: 32. An object using special is green with size 32.
  The serializable rule structure is accepted below; complete type declarations remain open.
- A route defines the default material for its lines. An individual line may use
  another material; it replaces the route's selection without implicit property mixing.
  Property inheritance still occurs only through inherits. The specific reassignment
  mechanism/API will be discussed later; the user explicitly left it open.

### First material slice — accepted, 2026-10-09

The first implementation supports the following appearance parameters:

| Object kind    | Appearance parameters                                          |
| -------------- | -------------------------------------------------------------- |
| Point          | Circle, custom icon or no symbol; circle color and symbol size |
| Line and route | Line color and width                                           |
| Polygon        | Fill color and opacity                                         |

Custom icons are required in this first slice, not deferred. SVG and PNG are
accepted formats; the first resource fields (`resources`, `kind: 'image'`, `source`)
are accepted in the
[image resource schema](RESOURCES_AND_SERIALIZATION.md#image-resource-fields--accepted-2026-10-12).
Complete TypeScript declarations remain open. The table does not settle public
property names.

Custom icons retain the colors supplied by the icon resource itself. Atlas does
not tint or recolor them; a material's circle color does not affect an icon. This
color behavior was explicitly confirmed on 2026-10-09.

Internal defaults provide initial values. Symbol sizes and line widths retain
their screen size during zoom by default, following the accepted screen-size
direction. The API for optional scaling with the map remains open.

A route vertex without a symbol still contributes to the path. Symbol appearance
and separate point picking remain independent, as defined by the accepted
[route-vertex separation](GEOMETRY_AND_ROUTES.md#route-vertex-geometry-symbol-and-picking--accepted-2026-10-08).

Polygon outlines remain separate geometry work: external contours of the clipped
result must be obtained before outlines are supported. Material properties alone
do not replace that work.

This is accepted future scope, not an implemented API.

### Icon appearance — accepted, 2026-10-09

- An icon references an SVG or PNG resource by its map resource ID.
- Width and height use screen units. The author may specify only one dimension or
  both; supplying both is not mandatory.
- The explicit `preserveAspectRatio` property defaults to `true`.
- With aspect-ratio preservation enabled, one supplied dimension determines the
  other from the resource's source aspect ratio. Two supplied dimensions are
  bounds within which the image fits while preserving that ratio.
- With aspect-ratio preservation disabled, supplied dimensions are applied
  independently; an omitted dimension retains its source value. Supplying both
  dimensions may stretch the image.
- If neither dimension is supplied, the resource's source dimensions are used.
- An anchor determines which point of the symbol rectangle coincides with the map
  object's coordinate. The default anchor is the center; the author can choose
  another point, such as the lower center for a pin. The anchor schema remains open.
- The anchor and picking use the resulting icon rectangle after size resolution,
  rather than the enclosing size constraints. When point interaction is enabled,
  picking includes transparent areas within that resulting rectangle. Picking
  does not inspect image pixels or SVG contents.
- Original icon colors are preserved, as confirmed above.

All declared icons are prepared by `map.load()` before replacement, and runtime
changes may synchronously switch between those loaded resources. See the accepted
[first-slice icon loading rules](RESOURCES_AND_SERIALIZATION.md#first-slice-icon-loading--accepted-2026-10-09).

For a resource with source dimensions of 40 by 20 screen units:

| Supplied dimensions | `preserveAspectRatio: true` | `preserveAspectRatio: false` |
| ------------------- | --------------------------- | ---------------------------- |
| Width 80 only       | 80 by 40                    | 80 by 20                     |
| Height 40 only      | 80 by 40                    | 40 by 40                     |
| Width 80, height 80 | 80 by 40                    | 80 by 80                     |

How source dimensions are established by the resource schema, including SVGs
without explicit dimensions, remains open.

These are accepted future rules, not implemented public signatures.

### Map ownership and isolation — accepted, 2026-10-09

Material descriptions and assignment rules belong to `MapDefinition`. They are
serializable map data; see the accepted
[serializable fields](#serializable-material-fields--accepted-2026-10-09).

Each load creates an independent runtime material set. Loading the same definition
into maps A and B does not share mutable material instances: editing `exit` in A
updates its users in A while B retains its own values. Shared-material propagation
below applies within the loaded map.

The shared extension configuration defines supported properties, their handling
and connections to application data; current material values belong to each map.
Sharing a configuration does not share mutable material values. The latest
[static configuration clarification](PROPERTIES_AND_LABELS.md#static-application-configuration--clarification-2026-10-12)
selects global application setup rather than separate setup instances.

This is accepted future behavior, not an implemented API. Material access and
mutation signatures remain open.

### Application-defined selection properties — clarification, 2026-10-09

The user clarified the intended extensibility mechanism after discussion of
runtime updates. This supersedes the earlier fixed `data.type` material selector.

- `data` belongs to the application. The material system must not have built-in
  knowledge of `data.type` or any other application-data path.
- The application adds custom properties through the property-registration
  mechanism and explicitly connects their values to its own object data.
  Material assignment can use such a property as a selection criterion.
- Executable connections belong to application code outside map JSON, for example
  the example page. The latest lifecycle clarification below places these
  connections in the shared setup before maps are created, superseding the earlier
  suggestion to wire them after loading each map. Exact API signatures remain open.
- When connected data changes, the material system updates selection through its
  common property/update mechanism. It must not add a special `data.type` update
  branch. Whole-value replacement through a copying `data` setter and immutable
  getter is accepted; see
  [runtime application data](GEOMETRY_AND_ROUTES.md#runtime-application-data--accepted-2026-10-09).
  Notification details and dependency detection remain open; no automatic tracking
  of arbitrary JavaScript mutations is promised.

An illustrative connection is `category` reading `object.data.type`; an assignment
then matches `kind = point` and `category = exit` to choose `exit.green`. Both the
property name and the data path are application choices. This is a conceptual
example, not an approved registration signature or rule schema.

Combining `kind` with an application property means both conditions must match.
The point example does not restrict custom properties to points: for example,
`kind = line AND type = exit` may select `exit.green`, where `type` is an
application-registered property. The same application category may be used for
points, lines, routes and polygons. Selected material parameters must be applicable
to the target object, following the registered property contracts.

The direction above does not settle a selector language, arbitrary cross-property
dependency graphs or the full deferred binding system. This remains future design,
not an implementation request.

### Shared material-system setup — clarification, 2026-10-09

- The application configures the shared material/property system during
  initialization, before the first map load. Multiple configuration calls are
  permitted during this phase, as clarified on 2026-10-12 below.
- Map definitions are validated and interpreted using that setup; loaded maps and
  later runtime objects use the same configured contracts and value connections.
  Wiring is not repeated for each map or object.
- Registrations and connections remain fixed while maps use the setup. Adding,
  removing or changing them on a running setup is outside the agreed scope.
  The originally accepted independent-setup direction is superseded by the
  2026-10-12 static application configuration clarification linked below.
- Runtime data replacement, material value edits and object material assignments
  remain supported future behavior. Reevaluating a configured property's value
  after data changes does not reconfigure the material system.
- Material descriptions and assignment rules remain serializable map data, and
  runtime material values remain independent between loaded maps, as agreed above.

This supersedes the earlier post-load connection direction and the later unaccepted
proposal to attach connections separately to each map. On 2026-10-12, the user
accepted `new MapSetup({ properties: [...] })` with `name`, `valueType`, `optional`,
`appliesTo` and an application-supplied `read` function; see the
[accepted registration format](PROPERTIES_AND_LABELS.md#setup-property-registration--accepted-2026-10-12).
The user subsequently chose a static method for global application configuration,
superseding the constructor and per-map setup assignment while retaining these
registration fields. All maps use the shared configuration automatically; see the
[latest clarification](PROPERTIES_AND_LABELS.md#static-application-configuration--clarification-2026-10-12).
Any number of configuration calls is permitted before the first `load()` of any
map; configuration is fixed when that first load begins. Calls accumulate
registrations without replacing previous ones; duplicate names are rejected.
Complete TypeScript signatures, method naming and error codes remain open;
no live reconfiguration API is required for this slice.

### Material selection — accepted, 2026-10-09

The first material implementation includes all three assignment levels, in order
of increasing specificity:

1. A default material for an object `kind`.
2. A material for an object `kind` and a matching registered application property.
3. A material explicitly assigned to a particular object.

Application property values belong to the map author. Exact matching applies to
the connected property's value, not a hardcoded data path. If no application-property
assignment matches, the kind default applies. An explicit object assignment takes
precedence over both defaults. Internal standard appearance provides fallback for kinds
without a custom default.

When multiple rules match at the same assignment level, the last matching rule in
the definition's rule list wins. The three levels above determine specificity;
rule order resolves matches within one level. An explicit object assignment
takes precedence over matching conditional rules regardless of their order.

For example, a `kind = line AND type = exit` rule selects `exit.green`, followed
by a `kind = line AND closed = true` rule selecting `closed.gray`. When both match,
`closed.gray` is selected. Here `type` and `closed` are application-registered
properties, and the example does not settle rule syntax.

The most specific applicable assignment selects one material. Its properties
resolve through that material and its explicit inheritance chain, with property
defaults supplying omitted appearance parameters as accepted below; properties
are not mixed across assignment levels. For example, choosing `exit.important`
does not implicitly inherit values from the kind default or the `exit` assignment.
It inherits from `exit` only if that parent relationship is explicitly defined.

For another illustrative example, `line.base` provides an orange color and width
4; `closed.gray` explicitly inherits from `line.base` and supplies a gray color.
Selecting `closed.gray` gives a gray line of width 4. A matching rule for
`exit.green` does not make that material a parent of `closed.gray`; parent
relationships are defined separately from rule matching and order.

This is accepted future behavior, not an implemented API. The basic serializable
rule fields and explicit object assignment are accepted below; complete type
declarations and remaining runtime mutation signatures remain open.

### Simple rule conditions — accepted, 2026-10-12

This is a deliberately small first implementation, not the final material selector
system. A `when` property accepts one scalar value or an array of alternatives:

```json
{
  "when": {
    "kind": ["line", "route"],
    "type": ["exit", "entrance"]
  },
  "material": "exit.green"
}
```

- Matching uses exact equality without type coercion.
- Scalar values are strings, finite numbers or booleans, following the registered
  property's value type. Each array item follows that same contract.
- An array matches when the property's value equals any of its alternatives
  (implicit OR). All properties in `when` must match (implicit AND).
- The scalar form remains valid, such as `"kind": "line"`. Alternatives are
  supported for any selection property, not only `kind`.
- An absent optional property does not match a supplied condition.
- Condition values are validated against their property registrations during
  loading. A type mismatch produces `AtlasMaterialError`.
- The existing assignment levels and last-matching-rule precedence remain in
  effect; multiple alternatives do not create a new specificity level.

The current public kind for a route/polyline is `route`; `polyline` names internal
geometry and is not a separate public object kind.

Explicit logical operators such as NOT, grouped AND and other compound expressions
may be useful later and are deferred. No general expression language or extension
framework is required for this slice. Complete TypeScript declarations and
individual diagnostic codes remain open. This is accepted, unimplemented design.

### Appearance property defaults — accepted, 2026-10-12

- `inherits` is optional. A material without it has no parent material.
- An appearance parameter is resolved from the selected material's own value,
  then from its explicit parent chain, nearest parent first.
- If the parameter remains absent, its default from the property's description
  applies. Defining a partial material therefore does not require an explicit
  parent solely to supply ordinary defaults.
- For example, a line material specifying only green color uses the standard
  line-width default when neither it nor an explicit parent specifies a width.
- Default resolution does not add an implicit parent or take parameters from
  other matching assignment rules or an application-defined kind-default material.
- The own-parameter getter continues to expose explicitly supplied values only;
  resolved defaults are not copied into it.
- Supplied values remain subject to the accepted strict validation guarantees.

This is accepted future behavior. Exact built-in values and the complete property
metadata schema remain open. The scope here is omitted appearance parameters;
optional custom selection properties retain their accepted absence semantics.

### Shared material edits and object assignments — accepted, 2026-10-09

This is accepted future behavior, not an implemented API. Named runtime lookup
is provisionally accepted below; remaining mutation signatures remain open.

- Editing a shared named material updates every object assigned to it.
- The change also propagates through explicit inheritance. A descendant material's
  own value continues to override the corresponding inherited value; other
  properties continue to inherit normally.
- Every layer appearance of an affected object reflects its current material.
- Changing the material assigned to one object affects that object and all its
  appearances. It does not mutate the shared material or other objects' assignments.
- An individual appearance difference can be expressed by assigning another
  material, which may explicitly inherit from the original material. This decision
  does not settle object-local alter/replace/reset operations.

For example, twenty points assigned to `exit` all change when its color changes.
An object assigned to `exit.important`, which inherits from `exit`, also receives
the new color unless that material supplies its own color. Reassigning one point
to another material leaves the other nineteen assignments unchanged. Names and
property syntax in this example are illustrative.

### Explicit object material assignment — accepted, 2026-10-12

- The common map-object definition supports an optional `material` field holding
  a material name reference, for example `material: 'exit.green'`.
- Runtime `object.material` is readable and assignable. Its getter returns the
  explicitly assigned name or `undefined`, rather than the material selected by
  assignment rules.
- Assigning a name selects that material explicitly, taking precedence over the
  kind default and matching conditional rules.
- Assigning `undefined` removes the explicit assignment and resumes selection
  through the current rules and built-in fallback.
- Absence of an explicit assignment does not mean absence of appearance.
- Assignment changes affect the object and all its layer appearances, following
  the shared-object update contract above.

Accepted runtime access pattern:

```javascript
object.material = 'exit.green';
object.material = undefined;
```

The name reference is resolved against each loaded map's user-declared material
set, whose runtime values remain independent. Selection and resolved parameters
always exist per concrete appearance via rules/internal fallback. A shared object
may select differently across maps and roles, so no public computed-material
getter is introduced in this slice. The getter is not `material.properties`, which
exposes only a named material's own parameters.

This is accepted future design, not an implemented field or setter. Complete
TypeScript declarations and reference-validation diagnostics remain open;
failed-assignment guarantees are accepted below.

### Named runtime material lookup — provisionally accepted, 2026-10-12

The user provisionally accepted `map.materials.get(name)` as the working access
pattern. This may be revisited before the public contract is finalized.

- `get(name)` returns the loaded map's runtime material with that name, or
  `undefined` when no material has that name.
- Lookup covers user-declared materials only; internal standard fallback/defaults
  have no public reference names or editable lookup handles in this slice.
- Runtime materials remain independent between maps, including when maps load
  the same definition.
- Editing the returned material's own parameters follows the accepted shared-edit
  and inheritance rules within that map.

Provisionally accepted access pattern, using the earlier own-parameter replacement:

```javascript
const material = map.materials.get('exit.green');

if (material) {
  material.properties = {
    ...material.properties,
    color: '#008800',
  };
}
```

This is unimplemented future design. It does not select a runtime collection class,
additional collection operations, or an API for obtaining the computed material
of an object. Complete TypeScript declarations remain open.

### Material description and compatibility — accepted, 2026-10-09

- A material description consists of its name, an optional explicit parent and
  its own parameters. The serializable fields are accepted below.
- `kind` is a criterion for selecting a material; a material does not need a
  separate kind tag. Compatibility is determined by its registered parameters.
- One material may be reused for different object kinds when those kinds support
  all of its effective parameters. For example, a color-only material may serve
  points and lines if that color property is registered for both contracts.
- Applying a known parameter to an incompatible object is an error, not a silently
  ignored value. For example, a point-icon parameter cannot be applied to a line.
- The same applicability checks include parameters obtained through explicit
  inheritance. An incompatible inherited parameter must not be silently dropped.

Failures use domain diagnostics under the accepted Atlas error conventions and
the validation guarantees below. Specific codes and public schemas are not yet
selected. This is accepted future behavior, not an implemented material validator.

### Material validation and failed updates — accepted, 2026-10-12

- Unknown material or parent references, inheritance cycles and incompatible
  material parameters use `AtlasMaterialError`, which extends `AtlasError`.
- A failed map load preserves the previous usable map, including appearance and
  interaction, under the existing load-replacement contract.
- Runtime assignments to `object.data`, `object.material` and
  `material.properties` are validated before applying the attempted assignment.
  On failure, its previous value and the working appearance remain intact.
- For an object used in multiple maps, validation checks every map using that
  object before applying the assignment. A valid assignment in one map must not
  leave another map with an invalid material reference or appearance.
- Material parameter compatibility includes inherited values and affected
  descendants/users, following the accepted shared-edit rules.

These are accepted future guarantees, not implemented material validation. Exact
diagnostic codes and complete constructor/type signatures remain open. The accepted
[material error subclass](DIAGNOSTICS.md#material-error-category--accepted-2026-10-12)
retains these guarantees within the `AtlasError` hierarchy.

### Serializable material fields — accepted, 2026-10-09

- `MapDefinition.materials` is a dictionary keyed by material name/identifier.
- Each material description has its own `properties` and an optional `inherits`
  reference to its explicit parent.
- `MapDefinition.materialRules` is an ordered rule list. Each rule has a `when`
  condition object and a `material` reference to a named material.
- Keys in `when` identify built-in or application-registered selection properties;
  `kind` is a built-in example. Application properties and their data connections
  are defined by the shared setup, outside map JSON.

Accepted fragment of a map definition:

```json
{
  "materials": {
    "line.base": {
      "properties": {
        "color": "#777777",
        "width": 4
      }
    },
    "exit.green": {
      "inherits": "line.base",
      "properties": {
        "color": "#228844"
      }
    }
  },
  "materialRules": [
    {
      "when": { "kind": "line" },
      "material": "line.base"
    },
    {
      "when": { "kind": "line", "type": "exit" },
      "material": "exit.green"
    }
  ]
}
```

Here `type` is an application-registered property; its connection might read
`data.type`. The field structure is accepted, while the appearance parameter names
in this example remain illustrative. The later scalar-or-array condition format
and value types are accepted above. First-slice declarations and omitted-field
defaults are recorded in the reviewed contract. Public built-in references are
outside this slice under the later correction above. The later explicit
per-object `material` name reference is accepted above. No runtime fields are
implemented by these decisions.

### Own material parameters — accepted, 2026-10-09

- A material exposes an immutable set of its own explicitly supplied parameters.
  Inherited values and resolved property defaults are not included in that
  own-parameter getter.
- A setter replaces the entire own-parameter set, validating and copying the input
  before replacement.
- Omitting a previously supplied own parameter removes its override. Where the
  explicit parent supplies that parameter, the value is inherited again; otherwise
  the property's default applies under the accepted default rules above.
- Changes propagate to objects using the material and through its descendants,
  preserving descendant overrides and updating all affected appearances.

Illustrative access pattern; public names and type declarations remain open:

```javascript
material.properties = {
  ...material.properties,
  color: '#888888',
};
```

For `closed.gray` with only its own color and a width inherited from `line.base`,
editing the color does not copy the inherited width into its own parameters. Later
parent-width changes still propagate.

This is accepted future behavior, not an implemented setter or a decision about
object-local temporary effects.

### Decision points: material operations and behavior

Shared material own-parameter replacement is settled above. The points below
concern additional operations and object-local behavior.

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
Three application levels are accepted for the first implementation: kind → kind +
registered application property → specific object. The application explicitly
connects property values to its own data; the basic serializable rule fields are
accepted above, while complete type declarations remain open. The most specific applicable assignment
selects one material, whose properties resolve through its explicit inheritance
chain. This supersedes the earlier wording about overriding properties across
assignment levels. Built-in appearance and updates independent of data remain.
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
- Shared-material change propagation through explicit inheritance was subsequently
  accepted on 2026-10-09; see [shared edits and assignments](#shared-material-edits-and-object-assignments--accepted-2026-10-09).
  Object-local alter/replace/reset APIs remain open.
