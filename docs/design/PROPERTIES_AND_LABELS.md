# Properties And Labels

Status on 2026-10-12: JSON `data`, `MapElement.configure`, selection-property
registration and strict readers are implemented for mini review in the working
tree, not committed or merged. Labels and behavior registration remain future
work. The accepted [first-slice contract](MATERIALS_FIRST_SLICE_CONTRACT.md) and
[implementation checks](PROTOTYPE.md#first-material-slice--implemented-for-review-2026-10-12)
supersede earlier proposal-stage wording for this subset.

[Navigation and current summary](../DESIGN_MAIN.md)

Reviewed first-slice configuration, reader input and JSON-data signatures are in
the [contract](MATERIALS_FIRST_SLICE_CONTRACT.md);
labels and behavior registration remain separate work.

### First-slice review: selector names and strict readers — accepted, 2026-10-12

- Selection-property names and material-parameter names have separate namespaces.
  Registering a selector named `color`, `size` or `width` is valid: `when.color`
  matches a configured application value, whereas `properties.color` describes
  appearance. Neither registration defines the other. Reject duplicate selector
  registrations and overriding the built-in selector `kind`; do not reserve
  appearance parameter names in the selector registry. Application `data` keys
  remain free.
- Validate every reader applicable to an object's kind in every map, including
  roots, owned points and hidden/undisplayed objects. `optional: false` requires a
  correct value even when that map's rules never use the selector or explicit
  material assignment wins. Loading, attachment, owned-point creation and data
  replacement enforce this contract before mutation, including all maps sharing
  an object. Only optional `undefined` represents absence.
- Keep the frozen `id` / `kind` / candidate-`data` reader projection. The real
  runtime object continues exposing committed data until successful application.
  Reader failures/invalid results preserve the previous working state under the
  material validation guarantees.

These are accepted corrections to the first-slice proposal, not implemented
registration or validation. The
[contract](MATERIALS_FIRST_SLICE_CONTRACT.md#static-configuration-and-readers)
records the reviewed types and diagnostics.

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

### Setup property registration — accepted, 2026-10-12

The accepted registration record combines a custom property's description and
its application-supplied value reader. Built-in properties are already available.
The later static configuration clarification below supersedes the constructor
and separate setup-instance lifecycle, while retaining the registration fields.

Previously accepted constructor syntax, superseded by static configuration below:

```javascript
const setup = new MapSetup({
  properties: [
    {
      name: 'type',
      valueType: 'string',
      optional: true,
      appliesTo: ['point', 'line', 'route', 'polygon'],
      read: object => object.data?.type,
    },
  ],
});
```

- `name` identifies the property used in material conditions.
- `valueType` describes the value type; the example registers a string property.
- `optional: true` permits an absent value, which does not match a condition such
  as `type = exit`.
- `appliesTo` lists the object kinds supporting this property.
- `read` is supplied by the application and obtains the value from an object.
  The example's `data.type` path is an application choice, not built-in behavior.

Registrations and executable readers belong to application setup, outside map
JSON. Data replacement reevaluates the configured readers as already accepted;
this does not change the setup.

The registration fields above are accepted future design, not implemented exports.
The first selection-property value types are strings, finite numbers and booleans;
see the [accepted simple rule conditions](MATERIALS.md#simple-rule-conditions--accepted-2026-10-12).
Complete TypeScript signatures and defaults for omitted registration fields remain
open. This does not settle behavior/label registration or introduce a general
binding system.

### Static application configuration — clarification, 2026-10-12

The user chose a static method for configuring the shared property/material system.
This is global application setup used automatically by all maps, rather than a
setup assigned separately to each map. Live reconfiguration is outside this slice.

This supersedes separate `MapSetup` instances, the earlier independent-configuration
direction, and the unaccepted `map.setup` proposal. The accepted registration
fields (`name`, `valueType`, `optional`, `appliesTo`, `read`) remain unchanged.
Material descriptions and assignment rules remain map data, and runtime material
values remain independent between maps; global setup defines supported properties
and readers rather than sharing mutable material instances.

Illustrative method name, not a finalized public signature:

```javascript
MapElement.configure({
  properties: [
    {
      name: 'type',
      valueType: 'string',
      optional: true,
      appliesTo: ['point', 'line', 'route', 'polygon'],
      read: object => object.data?.type,
    },
  ],
});
```

The user permits any number of configuration calls before the first `load()` of
any map. Configuration becomes fixed when that first load begins; later
configuration calls are rejected. This replaces the assistant's one-call proposal.

Successive calls accumulate registrations, allowing different application modules
to contribute properties. Each call adds its registrations without replacing
previous ones. Duplicate names remain errors under the already accepted
duplicate-registration rule. This accumulation behavior is accepted. The method
name and error codes remain open. No engine implementation is requested here.

### Principles of an extensible property and material system

- The shared property/material system is configured through a static method for
  all maps in the application, following the latest clarification above. Built-in
  capabilities are available by default and need no application registration.
- Material descriptions and assignment rules belong to `MapDefinition`; each load
  creates independent runtime materials. Sharing an extension configuration does
  not share mutable material values between maps. See
  [map ownership and isolation](MATERIALS.md#map-ownership-and-isolation--accepted-2026-10-09).
- Custom properties, behaviors, and future compatibility adapters are registered
  during application initialization, before the first map load. Connections
  obtaining custom property values from application data also belong to this
  setup, which serves all maps.
  Registration defines a property's meaning, allowed values and handling; runtime
  object and material values may still change after map creation.
- Registrations and their application-data connections may be configured through
  multiple calls before the first map load begins, then remain fixed. See the
  [static configuration clarification](#static-application-configuration--clarification-2026-10-12),
  [accepted registration format](#setup-property-registration--accepted-2026-10-12) and
  [shared material-system setup](MATERIALS.md#shared-material-system-setup--clarification-2026-10-09).
- Registering a property/behavior under an existing name in the corresponding registry
  of one configuration is rejected with a clear error; no silent replacement occurs.
  This applies to definitions, not property-value changes. Selection names and
  appearance parameter names are separate as clarified above; `kind` cannot be
  replaced through first-slice selector registration. Behavior/appearance extension
  and intentional built-in replacement mechanisms remain future work.
- An unknown property in Atlas structural data or a material is an error reporting
  its name and path. This catches typos and missing extension registrations. Keys inside
  application data are not checked against the Atlas registry; data must still be
  JSON-serializable.
- Application classification may be stored in optional data.type, not a separate
  structural type property. Its values belong to the application and do not need
  registration in Atlas's structural property registry. The material system does
  not know this data path by default: the application explicitly connects its data
  to a registered property that material assignment can use. See the
  [2026-10-09 clarification](MATERIALS.md#application-defined-selection-properties--clarification-2026-10-09).
  The connection is configured during shared application/example initialization
  before the first map load. The earlier suggestion to wire it after each map load is
  superseded; the registration format is accepted above, while complete TypeScript
  signatures remain open.
- Application-data replacement through a copying setter and immutable getter is
  accepted. A replacement reevaluates that object's connected properties and any
  resulting material selection; see
  [runtime application data](GEOMETRY_AND_ROUTES.md#runtime-application-data--accepted-2026-10-09).
- Property registration must specify applicability: the object/object type or multiple
  types that support it. Applying a known property to an unsuitable object is rejected
  with a clear error, including parameters inherited from a material parent. A
  material's compatibility is determined by these property contracts; `kind`
  participates in selection rather than requiring another kind tag on the material.
  See [material compatibility](MATERIALS.md#material-description-and-compatibility--accepted-2026-10-09).
  Custom selection-property registration uses a list of kinds in `appliesTo`, as
  accepted above. Applicability contracts for behavior and appearance extensions
  remain open.
- No public recalculation dependency list is introduced for property registration.
  Atlas and node behavior manage updates using internal change indicators: geometry,
  bounding box, appearance, etc. A color change, for example, does not require geometry
  recalculation. The invalidation algorithm is an implementation detail. This does
  not choose a dependency-tracking API for application-data connections or revive
  the general deferred cross-property binding system.
- An omitted appearance parameter uses the default in its property description
  when the selected material and its explicit parent chain provide no value. The
  default does not introduce a parent relationship; see
  [appearance property defaults](MATERIALS.md#appearance-property-defaults--accepted-2026-10-12).
  Exact built-in values and the complete metadata schema remain open.
- Labels have a confirmed separation between serializable descriptions and runtime
  objects with behavior, extending the general Map JSON/runtime-instance separation.
- Only an explicit object form for label in JSON is confirmed, for example
  label: { text: "Exit" }. String shorthand and automatic conversion are unsupported.
  This replaces earlier examples of label as a string. The complete set of placement/
  appearance parameters and their API remains open.
- A label is part of its owner, not an independent map object. Clicking it counts as
  clicking the owner; no separate label-click or part: "label" is introduced without
  a concrete use case. A separate public interaction ID for the label is unnecessary.
- Label placement and readability are the map author's responsibility. Version one
  introduces no automatic collision avoidance, displacement, or hiding of labels.
  Future label visibility controls (for example, based on zoom) are deferred;
  no specific mechanism is being designed yet.

- Confirmed directions from MATERIAL_SYSTEM_EXPLORATION.md: typed properties with
  defaults/enum/validation and applicability checks; explicit node appearance contracts;
  grouping related parameters; exposed appearance contracts for composite-object parts;
  a small core and standard extensions. Exact schemas and APIs remain open. Isolation
  and explicit inheritance were already accepted earlier.
- Property registration/label behavior remain a proof-of-concept direction.
- A deprecation mechanism is needed: properties can be marked deprecated and warn
  when used. Metadata format and warning policy remain open.
- Future direction: pluggable polyfills/compatibility adapters for removed properties,
  avoiding obsolete implementations in the core. No specific contract is selected yet.
- General cross-property bindings, a parameterized language, a selector language
  and a general layout engine were explicitly deferred by the user. The later
  application-data connection, registration format and scalar-or-array material
  conditions are concrete decisions for a simple first implementation. Explicit
  NOT, grouped AND and other compound expressions are future possibilities;
  this does not approve the general system or require preparatory abstractions.

- The user agreed to a proof of concept for registered properties using label.
  This is a validation direction, not an instruction to start implementation.
- The user wants detailed validator diagnostics during development, less detail
  at runtime, and an option to disable validation. Which checks are optional must
  still be reconciled with strict loading and operation guarantees. The assistant's
  proposal to disable only additional extension checks while retaining mandatory
  correctness checks was not separately confirmed.
- Analysis of the earlier custom appearance-system sketch is stored separately:
  [MATERIAL_SYSTEM_EXPLORATION.md](../MATERIAL_SYSTEM_EXPLORATION.md).
  At the user's request, a full standalone style/material system is marked as
  a very distant future direction, outside the first Atlas version.
