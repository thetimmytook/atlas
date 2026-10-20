# Properties And Labels

Status on 2026-10-20: the user confirmed the first material slice merged in
[PR #39](https://github.com/thetimmytook/atlas/pull/39), including JSON `data`,
`MapElement.configure`, selection-property registration and strict readers.
The user confirmed the first built-in label preparation step merged in
[PR #40](https://github.com/thetimmytook/atlas/pull/40):
types, validated text storage and immutable own material declarations.
Point-label resolution, rendering and rectangular picking are merged in PR #41
(`33a6a11`). Line/route labels and the white outline are merged in PR #42
(`bd8b508`), confirmed by the user. Polygon labels are merged in PR #43 (`69c0006`),
completing visual coverage for current object kinds. Representative measurements are
merged in PR #44; the updated platform plan is merged in PR #45. The bounded
[cross-browser functional report](../validation/CROSS_BROWSER_2026_10_20.md) is separate
from remaining full-scenario/device/keyboard-focus acceptance and focused zoom profiling. General
visual-property/behavior registration is deferred to a separate next stage. The accepted
[first-slice contract](MATERIALS_FIRST_SLICE_CONTRACT.md) and
[implementation checks](PROTOTYPE.md#first-material-slice--implemented-for-review-2026-10-12)
supersede earlier proposal-stage wording for this subset.

[Navigation and current summary](../DESIGN_MAIN.md)

Reviewed first-slice configuration, reader input and JSON-data signatures are in
the [contract](MATERIALS_FIRST_SLICE_CONTRACT.md);
the point visual step below extends that merged preparation. Behavior registration remains separate work.

### Polygon labels — implemented for review, 2026-10-19

Flat and extruded `MapPolygon` now reuse `ObjectLabels` / `ObjectLabelView`, with
one label per runtime owner/layer pair. Identity is by instance, including duplicate
IDs. Existing geometry/clipping determines appearance eligibility; the attachment
is the area centroid of all displayed XY cells. Height does not displace SVG text.
Each existing convex cell supplies its area and centroid; their area-weighted
centroid is used when it belongs to the cell union, including internal boundaries.
Otherwise the centroid of the first largest cell is used. Disconnected clipped
regions participate together; no positive displayed area means no label/hit area.
Direct layer membership retains full-geometry priority.

`src/spatial/polygon-label-position.ts` computes translated, independently scaled
XY moments and relative area weights, avoiding raw area overflow/underflow and
large-coordinate cancellation. It consumes existing `PolygonGeometry` cells;
there is no retriangulation, contour reconstruction, new runtime point/ID or source
mutation. Scene geometry dependencies recalculate only affected polygons before
picking/painting, including batch. Text/color/material-only changes do not recalculate
centroids, and geometry changes reuse unchanged text/font measurements.

Polygon placement defaults are `center center` and `(0px, 0px)` after inheritance;
font/color/container family and the white 3 CSS-pixel outline use the shared defaults.
Own declarations and immutable load snapshots remain untouched. Text is horizontal,
literal, single-line, space-preserving and screen-sized in px/rem. Undefined, empty
and whitespace-only labels have neither output nor hit area.

SVG draws text immediately after its owner's fill. Following objects/higher layers
can cover it; there is no label overlay. Whole text can extend beyond contour and
intersection bounds, while viewport clipping still applies. Picking uses the same
layout rectangle, including the outline, and returns the source polygon/hit layer,
with `route: undefined`. Initial hits and press/release revalidation share the same
entry test. Captures revalidate only the original owner/layer's current appearance,
retaining valid direct/clipped switches and suppressing stale hits without picking
underneath. Surviving polygon group, path and text nodes stay stable across those
switches. Removal/reattachment, shared maps and disconnect/reconnect reuse the existing
scene queues and lifecycle.

The CSSOM/media notification boundary below is unchanged. Text fitting, collision
avoidance, multiline, zoom visibility, 3D label depth and general visual registration
remain outside this step. See [checks and next stage](PROTOTYPE.md#polygon-labels--implemented-for-review-2026-10-19).

### Label contrast — implemented for review, 2026-10-19

At the user's request, point/line/route text has a white `#ffffff` outline, 3 CSS
pixels wide, with round joins. SVG paints the outline before the fill, retaining
thin letter strokes and the existing label color (default `#222222`). Its width
is independent of camera zoom. This is a built-in visual default, with no new
material fields or public API; own declarations and load snapshots are unchanged.
Color, width, join and paint order come from `DEFAULTS.labelOutline` in the shared
internal `src/objects/material-defaults.ts`; layout and SVG read the same defaults.
The outline decorates the existing text layout, so origin, offset and text metrics
stay unchanged. Picking expands the text rectangle by 1.5 CSS pixels on every side
to include the outline. Cached text measurements remain reusable. Empty/whitespace
labels still have no visual output or hit area.

### Line and route labels — implemented for review, 2026-10-19

This bounded step reuses `object.label` and `material.properties.label`, without
new public names or pickable properties. Lines/routes resolve the same field-based
label/font inheritance, atomic offset and internal defaults as points: `#222222`,
`1rem`, normal weight, container family, bottom-center origin and `(0px, -1rem)`.
Own declarations and immutable load snapshots receive no defaults.

Each runtime object/layer pair has one label. A line uses its displayed segment
midpoint. A route uses half the sum of displayed XY segment lengths in source
order; gaps between clipped fragments add no length. The first segment to reach
half wins, including an exact fragment end. Zero XY length uses the first displayed
position; absent geometry has no label. Empty and singleton routes remain valid.
Direct membership still uses full geometry. These calculations create no runtime
points, IDs or joining geometry and never use XYZ length, vertex averages or bounds.

Scene preparation calculates only the affected path's attachment independently of
DOM. Its last displayed fragment hosts the single label after all owner geometry
and before owned-point appearances and following objects. Grouping uses runtime
object/layer identity, retaining distinct labels for duplicate IDs. SVG transfers
a surviving text node when fragment membership changes. Labels follow owner/layer
eligibility, extend whole beyond intersection bounds and are clipped by the viewport.

`ObjectLabels` and `ObjectLabelView` replace the point-specific internal names;
they retain the existing browser metrics cache and relative origin/offset rectangles.
Geometry/topology/membership update attachment before RAF and before picking,
including batch and shared maps, without remeasuring unchanged text/font. Text and
material changes keep local invalidation. SVG and rectangular picking share the
same attachment and layout, including preserved spaces. Both SVG text paths retain
horizontal writing, start anchor and literal case. Path labels return their owner
and hit layer, with no route context; route context and effective point pickability
remain confined to owned-point appearances. Initial and captured-hit checks use the
same entry test; synchronous handlers revalidate only the original owner/layer.
Path captures use that owner's current fragments, so changing the fragment host
preserves a still-valid hit and suppresses an obsolete one without selecting another
object or layer. Point captures retain their existing entry/context checks.

The accepted CSSOM/media update boundary in the point section below is unchanged.
There is no stylesheet traversal, condition registration, interception, polling or
persistent RAF. Polygon labels, collision avoidance, zoom visibility, multiline and
general visual registration remain outside this step. See
[validation and review files](PROTOTYPE.md#line-and-route-labels--implemented-for-review-2026-10-19).

### Point labels — implemented for review, 2026-10-16

The user requested visual labels for standalone and route-owned `MapPoint`, using
the accepted public types without new exports. Material resolution merges label
fields and the individual `font.size/family/weight` fields along explicit parents;
offset remains one pair. Internal point defaults are `#222222`, `1rem`, normal
weight, bottom-center origin and `{ x: '0px', y: '-1rem' }`. An omitted family is
resolved by the browser view from its own map container. Geometry color remains
independent. Own frozen declarations, whole-value material replacement, whole-image
inheritance, validation and immutable load snapshots retain their contracts.

Each prepared point appearance draws horizontal, single-line SVG text immediately
after its symbol in the same owner group. Both displayed and measurement text
explicitly use `writing-mode: horizontal-tb`, `text-anchor: start` and
`text-transform: none`. Container CSS cannot shift the text away from origin/offset
or change the literal case independently of cached picking measurements.
`textContent` and preserved whitespace
keep HTML/Markdown literal; undefined/empty/whitespace-only values produce no text
node or label hit rectangle. Circle, image and none symbols all support labels.
All nine origins align the label's measured rectangle relative to the coordinate;
positive offsets move right/down. Font size and offset are CSS pixels after px/rem
resolution, with inverse camera scaling. Owner/layer clipping decides whether an
appearance exists; an existing label extends whole beyond layer bounds, and the
map viewport clips it. Standalone/owned and per-layer uses keep separate context.

The browser view measures an isolated hidden SVG text node, before painting if
picking needs it. A per-map/per-point measurement cache is independent of position,
pan and zoom; per-appearance layouts contain immutable numeric rectangles relative
to the point in CSS pixels. Spatial queries use those rectangles and live geometry,
following reverse composition and effective pickable, without DOM/SVG access.
The same layout drives actual SVG placement. Captured-hit revalidation checks only
the original appearance after synchronous press/release handlers, without repicking.

Text invalidation is separate from geometry/clipping and material appearance work.
Queries do not drain paint queues. Text/material/position/pickable changes are
visible to picking before RAF, including batch, shared maps and reconnect. A text
edit affects its owner's appearances; material edits use existing consumer/ancestor
invalidation. Surviving owner/text nodes remain stable; removing empty text removes
only that text node.

A hidden probe has `1rem` height and intrinsic text width in the inherited family;
ResizeObserver detects root-size and inherited typography changes that resize it.
Ancestor observation follows assigned slots and `ShadowRoot.host`, including nested
closed roots. Stylesheet mutations/load events are observed in the containing
document and shadow roots; window resize covers viewport media changes. Stylesheet
contents are not inspected: there is no CSS-rule traversal, media-query registration,
CSSOM interception or polling. `document.fonts` loadingdone/loadingerror events invalidate
font measurements; reconnect also refreshes them after an unobserved interval.
Current root size/container family are checked synchronously before queries and
painting, covering changes before observer delivery. Typography notifications may
refresh all point labels in that map; unchanged numeric fonts/text reuse metrics
on root/family changes. Font-set completion invalidates that view's font cache.
There is no periodic scene walk or per-frame text measurement. Component-owned
observers survive a scene replacement without retaining old scene subscriptions;
replacement resets scene caches, and disconnect releases observers, font/load
and resize listeners and measurement/probe nodes.

**Accepted prototype boundary (2026-10-16):** arbitrary CSSOM edits and non-viewport
media changes that alter font-family without resizing the probe or producing one
of the supported notifications need not schedule rendering while idle. A Latin
probe can stay unchanged while a Cyrillic label's actual dimensions change; probe
metrics are not a complete typography-change signal. The next ordinary render or
picking query reads current container font-family and document root font-size,
updates cached label metrics/layouts and uses the current rectangle. Picking stays
synchronous before the subsequent paint. No public refresh API is added. Automatic
refresh remains supported for root-size/probe-size changes, font completion,
stylesheet load, viewport resize, observed ancestor/container style/class changes
and reconnect; complete automatic CSSOM tracking is outside this prototype.

That point step originally left line/route/polygon text without visual output or
label picking. The line/route step above extends the shared pipeline; polygon
labels remain the next visual step.
Collision avoidance, zoom visibility, multiline, separate label objects and general
visual registration remain outside scope. See [checks and review files](PROTOTYPE.md#point-labels--implemented-for-review-2026-10-16).

### Label preparation — accepted signatures and implemented scope, 2026-10-16

After signature review, the user requested this bounded preparation step, with
typography grouped inside `label.font`. Five package-root type exports describe
the own declarations; no runtime label class is introduced:

```typescript
export type LabelLength = `${number}px` | `${number}rem`;

export type LabelOrigin =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center center'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';

export interface LabelOffset {
  readonly x: LabelLength;
  readonly y: LabelLength;
}

export interface LabelFontProperties {
  readonly size?: LabelLength;
  readonly family?: string;
  readonly weight?: 'normal' | 'bold';
}

export interface LabelProperties {
  readonly color?: string;
  readonly font?: LabelFontProperties;
  readonly origin?: LabelOrigin;
  readonly offset?: LabelOffset;
}
```

`MapObjectDefinition` adds `readonly label?: string`, inherited by all four
concrete definitions and owned points. `MapObject.label` has the accepted
`string | undefined` getter/setter. `MaterialProperties` adds
`readonly label?: LabelProperties`.

- Text is copied through construction, loading/resolved snapshots, root definition
  additions and owned-point append/insertion/replacement. Instance attachment keeps
  the same label state and identity across maps. Runtime edits do not change
  `map.definition`, which remains the immutable load snapshot.
- Strings are retained literally, including empty strings, spaces and HTML/Markdown.
  `undefined` removes text; other types and LF/CR/CRLF are rejected before mutation.
  Failures use `AtlasError`, code `INVALID_OBJECT_LABEL`, constant message
  `Object label must be a single-line string or undefined.`, with `{ field, actual }`.
  Every successful assignment, including the same value, emits the existing `change`;
  rejected assignments emit none. Owned-point changes forward through their owner
  as before. No unused visual invalidation mechanism is added.
- Lengths use decimal strings with an optional sign and fractional part, immediately
  followed by lowercase `px` or `rem`: for example `'14px'`, `'+.5rem'` or `'1.px'`.
  No outer whitespace, exponent, hexadecimal notation, unitless number or `calc()`
  is accepted. Parsed values must be finite; `font.size` must be positive, while
  offset coordinates permit negative/zero values. The template literal limits
  units but cannot express the whole grammar: TypeScript accepts examples such as
  `'1e2px'`, `'0x10px'` and `' 2px'` that runtime rejects.
- Color uses `#RRGGBB`; `font.family` is a nonempty, non-whitespace-only string
  retained without normalization; `font.weight` is `'normal'` or `'bold'`.
  Origin uses exactly the nine values above. Offset requires both x and y.
- Omitted material fields are allowed; explicit `undefined` is invalid at every
  nested level. `label: {}` and `label: { font: {} }` are preserved. Label, font
  and offset are copied and frozen. Named lookup retains only own declarations;
  whole-value `material.properties` assignment replaces those declarations,
  without adding defaults or mutating retained snapshots.
- Unknown fields, including flat `fontSize`/`fontFamily`/`fontWeight`, use
  `UNKNOWN_MATERIAL_PROPERTY`; invalid values use `INVALID_MATERIAL_PROPERTY`.
  Both use `AtlasMaterialError` with material/property/actual context and an exact
  `details.field` path such as `properties.label.font.size`. Rejected loads and
  material setters preserve the active map/value and send no successful notification.

At the merged preparation stage this step stored data only; the point visual step
above subsequently implements inheritance/defaults and browser visuals. The original boundary was:
the next visual step must resolve label fields, including individual font size,
family and weight, through the explicit parent chain. Only offset is atomic.
That step also owns agreed defaults, text measurement, browser font/rem handling,
attachment, clipping, SVG composition and label picking. Existing whole-image
inheritance, whole-value material edits, selectors and frozen id/kind/data reader
projections retain their current contracts. See
[implementation and validation](PROTOTYPE.md#label-preparation--implemented-for-review-2026-10-16).

### Label content and appearance — accepted separation, 2026-10-16

The product behavior below covers merged point visuals (PR #41), merged line/route
visuals (PR #42) and polygon visuals implemented for review. Preparation is merged
in PR #40.

- The user accepted built-in labels for this stage. General registration of new
  visual properties/behaviors is deferred to a separate next stage. This explicitly
  replaces the earlier prototype goal of demonstrating property registration
  through a label extension. Existing `MapElement.configure` selection-property
  registration remains unchanged; it does not register rendering behavior.
  Built-in label text is an object field, separate from application-owned `data`.
  Data paths such as `data.type` remain application choices connected to material
  selectors through configured readers.
- Label text belongs to the owning object's description; different objects can
  have different text while sharing one material. Text is not inherited through
  materials.
- The user accepted a single string form on the object: `label: 'North exit'`.
  This replaces the earlier object form `{ text: ... }`; no dual-form input or
  automatic conversion is introduced. The runtime text getter/setter is accepted
  below.
- Label appearance belongs to a dedicated group within the owner's selected
  material. No separate label material or independent assignment is introduced
  for this first stage. The reviewed appearance input types are recorded above.
- The user clarified that label offset also belongs to the material. The earlier
  example of an individual offset beside object label text is withdrawn; it is
  not a reason to require object-form label input.
- The user accepted `origin` and `offset` for relative label placement in the
  material. The label is a child visual element of its owner. `origin` identifies
  a point on the label's own rectangle using words such as `'bottom center'`;
  `offset` moves that point relative to the owner's attachment point. For example,
  bottom center with y offset `'-0.5rem'` places the label's bottom midpoint that
  far above the attachment point. Positive x/y offsets mean right/down.
  This supersedes the unaccepted normalized numeric `anchor` proposal. `origin`
  describes layout alignment, without adopting CSS transform-origin's rotation
  or scaling behavior. Both fields may be omitted in favor of defaults.
- The user accepted nine canonical `origin` values, vertical word first and
  horizontal word second: `'top left'`, `'top center'`, `'top right'`,
  `'center left'`, `'center center'`, `'center right'`, `'bottom left'`,
  `'bottom center'`, `'bottom right'`. The reviewed TypeScript union is above.
- The user accepted defaults for a point label: `origin: 'bottom center'` and
  `offset: { x: '0px', y: '-1rem' }`. The label's bottom midpoint sits one rem
  above the point's coordinate. The material author can override these values for
  the chosen icon. This is an offset from the coordinate, not an automatic gap
  computed from icon bounds.
- The user accepted a line label's attachment at the segment midpoint and a route
  label's attachment halfway along its projected x/y path length, independently of
  vertex count. Compute these points from the geometry displayed on each layer
  after layer clipping. A cross-floor route therefore attaches each layer's label
  to that layer's displayed path. Text stays horizontal. The user accepted the
  same placement defaults as for points: `origin: 'bottom center'` and
  `offset: { x: '0px', y: '-1rem' }`.
- The user accepted one route label per object instance per layer, even when
  clipping produces several path fragments. Sum the displayed segments' projected
  x/y lengths in route order, excluding gaps, and attach halfway along that sum.
  For a line/route whose displayed x/y length is zero, use its first displayed
  position (for example a vertical floor transition). If no displayed position
  is available, the label is absent. Existing fragment identities and independent
  route-owned point appearances are preserved; this rule does not create bridge
  geometry or a label-text array.
- The user accepted one polygon label per layer, attached to the area centroid
  of that layer's displayed x/y region after clipping. If the centroid lies outside
  the region, use the centroid of the largest existing convex cell as a simple
  prototype fallback. Defaults are `origin: 'center center'` and
  `offset: { x: '0px', y: '0px' }`. This chooses the attachment point; fitting the
  whole text within the contour is outside this first stage.
  The user asked whether this covers planes or extrusions: both use the existing
  `MapPolygon`. Under the current SVG projection, height/layer intersections
  determine which appearances exist, and label attachment uses each appearance's
  displayed x/y region. This does not establish label depth for a future 3D view.
- The user confirmed that per-layer labels are visual appearances of the same
  owner string, not an array of label texts. An object still declares one
  `label: string`; each layer displaying it places its own appearance with that
  text. Hiding the layer hides its geometry and label together. No per-layer text
  assignment or independent label map objects are introduced.
- The user accepted label clipping/visibility tied to the owner's appearance:
  when clipping leaves no owner appearance, its label is absent too. Otherwise,
  draw the whole label at its calculated attachment/offset, even where the text
  extends beyond the layer's x/y `intersectionBounds`. The map viewport clips
  label output normally. Layer bounds do not cut individual letters or fit text
  to the owner contour.
- The user accepted rectangular label picking, including gaps between letters
  and words. A hit produces the owner's ordinary `objectclick`, with the runtime
  layer of that appearance and the owning route retained for a route-owned point.
  Point labels follow the point's effective `pickable` in that appearance's role,
  including standalone/route-owned defaults. With `pickable: false`, the text
  remains visible but cannot select the point. Visible label output beyond layer
  `intersectionBounds` is also pickable. No separate label-click event is added.
- The user accepted keeping each label in its owner's visual group, directly
  above that owner's geometry. Within a layer, composition remains geometry A,
  label A, geometry B, label B; a later object can cover an earlier label. Higher
  layers cover lower-layer geometry and labels. Picking traverses the actual
  drawing order in reverse while respecting eligibility, keeping visual overlap
  and hit selection consistent.
- The user accepted `px` and `rem` for font size and label offset. Their displayed
  size is independent of map-camera zoom; `rem` follows the document root font
  size, so changing that font size updates rem-based label dimensions. Maintaining
  independence from SVG camera transforms is the renderer's responsibility.
  The user accepted string inputs with explicit units, for example `'1rem'`,
  `'14px'` and `'-1rem'`. Font size must be positive; offsets may be negative or
  zero. Unitless numeric inputs are not part of this first-stage contract. Exact
  TypeScript types are reviewed above; visual resolution/update remains a next step.
- The user clarified semantic grouping of typography inside the material's label
  group: use `label.font.size`, `label.font.family` and `label.font.weight`.
  This supersedes the earlier flat `fontSize`/`fontFamily`/`fontWeight` proposal.
  Defaults are unchanged: size `'1rem'`, family inherited from the map container,
  weight `'normal'` with `'normal'`/`'bold'` allowed. Label `color` remains a
  separate field with default `'#222222'`, independent of the owner's geometry
  color. The reviewed nested TypeScript declarations above reflect this grouping.
- The user accepted inheritance of label appearance per field through the
  selected material's explicit parent chain, followed by the agreed defaults.
  For example, a child overriding label color retains a font size declared by
  its parent. The nested font group also inherits per leaf field (size, family,
  weight), rather than being replaced as an atomic font value. `offset` is one
  atomic x/y pair, replaced or inherited as a whole.
  The container font-family fallback applies when the material chain supplies
  no font family. This label-specific resolution preserves whole-value
  `Material.properties` assignment and the existing image inheritance contract.
- The user agreed to single-line plain text for the first stage: HTML/Markdown
  are literal content, spaces are preserved and automatic wrapping is absent.
  Empty or space-only strings are retained unchanged but have no visual output
  or picking area. The user accepted rejecting explicit line breaks and clarified
  that validation must cover carriage returns too: reject `\n` (LF), `\r` (CR)
  and therefore the `\r\n` (CRLF) sequence. For example, both `'North\nexit'`
  and `'North\rexit'` are invalid. Validation precedes mutation, preserving the
  previous text and appearances on failure. Multiline text is outside this stage.
- An omitted label means no label. A material does not create one. An explicitly
  present label works without an explicitly assigned material, using standard
  appearance defaults where needed.
- The user accepted a common runtime property on `MapObject`:

  ```typescript
  get label(): string | undefined;
  set label(value: string | undefined);
  ```

  A string sets/replaces the text; `undefined` removes it. An empty string is
  retained as `''`, with no visual appearance or picking area. Other types are
  rejected without conversion. Changes update every appearance, including other
  maps sharing the object. Picking observes the new state immediately in batch;
  rendering remains deferred. No separate public runtime label object is needed:
  text is accessed through `object.label`, appearance through its material.

- After accepting this behavior, the user reviewed the concrete types and requested
  only the preparation implementation documented above. Visual work remains separate.

The input-form question is resolved: after assigning offset to the material, no
additional per-object label fields were established, so the user chose a string.
The product behavior is accepted; the preparation signatures and implementation
scope above supersede the earlier pending-mini-review status.

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
- Labels follow the general map-definition/runtime-object separation. The earlier
  runtime-label-object direction is superseded for this first stage by the accepted
  string property on the owning `MapObject`; there is no separate public label
  handle.
- Label text in JSON uses the single string form `label: 'Exit'`, accepted in the
  [current label clarification](#label-content-and-appearance--accepted-separation-2026-10-16).
  This supersedes the earlier `{ text: 'Exit' }` decision. Placement and appearance
  belong to the material discussion; remaining fields and concrete material/input
  types remain open. The runtime text getter/setter is accepted above.
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
- General visual-property/behavior registration remains a future proof-of-concept
  direction, deferred from the current built-in label stage by the accepted scope
  clarification above.
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

- The earlier agreement to demonstrate property registration using label is
  superseded by the 2026-10-16 scope clarification above: this stage implements
  built-in labels, while general visual-property/behavior registration follows
  separately. This design discussion does not authorize implementation.
- The user wants detailed validator diagnostics during development, less detail
  at runtime, and an option to disable validation. Which checks are optional must
  still be reconciled with strict loading and operation guarantees. The assistant's
  proposal to disable only additional extension checks while retaining mandatory
  correctness checks was not separately confirmed.
- Analysis of the earlier custom appearance-system sketch is stored separately:
  [MATERIAL_SYSTEM_EXPLORATION.md](../MATERIAL_SYSTEM_EXPLORATION.md).
  At the user's request, a full standalone style/material system is marked as
  a very distant future direction, outside the first Atlas version.
