# First material slice — accepted public contract

Status: **implemented and accepted for PR after final acceptance on 2026-10-16,
pending merge**. After reviewing the revised contract,
the user approved `pickable`, the full-definition constructors and implementation
of the first slice. All five implementation steps below are present. The named
runtime lookup remains provisional; broader interaction/resource APIs stay deferred.

[Main navigation](../DESIGN_MAIN.md) · [Current contract](CURRENT_CONTRACT.md) ·
[Materials and accepted decisions](MATERIALS.md) ·
[Property registration](PROPERTIES_AND_LABELS.md) ·
[Resources](RESOURCES_AND_SERIALIZATION.md) · [Diagnostics](DIAGNOSTICS.md)

## Baseline and scope

Inspected local HEAD `ff89f7ddfd8b2ebcbb34fc3dd5ec2c8c379e6cfd` on branch
`feat/synchronous-batch`. This HEAD includes synchronous nested batch. The dated
merged baseline in Current contract remains historical evidence; actual exports
and signatures were checked in [src/index.ts](../../src/index.ts), definitions,
runtime objects, `MapElement`, `AtlasError`, scene preparation, spatial picking and
the SVG renderer. Existing uncommitted material decisions are inputs to this
proposal and are preserved.

**Accepted behavior, retained:** global accumulating registrations, frozen from the
start of the first `load()`; named map-owned materials; explicit parent chains;
kind → conditional rule → explicit assignment precedence; exact scalar/alternative
matching; whole-value copying setters; atomic failed updates, including validation
across maps sharing an object; preparation of every declared SVG/PNG icon before
load replacement. `map.materials.get(name)` remains **provisionally accepted**.

**Review corrections, 2026-10-12:** point picking is independently configurable
with appearance-context defaults; selector and appearance names are separate;
standard fallback/defaults stay internal; `object.material` is only explicit
assignment; concrete constructors take full definitions; every applicable reader
is strict across all maps. The picking and constructor signatures below were subsequently accepted and
implemented; their behavior follows these corrections.

The declarations below are target fragments of the package-root public API.
Unshown existing members remain as they are. They describe the implementation submitted for review. Older proposal comments
in the illustrative fragments record their origin; the signatures are now accepted. No `MapSetup`, `map.setup`, public model/renderer lifecycle or general
collection abstraction is introduced.

## Accepted declarations

### JSON data and common objects

```ts
export type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

// Extends the existing foundation. Keep kind: string on the abstract base;
// the four existing concrete definitions retain their literal discriminants.
export interface MapObjectDefinition {
  readonly id?: string;
  readonly kind: string;
  readonly data?: JsonObject;
  readonly material?: string;
}

// Accepted point-specific addition; geometry and kind retain their current types.
export interface MapPointDefinition extends MapObjectDefinition {
  readonly kind: 'point';
  readonly position: Point2 | Point3;
  readonly pickable?: boolean;
}

export declare abstract class MapObject extends EventTarget {
  protected constructor(definition: MapObjectDefinition, field?: string);

  get id(): string;
  abstract get kind(): string;

  get data(): JsonObject | undefined;
  set data(value: JsonObject | undefined);

  // Only the explicitly assigned name, never the computed material.
  get material(): string | undefined;
  set material(value: string | undefined);
}
```

Reviewed JSON boundary: `data` is an optional plain JSON **object** at the top level;
nested values may be any `JsonValue`. All numbers must be finite. Reject cycles,
functions, symbols, bigint, undefined nested values, sparse arrays, accessors and
non-JSON class instances rather than silently transforming them through
`JSON.stringify`. Plain records with a null prototype are also valid. Copy and
deeply freeze accepted data; retained getter values remain snapshots. Arbitrary
application keys are allowed and never checked against the property registry.

Omission or whole-value assignment of `undefined` means absent data. `{}` is a
present empty object; `null` is allowed inside data, not as the whole data value.
With the repository's `exactOptionalPropertyTypes`, omit optional definition fields
in TypeScript; runtime setters explicitly accept `undefined` to clear them.

`MapPointDefinition`, `MapLineDefinition`, `MapRouteDefinition` and
`MapPolygonDefinition` inherit the added common fields. Their geometry, ID rules
and public runtime methods remain unchanged. Definitions supplied through load,
root addition or owned-point insertion/replacement must retain and validate the
new fields, including fields on line endpoints and route vertices.

Use one accepted constructor form for every concrete object: its full corresponding
definition. The existing point/polygon forms stay; line/route replace their current
two-argument forms. Optional IDs are resolved/generated by the same validation and
copying boundary as other definition input. No overload preserves the old form.

```ts
// Constructor/member excerpts; existing geometry getters and editing methods remain.
export declare class MapPoint extends MapObject {
  constructor(definition: MapPointDefinition);
  get kind(): 'point';

  // Explicit picking override, not the effective per-appearance value.
  get pickable(): boolean | undefined;
  set pickable(value: boolean | undefined);
}

export declare class MapPolygon extends MapObject {
  constructor(definition: MapPolygonDefinition);
  get kind(): 'polygon';
}

export declare class MapLine extends MapObject {
  constructor(definition: MapLineDefinition);
  get kind(): 'line';
  get points(): readonly [MapPoint, MapPoint];
}

export declare class MapRoute extends MapObject {
  constructor(definition: MapRouteDefinition);
  get kind(): 'route';
  get points(): readonly MapPoint[];
}
```

Creation paths migrated in this implementation:

| Path                                                             | Target behavior                                                                                                                                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct `new MapLine(id, points)` / `new MapRoute(id, points)`    | Migrate to `new MapLine({ id, kind: 'line', points, ... })` / `new MapRoute({ id, kind: 'route', points, ... })`; `id` may be omitted. Common `data`/`material` are part of that definition. |
| Direct `new MapPoint(definition)` / `new MapPolygon(definition)` | Keep the current form; point definitions additionally accept `pickable`.                                                                                                                     |
| `map.load(definition)` and `map.objects.add(definition)`         | Keep public forms; the internal factory passes the complete corresponding definition to each constructor, retaining common fields and owned-point `pickable`.                                |
| `map.objects.add(instance)`                                      | Keep instance identity/sharing; validate the target map before attaching. No cloning or reconstruction.                                                                                      |
| Route `addPoint` / `insertPoint` / `replacePoints`               | Keep definition inputs and copying; preserve and validate `pickable` with other point fields.                                                                                                |

Current line/route construction occurs in
[the object factory](../../src/objects/map-object-collection.ts) and direct runtime
tests, including route, point, collection, z and browser suites. These call sites
must migrate together with the constructors; definition-driven examples retain
their creation form. No compatibility wrapper or third `attributes` argument is
part of this proposal.

Direct construction with the accepted signatures (each constructor
copies its full input, including owned point definitions):

```ts
new MapLine({
  kind: 'line',
  data: { type: 'connector' },
  material: 'path',
  points: [
    { kind: 'point', position: { x: 0, y: 0 } },
    { kind: 'point', position: { x: 20, y: 0 } },
  ],
});

new MapRoute({ id: 'walk', kind: 'route', points: [], material: 'path' });
```

A detached object validates data shape and reference syntax immediately; material
existence/compatibility needs a map and is checked before attachment. Attachment
keeps existing instance identity and shared-object support. A name is resolved
independently in each map, so the same object may receive different resolved
appearance in different maps. IDs are not a unique registry key for consumers.

<a id="point-picking--proposed-minimal-flag"></a>

### Point picking — accepted minimal flag

`pickable` belongs only to `MapPointDefinition` / `MapPoint`, independently of
materials and application `data`. The getter returns the explicit override or
`undefined`; it cannot report one effective boolean for a point with several roles.
For each eligible concrete point appearance, resolve it as follows:

| Explicit `pickable`  | Independent/root appearance | Route-owned appearance |
| -------------------- | --------------------------- | ---------------------- |
| Absent / `undefined` | Enabled                     | Disabled               |
| `true`               | Enabled                     | Enabled                |
| `false`              | Disabled                    | Disabled               |

Assigning `undefined` removes the override and restores each appearance's own
default. It neither removes the symbol nor edits a material. Assigning a symbol
does not change `pickable`; enabling picking does not add a symbol. The same point
may therefore be independently pickable as a root and unpickable as a route vertex
in the same or another map. Explicit true/false applies to all its appearances,
subject to existing layer visibility, clipping and membership eligibility.
Keep only the explicitly supplied flag in the object and load snapshot; never
copy a role's computed default into a shared point or its resolved definition.

Accept only boolean or `undefined`; validate before mutation. Reject invalid input
with `AtlasError`, code `INVALID_POINT_PICKABLE`, constant message
`Point pickable must be a boolean or undefined.`, and structured `details`.
Keep the previous value/interaction and emit no successful-change notification on
failure. Successful edits invalidate affected picking before synchronous `change`
handlers, including in batch and disconnected/shared-object use, without changing
route geometry. This validation is independent of material errors.

For an enabled point, use the accepted circle/image/no-symbol hit shapes
below. This flag creates no general interaction or hit-area API. Line endpoints
still have no separately prepared point appearances; setting the flag alone does
not create one. Clipping cuts likewise create no point appearance or identity.

### Static configuration and readers

```ts
export interface PropertyReadObject {
  readonly id: MapObject['id'];
  readonly kind: MapEntryDefinition['kind'];
  readonly data?: JsonObject;
}

export interface PropertyRegistration {
  readonly name: string;
  readonly valueType: 'string' | 'number' | 'boolean';
  readonly optional: boolean;
  readonly appliesTo: readonly MapEntryDefinition['kind'][];
  readonly read: (object: PropertyReadObject) => unknown;
}

export interface MapConfiguration {
  readonly properties: readonly PropertyRegistration[];
}

export declare class MapElement extends HTMLElement {
  static configure(configuration: MapConfiguration): void;

  // Existing signatures, shown for context.
  load(definition: MapDefinition): Promise<void>;
  batch(callback: () => void): void;
  get objects(): MapObjectCollection;
  get definition(): ResolvedMapDefinition | undefined;

  // New, provisionally accepted access pattern; lookup type below.
  get materials(): MaterialLookup;
}
```

All five registration fields are required, with no inferred defaults.
Names are exact, nonempty strings without surrounding whitespace; `appliesTo` is a
nonempty list of supported public kinds. Selector names form a separate namespace
from material parameter names. Reject duplicate registered selectors and overriding
the built-in selector `kind`; selectors named `color`, `size` or `width` are valid.
For example, `when.color` reads a registered value while `properties.color` sets
appearance; neither defines the other. Application `data` keys remain unrestricted.
This first configuration API
registers selection values/readers; it does not register new renderer parameters.
Copy registration records/lists and retain function references. Each configure
call validates completely before adding anything: a duplicate within the call or
against prior registrations rejects the whole call. An empty list is a no-op
before locking. Any configure call after locking is an error. Creating components
or detached objects does not lock configuration; beginning the first load does,
even if that load subsequently fails. No reset/unlock method is proposed.

`read` returns `unknown` deliberately: JSON data and JavaScript callers can supply
any value, which Atlas must validate against `valueType`. A string remains a
string, a number must be finite, and a boolean remains a boolean. Only `undefined`
is absence, allowed when `optional: true`. Null, arrays, objects, promises and
wrong primitive types are errors. Read and validate every registered property
applicable to the object, including when explicit material assignment wins or no
rule currently uses the property; skip readers for other kinds.

In particular, `optional: false` requires a correct value for **every object of an
applicable kind in every map**, including roots and owned points, hidden or
currently undisplayed objects. A map cannot opt out because its rules do not use
that selector or an explicit material wins. Loading, attachment, owned-point
creation and runtime data replacement must enforce this contract. Absence or an
invalid value rejects the operation before mutation; a shared object's assignment
must satisfy all maps using it. Detached objects are checked against these map
requirements before attachment.

Reviewed reader input is a frozen projection of `id`, `kind` and copied immutable
`data`, **not a runtime instance**. During `data` validation it contains the
candidate data; the real object's getter still exposes the committed value.
This provides candidate reads without temporary mutation, rollback or a second
reader argument. Readers must be synchronous, deterministic and side-effect-free;
geometry, material selection and map state are not reader inputs in this slice.
No `instanceof MapPoint` or runtime methods are promised on the projection.
Atlas may reevaluate readers at validation/update boundaries; call counts are
not public behavior. Thrown failures are wrapped with their original `cause`.

### Materials, conditions and resources in definitions

```ts
export type MaterialScalar = string | number | boolean;
export type MaterialConditionValue =
  MaterialScalar | readonly string[] | readonly number[] | readonly boolean[];

export interface MaterialCondition {
  readonly kind: MapEntryDefinition['kind'] | readonly MapEntryDefinition['kind'][];
  readonly [property: string]: MaterialConditionValue;
}

export interface MaterialRule {
  readonly when: MaterialCondition;
  readonly material: string;
}

export interface MaterialDefinition {
  readonly properties: MaterialProperties;
  readonly inherits?: string;
}

export type ImageResourceId = string;

export interface ImageResourceDefinition {
  readonly kind: 'image';
  readonly source: string;
}

export interface MapDefinition {
  readonly layers: readonly MapLayerDefinition[];
  readonly objects?: readonly MapEntryDefinition[];
  readonly materials?: Readonly<Record<string, MaterialDefinition>>;
  readonly materialRules?: readonly MaterialRule[];
  readonly resources?: Readonly<Record<ImageResourceId, ImageResourceDefinition>>;
}

export interface ResolvedMapDefinition extends MapDefinition {
  // Existing ID-completed types; ResolvedMapEntry remains internal as today.
  readonly layers: readonly ResolvedMapLayerDefinition[];
  readonly objects: readonly ResolvedMapEntry[];

  readonly materials: Readonly<Record<string, MaterialDefinition>>;
  readonly materialRules: readonly MaterialRule[];
  readonly resources: Readonly<Record<ImageResourceId, ImageResourceDefinition>>;
}
```

Treat omission/undefined of `materials`, `materialRules` or `resources` as an
empty dictionary/list; reject `null` for each collection. Reject unknown fields in
material declarations (only `properties`/`inherits`), image resource declarations
(only `kind`/`source`) and rules (only `when`/`material`), including typos such as
`inherit`. This restriction does not apply to application keys inside `data`.
`properties` and `when` remain required; `{ properties: {} }`
is a valid material. Snapshot fields are copied and deeply frozen, preserve only
declared own properties/explicit `inherits`, and normalize these three absent
top-level fields to empty values. Internal fallback, inherited/default values,
decoded resources and computed reader values do not enter the snapshot.
`map.definition` continues to represent the accepted **load**, not later edits.

Require `when.kind` to identify target kinds and the assignment level
without inference from current objects. Only `kind` means a kind-default rule;
`kind` plus any registered properties means a conditional rule. Every named
property must be applicable to **all** kinds listed by the condition; otherwise
reject load. The selected material's effective explicit parameters must also be
compatible with every target kind, even if no current object matches that rule.
Unknown selection keys, unsupported kinds, wrong value types and mixed-type
arrays are load errors. Reject an empty alternatives array as likely author error;
duplicate alternatives are harmless. Exact comparison uses `===` on validated
scalars; absent optional values never match. There are no NOT/groups/expressions.

Validate definitions and references even when currently unused: names, parents,
cycles, known parameter types and image references. Cross-kind applicability is
checked for rules, explicit object assignments and affected runtime consumers. A
material has no separate kind and can serve several kinds if all its effective
explicit parameters are compatible. Defaults are resolved only for properties
supported by the receiving object; they do not make a material incompatible.

Names/resource IDs are exact nonempty strings without surrounding whitespace.
`ImageResourceId` is a plain alias of `string`, used for `PointImage.resource`,
resource dictionary keys and internal prepared-image maps
(`ReadonlyMap<ImageResourceId, PreparedImage>`). It does not brand IDs or change
validation; source URLs and material names remain separate string roles.
`source` is a nonempty image URL. Reviewed first browser URL rule: resolve it
against `document.baseURI` at load preparation, retaining the supplied string in
the snapshot. A source's decoded format must be SVG or PNG; the filename extension
alone does not decide validity. No public resource collection, custom loader or
runtime resource mutation is added in this slice. Existing layer backgrounds keep
their separate provisional `BackgroundDescription` contract.

### Appearance properties and image reference

```ts
export interface PointImage extends Partial<Size> {
  readonly resource: ImageResourceId;
  readonly preserveAspectRatio?: boolean;
  readonly anchor?: Point2;
}

export interface MaterialProperties {
  readonly symbol?: 'none' | 'circle' | 'image';
  readonly color?: string;
  readonly size?: number;
  readonly width?: number;
  readonly opacity?: number;
  readonly image?: PointImage;
}
```

`Partial<Size>` retains readonly dimensions while making width/height optional.
The alias and size reuse were clarified on 2026-10-16 without changing behavior.

Reviewed minimal names and property defaults (accepted in the 2026-10-12 review):

| Parameter | Type / validation                                                 | Applicability                      | Default when absent through the whole parent chain                              |
| --------- | ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `symbol`  | `'none' \| 'circle' \| 'image'`                                   | Point                              | `'circle'` for an independent appearance; `'none'` for a route-owned appearance |
| `color`   | `string`, `#RRGGBB`                                               | Point circle, line, route, polygon | Point `'#2775d9'`; line/route `'#d95012'`; polygon `'#f59e0b'`                  |
| `size`    | Finite positive `number`, circle/no-symbol hit diameter in CSS px | Point                              | `22`                                                                            |
| `width`   | Finite positive `number`, stroke width in CSS px                  | Line, route                        | `4`                                                                             |
| `opacity` | Finite `number` in `[0, 1]`, fill opacity                         | Polygon                            | `0.3`                                                                           |
| `image`   | `PointImage` with a declared image resource                       | Point                              | Absent; required after resolution when `symbol === 'image'`                     |

For this slice, use six-digit hex colors (case-insensitive) rather than a
DOM/CSS-dependent color grammar; alpha is provided only by polygon `opacity` or
the image itself. Circle outlines are outside the reviewed minimal parameter set;
the temporary white 2 px circle outline would be removed on material integration.
Round line caps/joins stay fixed as in current display and picking. Size/width
remain screen units at every zoom; map-scaled sizes are deferred.

Resolve each top-level property independently: own value → nearest explicit parent
value → that property's applicable default. `image` is **one atomic value**:
an own `{ resource: 'other', width: 32 }` replaces the entire inherited image
reference, including its height, aspect-ratio flag and anchor. No deep merge.
Defaults for missing fields inside that chosen `PointImage` apply afterwards.
The implementation centralizes these values in internal `DEFAULTS` groups
`point`, `routeOwnedPoint`, `path`, `polygon` and `image`; own → explicit parents →
defaults remains unchanged. The image group provides `preserveAspectRatio: true`
and center anchor `new Point2(0.5, 0.5)`.
`MapMaterials.appearanceFor` returns `ResolvedAppearance` on both cache hits and
misses. Its cached lookup may be undefined, but the guarded hit is narrowed and
a miss creates/returns the appearance; no optional result or tsconfig change is needed.
An absent own `image` inherits the whole parent value; no `undefined`/null removal
sentinel is stored in the own set. Removing an override means omitting its key in
the replacement object.

`color` is inactive for image/none symbols; `size` does not affect an image. Supplied
values are still validated and remain point-compatible. A supplied `image` reference is checked
even when the current symbol is a circle/none. A material resolving to an image
symbol must supply an effective image reference. Incompatible explicit parameters
are errors, including inherited parameters; a line must not silently ignore
`symbol`, `size` or `image`.

Image widths/heights must be finite and positive. `preserveAspectRatio` defaults
to `true`; omitted dimensions follow the accepted source-size rules. With two
dimensions and preserved aspect ratio, use the largest fitting image rectangle;
there is no enclosing blank box affecting anchor or picking. With preservation
disabled, dimensions are independent and a missing dimension uses its source
value. Resource colors/alpha are retained without tinting.

Use `anchor` as normalized coordinates in `[0, 1]` on the **resulting** image
rectangle: x right, y down, default `{ x: 0.5, y: 0.5 }`; lower center is
`{ x: 0.5, y: 1 }`. Reuse `Point2`, accepting a plain `{ x, y }` and copying it to
a frozen `Point2`. No z, pixel-offset or named-anchor forms. For final CSS size
`w × h`, top-left relative to the map coordinate is `(-anchor.x * w, -anchor.y * h)`.
When the point appearance's resolved `pickable` is enabled, picking covers exactly this final
rectangle, including transparent pixels, with the same resolved dimensions/anchor
used by SVG. For a 40 × 20 source constrained to 80 × 80 with preservation, the
result and hit rectangle are 80 × 40; a bottom-center anchor offsets by (-40, -40).

Reviewed source-dimension rules, applied during preparation for every declared icon:

- PNG: decoded intrinsic width/height in CSS pixel units, both finite and positive.
- SVG: use positive root `width`/`height` expressed as unitless numbers or px.
  Explicit numeric values must be finite and positive: zero, negative and
  overflowed values reject with `INVALID_IMAGE_RESOURCE` and resource/source,
  dimension field and supplied value in `details`, even with a valid `viewBox`.
  If one is missing, derive it from a positive finite `viewBox` width/height ratio.
  If both are missing, use the `viewBox` width/height as source pixel dimensions.
  Relative/other length units are treated as unavailable dimensions in this slice.
- Reject if this cannot establish two finite positive source dimensions, even if
  a material supplies both display dimensions. This avoids viewport-dependent
  source sizes and arbitrary fallback dimensions. Source-size override fields
  and a broader SVG length resolver can be considered when a concrete icon needs them.

## Runtime materials and selection

```ts
// Type-only public surfaces. Construction and mutable storage remain internal.
export interface Material {
  readonly name: string;
  readonly inherits?: string;

  get properties(): MaterialProperties;
  set properties(value: MaterialProperties);
}

export interface MaterialLookup {
  get(name: string): Material | undefined;
}
```

The getter returns a deeply frozen own-parameter snapshot; inherited/default
parameters are absent. The setter validates and copies the **complete** candidate
own set before applying it. Earlier getter values remain snapshots. Parent and
name are read-only; changing the material graph/rules or adding/removing materials
at runtime is separate work. No public material events are proposed.

`map.materials` is an empty lookup before the first successful load.
It refers to the active load's set while another load is preparing or fails;
a successful replacement supplies a new lookup and new materials. Retained old
handles do not affect the new map. Each successful load creates independent
runtime instances for the declared named materials. Runtime properties changes do not rewrite
the load snapshot. Unknown lookup names return `undefined`; an unknown assigned
name is an error.

Only user-declared named materials are public through this lookup. Standard
appearance and parameter defaults stay internal: no reserved material names,
lookup handles, inheritance references or editable built-in materials are exposed.
All named references (`material` in rules/objects and `inherits`) resolve only
against the map's declared `materials`. A name starting with `builtin.` has no
special meaning and works only if the author explicitly defines it like any
other name. Dots never imply inheritance. To define a common appearance, declare
a user material and a kind-only rule; explicitly inherit from that user material
where needed.

For each appearance, select one material in this order:

1. Start with the internal standard fallback for its kind and appearance context.
   A route-owned point defaults to no symbol; an independent occurrence of that
   same instance defaults to a circle. Neither fallback has a public reference name.
2. Use the last matching kind-only rule, if any.
3. Use the last matching conditional rule, if any, regardless of where kind-only
   rules occur in the list.
4. Use the object's explicit `material` name, if present.

Only that selected material and its explicit ancestors provide values. Matching
alternatives and extra condition keys do not add specificity levels. Omitting
`inherits` means no parent. In particular, a partial conditional material does
not inherit an application's kind-default material automatically. Missing
parameters resolve through its explicit parents, then parameter defaults; internal
fallback is not an implicit parent.

Keep three concepts distinct: `object.material` is an optional **explicit name**;
the **selection result** belongs to a concrete appearance in a particular map/role;
`material.properties` is only a named material's **own explicit parameters**.
With `object.material === undefined`, rules and internal fallback still provide
a selection result and resolved supported parameters for every concrete
appearance, including one whose symbol is `'none'`. They always exist internally.
A shared object can have different results in different maps and as root versus
route-owned point; no public computed-material getter is added to `MapObject`.

The route-owned fallback/default is an **appearance context**, not another public
kind or a mutation of the shared `MapPoint`. A kind-point rule or explicit material
can supply a symbol to that occurrence, but cannot turn on separate point picking.
Route vertices keep contributing to path geometry, even with no symbol. Route
path hits return the route; an enabled owned-point hit returns the original point
with its route. Cuts create no point symbol or identity.

Use the point's `pickable` flag and context defaults described above.
For an enabled point with `symbol: 'none'`, retain the centered circular hit area
of diameter `size`, also used by a circle symbol; this applies to either role.
Image picking uses the resolved anchored rectangle. These fixed shapes require
no configurable hit-area schema. Symbol edits never enable/disable point picking.
The new flag is the only interaction addition in this slice; general interaction
and hit-area APIs remain separate work.

## Errors and update boundary

```ts
export type AtlasMaterialErrorCode =
  | 'MATERIAL_CONFIGURATION_LOCKED'
  | 'INVALID_MATERIAL_CONFIGURATION'
  | 'DUPLICATE_PROPERTY_REGISTRATION'
  | 'INVALID_OBJECT_DATA'
  | 'INVALID_MATERIAL_DEFINITION'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_MATERIAL_PARENT'
  | 'MATERIAL_INHERITANCE_CYCLE'
  | 'INVALID_MATERIAL_RULE'
  | 'MATERIAL_PROPERTY_READ_FAILED'
  | 'INVALID_SELECTION_PROPERTY_VALUE'
  | 'UNKNOWN_MATERIAL_PROPERTY'
  | 'INVALID_MATERIAL_PROPERTY'
  | 'INCOMPATIBLE_MATERIAL_PROPERTY'
  | 'UNKNOWN_IMAGE_RESOURCE'
  | 'INVALID_IMAGE_RESOURCE'
  | 'IMAGE_RESOURCE_LOAD_FAILED';

export interface AtlasMaterialErrorOptions extends Omit<AtlasErrorOptions, 'code'> {
  readonly code: AtlasMaterialErrorCode;
}

export declare class AtlasMaterialError extends AtlasError {
  readonly code: AtlasMaterialErrorCode;
  constructor(options: AtlasMaterialErrorOptions);
}
```

Use an options-only constructor with an internal fixed message per code and
constant `name = 'AtlasMaterialError'`. This reuses inherited readonly `details`
and `ErrorOptions.cause` and prevents variable messages at call sites. Initial
fixed messages/reasons for review:

| Code                               | Constant message                                      |
| ---------------------------------- | ----------------------------------------------------- |
| `MATERIAL_CONFIGURATION_LOCKED`    | `Material configuration is locked.`                   |
| `INVALID_MATERIAL_CONFIGURATION`   | `Invalid material configuration.`                     |
| `DUPLICATE_PROPERTY_REGISTRATION`  | `Property name is already registered.`                |
| `INVALID_OBJECT_DATA`              | `Invalid object data.`                                |
| `INVALID_MATERIAL_DEFINITION`      | `Invalid material definition.`                        |
| `UNKNOWN_MATERIAL`                 | `Unknown material reference.`                         |
| `UNKNOWN_MATERIAL_PARENT`          | `Unknown material parent.`                            |
| `MATERIAL_INHERITANCE_CYCLE`       | `Material inheritance contains a cycle.`              |
| `INVALID_MATERIAL_RULE`            | `Invalid material rule.`                              |
| `MATERIAL_PROPERTY_READ_FAILED`    | `Unable to read selection property.`                  |
| `INVALID_SELECTION_PROPERTY_VALUE` | `Invalid selection property value.`                   |
| `UNKNOWN_MATERIAL_PROPERTY`        | `Unknown material property.`                          |
| `INVALID_MATERIAL_PROPERTY`        | `Invalid material property value.`                    |
| `INCOMPATIBLE_MATERIAL_PROPERTY`   | `Material property is incompatible with object kind.` |
| `UNKNOWN_IMAGE_RESOURCE`           | `Unknown image resource reference.`                   |
| `INVALID_IMAGE_RESOURCE`           | `Invalid image resource.`                             |
| `IMAGE_RESOURCE_LOAD_FAILED`       | `Unable to prepare image resource.`                   |

Use `details` for relevant `field`, `property`, `material`, `parent`, `resourceId`,
`source`, `objectId`, `kind`, `ruleIndex`, expected/actual values or cycle path.
Do not invent mandatory public map IDs. Invalid/unsupported image descriptions
and indeterminate dimensions use `INVALID_IMAGE_RESOURCE`; fetching/decoding
failures use `IMAGE_RESOURCE_LOAD_FAILED` with `cause`. Thrown reader failures
use `MATERIAL_PROPERTY_READ_FAILED` with `cause`; invalid returned values use
`INVALID_SELECTION_PROPERTY_VALUE`. Structural rule/type/applicability failures
use `INVALID_MATERIAL_RULE` with structured context. Existing unrelated Atlas
codes, including `MAP_LOAD_IN_PROGRESS`, keep their current meanings.

Accepted atomicity applies to load and every individual setter, including
`point.pickable` and assignments inside
batch. Reviewed concrete update boundary:

1. Copy/validate candidate input; evaluate readers using candidate data where
   appropriate; resolve selection, parent values, resource IDs and dimensions.
2. Before object mutation, validate every map using the instance, including owned
   point uses, hidden layers and disconnected components. Before material mutation,
   validate its graph descendants and affected consumers in that material's map,
   including rule target kinds. Readers may fail even when selection is unchanged.
3. Only after all checks succeed, commit the value and mark affected appearances
   current/dirty in every affected scene before synchronous application handlers.
   Existing payload-free object `change` remains sufficient for this slice.
   Rejected assignments change no state/appearance and emit no successful-change
   notification. Validation never relies solely on connected DOM event listeners.

State, readers and picking remain immediate; SVG follows normal RAF coalescing.
`map.batch()` defers only that component's rendering and is not a transaction
over several assignments. A later rejected assignment does not undo an earlier
successful one; a shared object's other map follows its own render scheduling.

Load prepares all declared resources, including unused ones, alongside existing
background preparation, before showing/replacing the scene. Failed preparation
preserves previous objects, materials, resources, camera, appearance and picking.
The first detected icon-resource failure rejects preparation without waiting for
other requests. Internal cancellation aborts sibling fetch/body work and clears
pending image sources where possible; candidate Blob URLs are released. Guards
after asynchronous boundaries prevent late work from allocating/committing a
result. Late rejections remain observed, the original failure is retained and the
next `map.load()` can start after rejection. No public cancellation API is added.
Switching to an already prepared image is synchronous. Adding/attaching roots and
editing route membership must validate candidate common fields against every
affected map before committing membership, preserving shared instances and the
existing all-input-first validation of route replacement.

Implementation must keep resolved appearance/dimensions in the renderer-independent
scene, as the common source for SVG and spatial picking. Browser image decoding
belongs to the browser preparation boundary; runtime values expose neither DOM
nodes nor SVG shapes. Extend current local invalidation for appearance changes;
color-only edits must not rebuild or serialize path geometry or polygon cells, and
material edits must preserve unrelated scene entries/SVG nodes. Picking does not
drain the display changes. The internal single-consumer drain preserves separate
geometry and appearance sets; an entry may be in both. SVG applies both changes in
the same paint, including either assignment order within batch, and retains both
sets while the viewport is unusable. Membership/topology, clipping eligibility and captured
hit revalidation retain their existing behavior. This chooses no new public scene
schema or general dependency framework.

## Reviewed signatures

The following choices were accepted with the user's corrections and are implemented.
The complete slice passed final acceptance on 2026-10-16.

| Choice                       | Reviewed result                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absent map fields and `data` | Empty materials/rules/resources; absent data is `undefined`, present data is a JSON object.                                                                                                                                 |
| Empty alternatives           | Reject during load.                                                                                                                                                                                                         |
| Reader errors/results        | Check every applicable reader for every corresponding object in every map; `optional: false` requires a valid value even when rules do not use it. Only optional `undefined` is absence; preserve thrown failures in cause. |
| Reader input                 | Frozen id/kind/candidate-data projection.                                                                                                                                                                                   |
| Selector names               | Separate from appearance parameter names; reject selector duplicates and overriding `kind`, allow `color`/`size`/`width`.                                                                                                   |
| Standard appearance          | Internal fallback/defaults only; no public reserved names or mutable built-in materials.                                                                                                                                    |
| SVG/PNG source sizes         | Decoded PNG sizes; SVG unitless/px dimensions, deriving missing values from viewBox; reject indeterminate sizes.                                                                                                            |
| Icon reference and anchor    | `image: { resource, width?, height?, preserveAspectRatio?, anchor?: Point2 }`; center default and whole-image inheritance.                                                                                                  |
| Material access              | Explicit object name, selection per appearance, own parameter snapshots and provisionally accepted named lookup remain distinct.                                                                                            |

**Accepted signatures:** `MapPointDefinition.pickable?: boolean` with an explicit
`boolean | undefined` runtime getter/setter and context defaults; full-definition
`MapLine` / `MapRoute` constructors replacing the old forms. Their declarations,
validation and affected creation paths are shown above. Sizes, material interfaces
and other retained choices are not reopened.

## Compact end-to-end example

Target API usage with the accepted point flag; `MapElement`, `MapPoint` and `MapDefinition` are
existing export names, and the added fields/methods above are now implemented for
review. The map is an existing connected
`MapElement`; application initialization runs before any map's first load.

```ts
import { MapElement, MapPoint, MapRoute } from 'atlas';
import type { MapDefinition } from 'atlas';

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
// Other modules may configure additional names before the first load starts.

const definition: MapDefinition = {
  resources: {
    'exit-icon': { kind: 'image', source: '/icons/exit.svg' },
  },
  materials: {
    marker: { properties: { color: '#777777', size: 22 } },
    exit: {
      inherits: 'marker',
      properties: {
        symbol: 'image',
        image: { resource: 'exit-icon', width: 32, anchor: { x: 0.5, y: 1 } },
      },
    },
    important: { inherits: 'marker', properties: { size: 32 } },
    'route.poi': { inherits: 'marker', properties: { symbol: 'circle', color: '#008800' } },
    path: { properties: { color: '#228844', width: 4 } },
  },
  materialRules: [
    { when: { kind: 'point' }, material: 'marker' },
    { when: { kind: 'point', type: ['exit', 'entrance'] }, material: 'exit' },
    { when: { kind: ['line', 'route'] }, material: 'path' },
  ],
  objects: [
    { id: 'a', kind: 'point', position: { x: 10, y: 20 }, data: { type: 'other' } },
    {
      id: 'b',
      kind: 'point',
      position: { x: 40, y: 20 },
      material: 'important',
    },
    {
      id: 'walk',
      kind: 'route',
      points: [
        { id: 'start', kind: 'point', position: { x: 10, y: 40 } },
        // Ordinary bend: no symbol and no separate point picking by context default.
        { id: 'bend', kind: 'point', position: { x: 30, y: 40 } },
        // Symbol and picking are independently explicit for this point of interest.
        {
          id: 'poi',
          kind: 'point',
          position: { x: 30, y: 60 },
          material: 'route.poi',
          pickable: true,
        },
      ],
    },
  ],
  layers: [{ id: 'ground', objects: ['a', 'b', 'walk'] }],
};

async function updateExample(map: MapElement): Promise<void> {
  await map.load(definition); // Prepares exit-icon even before any point uses it.
  const point = map.objects.get('a');
  const route = map.objects.get('walk');
  const marker = map.materials.get('marker');

  if (!(point instanceof MapPoint) || !(route instanceof MapRoute) || !marker) {
    throw new Error('Example inputs are missing.');
  }

  point.data = { ...point.data, type: 'exit' }; // Rule selects the original-color icon.
  point.material = 'important'; // Explicit assignment selects a 32 px circle.
  point.material = undefined; // Data still says exit: conditional icon rule resumes.

  marker.properties = { ...marker.properties, color: '#008800', size: 26 };
  // b inherits the new color, keeping important's own size 32.
  // a keeps the image colors and width; circle color/size do not tint/resize it.

  point.data = { type: 'other' }; // a is now the green 26 px marker circle.
  marker.properties = { color: '#008800' }; // Remove size override: a falls back to 22.

  const poi = route.points[2];

  if (poi) {
    poi.pickable = false; // Circle stays visible; separate point picking is disabled.
    poi.pickable = undefined; // Restore route-owned default: still disabled.
    poi.pickable = true; // Point hit returns poi and owning route; path hit returns route.
  }
}
```

## Target exports

Keep existing package-root runtime/type exports. Add only the runtime value
`AtlasMaterialError`; the static method and getters/setters extend existing
classes. Add type exports `JsonValue`, `JsonObject`, `PropertyReadObject`,
`PropertyRegistration`, `MapConfiguration`, `MaterialScalar`,
`MaterialConditionValue`, `MaterialCondition`, `MaterialRule`, `MaterialDefinition`,
`ImageResourceDefinition`, `ImageResourceId`, `PointImage`, `MaterialProperties`, `Material`,
`MaterialLookup`, `AtlasMaterialErrorCode` and `AtlasMaterialErrorOptions`.
Reuse existing `MapEntryDefinition`, `MapObjectDefinition`, `MapPointDefinition`,
`MapLineDefinition`, `MapRouteDefinition`, `MapPolygonDefinition`, `MapEntry`,
`MapObjectCollection`, `Point2`, `Size`, `AtlasErrorOptions` and resolved definition
types. Material constructors, the model, scene, renderer, decoded resources and
the existing internal `ResolvedMapEntry` do not become root exports.

## Next implementation mini steps and scenarios

The user authorized implementation after the signature mini review. These five
steps are implemented, reviewed and accepted for PR on 2026-10-16. Merge is pending.

1. **Static configuration, common data and constructors.** Implement locking/accumulation
   and copied JSON state/read projections; migrate line/route factory and direct
   callers to the full-definition constructors without compatibility overloads.
   Check several configure calls, duplicate-call atomicity, first failed load
   locking, optional/required/wrong/throwing readers, immutable snapshots and
   candidate data observation, selector/material name coexistence, required readers
   unused by any rule, all concrete constructor inputs, ID generation and full
   field copying. Introduce error contracts with their first consumers.
2. **Definitions and material resolution.** Validate named graph, conditions and
   own/default resolution at candidate load. Check all three precedence levels,
   last-match order, scalar/array exact matching, optional absence, required kind,
   empty/mixed arrays, dotted names without parents, unknown references/cycles and
   inherited incompatibility, including unused rules and declared materials,
   internal fallback without a public name and no implicit fallback inheritance.
3. **Image preparation and atomic replacement.** Prepare every SVG/PNG declaration,
   then replace only on success. Check unused broken icons, format/source-size
   failures, SVG viewBox/one-dimension cases, all accepted aspect-ratio size cases,
   original colors and sync switching between loaded IDs. A failed load must
   preserve the complete previous working map and camera.
4. **Runtime selection and material edits.** Wire whole-value setters and
   per-map lookup, with preflight across map consumers and material descendants.
   Check assign/clear, own override removal, descendant overrides, two independent
   loads, shared root/owned-point mutations rejected by one of two maps, atomic
   membership changes, hidden/disconnected use, detach/reattach and stale handles.
5. **Shared scene appearance, SVG and picking.** Replace temporary appearance
   through local invalidation. Check circle/image/none, final anchored rectangular
   hit area including transparency, immediate width/size picking before paint and
   inside batch, captured-hit revalidation after edits, no-symbol route geometry,
   the accepted pickable getter/setter, default/true/false/undefined in both roles,
   independent symbol changes, invalid-flag atomicity, no-symbol enabled point hits,
   the same point as root and route-owned across maps, all
   layer appearances and preserved unrelated nodes/path geometry. Verify that an
   icon switch replaces only the necessary symbol output and survives reconnect.
   Removing a captured point's picking participation during a handler must suppress
   its delivery without choosing an underlying replacement hit.

Implementation validation and the changed-file guide are recorded in
[Prototype](PROTOTYPE.md#first-material-slice--implemented-for-review-2026-10-12).
The dedicated Node/browser suites exercise the scenarios above. Labels, behaviors,
alter/replace/reset, polygon outlines, a general selector language, universal
collections, the full resource manager, background migration, public multiple
viewports and interaction API expansion beyond the accepted point flag remain
separate work.
