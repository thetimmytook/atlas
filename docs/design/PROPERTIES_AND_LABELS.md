# Properties And Labels

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

### Principles of an extensible property and material system

- Extensions are registered in a separate Atlas configuration, not a page-global
  registry. One configuration may serve one or more maps; independent configurations
  do not affect each other. Built-in capabilities are available by default and need
  no application registration.
- Custom properties, behaviors, and future compatibility adapters are registered
  before creating the map. Registration defines a property's meaning, allowed values,
  and handling; runtime object and material values may still change after map creation.
- Changing registrations themselves while a map is running is not currently supported.
  The exact configuration API and mechanism for freezing registrations are undefined.
- Registering a property/behavior under an existing name in the corresponding registry
  of one configuration is rejected with a clear error; no silent replacement occurs.
  This applies to definitions, not property-value changes. An explicit mechanism to
  intentionally replace a built-in registration is left for the future.
- An unknown property in Atlas structural data or a material is an error reporting
  its name and path. This catches typos and missing extension registrations. Keys inside
  application data are not checked against the Atlas registry; data must still be
  JSON-serializable.
- Property registration must specify applicability: the object/object type or multiple
  types that support it. Applying a known property to an unsuitable object is rejected
  with a clear error. The exact designation mechanism (kind, classes, capabilities,
  or specific IDs) has not been chosen.
- No public recalculation dependency list is introduced for property registration.
  Atlas and node behavior manage updates using internal change indicators: geometry,
  bounding box, appearance, etc. A color change, for example, does not require geometry
  recalculation. The invalidation algorithm is an implementation detail. This does
  not revive deferred value bindings between properties.
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
- Cross-property bindings, a parameterized language, selectors, and a general layout
  engine were explicitly deferred by the user and are outside the current scope.

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
