# Runtime And Loading

Current baseline: [Current contract](CURRENT_CONTRACT.md). Layers/intersections,
polygons, root collection operations and route editing are merged. Notifications
remain provisional. Batch, schemaVersion, resources and live export below are
future design, not available APIs; pending runtime fixes are recorded separately.

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

<a id="layered-map-input--accepted-2026-10-08-first-stage-implemented-for-review"></a>

## Layered map input — merged in PRs #28–29

The accepted [map structure](LAYERS_AND_INTERACTION.md#accepted-map-structure--2026-10-08)
keeps object definitions in `MapDefinition.objects` and introduces
`MapDefinition.layers`. A layer's `objects` is a list of object-ID references for
direct full appearances; `background` belongs to that layer. Optional
`intersectionBounds` lets the engine compute clipped appearances from common map
geometry without another intersecting-object input list.
Omitting `intersectionBounds` disables automatic intersection discovery and partial
clipping; the layer's direct object appearances and background still work independently.

An omitted `layer.objects` means an empty direct content list. Runtime layers start
visible. An unknown object-ID reference rejects loading and preserves the active
map under atomic replacement. A reference matching several root objects selects
all matching runtime instances; `map.objects.get(id)` retains its existing first-match
behavior. See the [accepted defaults](LAYERS_AND_INTERACTION.md#accepted-map-structure--2026-10-08).

The [implemented first-stage contract](LAYERS_AND_INTERACTION.md#explicit-layers--accepted-and-implemented-for-review-2026-10-08)
requires `layers` and rejects top-level backgrounds; no default layer is created.
`intersectionBounds` is now supported by the automatic stage merged in PR #29;
see [the current bounds contract](LAYERS_AND_INTERACTION.md#intersection-bounds-contract--accepted-and-implemented-for-review-2026-10-08).
Serialized visibility and adding/removing/reordering runtime layers remain outside
this stage.

Validation, ID completion, root-reference validation and copying of every object,
layer, reference list and background happen before asynchronous preparation. All
layer backgrounds and SVG groups are prepared off-screen before active replacement.
Any background failure preserves the old definition, roots/layers, camera, SVG and
picking; failed candidates never start model observation. Overlap rejection is unchanged.

`map.definition` contains resolved layer IDs, default stack indices and frozen copied
reference lists. It remains the load snapshot, unchanged by runtime visibility,
reference, root and coordinate edits. Shared objects retain one runtime instance
and shared geometry views across layer appearances.

`map.fit()` fits all layer background extents, including hidden layers. Current
backgrounds start at `(0, 0)`, so the union uses maximum width and height. Without a
background it does nothing; a background-free load preserves the camera. Applications
can call `camera.fit(rect)` explicitly. Visibility changes never fit or reset it.

Runtime root removal excludes that instance from every layer without deleting ID
references. Detached objects remain editable. Reattachment or a new instance with
the same ID automatically resumes membership in corresponding layers, using current
state and root order. New unmatched IDs need explicit selection:
`const point = map.objects.add(definition); layer.objectIds.add(point.id)`.

<a id="height-and-automatic-display-updates--implemented-for-review-2026-10-08"></a>

## Height and automatic display updates — merged in PR #29

The 2026-10-09 coordinate migration makes runtime point positions `Point3` while
position definitions/setters accept `Point2 | Point3`, including plain x/y input.
All point input boundaries validate supplied finite z and copy coordinates into
a new `Point3`, using its default z = 0 for omitted height. Assignment replaces
the full position; it never preserves an old z implicitly. This covers load resolution, constructors, root additions,
route add/insert/replace and runtime position assignment. Mutation and invalidation
precede notifications. Invalid coordinates or bounds preserve prior working state;
loaded bounds are copied/frozen deeply before asynchronous preparation, and the
load snapshot does not follow runtime edits.

A position edit requires no layer argument. It invalidates direct displays and the
automatic preparations of its dependent roots in every layer, including candidates
whose current display is empty. Owned point height changes affect their line/route.
The next scene read prepares current cuts before picking, independently of connected
view observation. Spatial reads retain pending renderer changes. Hidden edits and
disconnected edits are displayed after show/reconnect; visibility itself preserves
prepared geometry, background and camera.

Removal releases candidate tracking on reconciliation. Reattachment prepares current
geometry and queues it again even after remove → synchronous query → detached edit
→ reattach before RAF; surviving cached scene entries and SVG nodes can be reused.
Root/layer-ID/route membership changes reconcile composition; no runtime bounds
setter, generic storage, live serialization or new public event schema is added.

## Shared generic collection storage — deferred exploration, 2026-10-08

The user requested recording a possible shared generic collection for future work.
Only the ID-collection rename to `MapLayerObjectIdCollection` is authorized now;
generic storage is not implemented, and its API and representation are not approved.

The two concrete consumers are `MapObjectCollection` and
`MapLayerObjectIdCollection`. A possible approach is composition with a small
internal `Collection<T>` for unique membership, insertion order, size and iteration.
That name and API are illustrative. Runtime objects compare by instance identity;
IDs compare by string value, so distinct roots with the same ID remain distinct.

Domain wrappers would keep definition validation/copying and object construction,
ID validation, `get(id)`, return types, scene invalidation and notifications.
In particular, root `add` returns its runtime instance while ID `add` returns a
boolean; a shared container must not force those public contracts to become alike.
The generic container should not depend on renderers or scene tracking.

Any later refactor must preserve retained root iterator snapshots, stable public
collection identity, no-op behavior and mutation-before-notification ordering.
The current ID iterator is live and follows `Set` insertion order; unifying that
behavior with root snapshots would require a separate contract decision. Keep fast
ID membership checks during root filtering rather than introducing a linear search
for every root. Performance effects require measurements. Prefer a bounded storage
refactor only if it simplifies both consumers; do not add configurable equality,
storage policies or a general collection framework for speculative uses.

## Route model clarification — 2026-10-05

The [polyline decision](GEOMETRY_AND_ROUTES.md#route-polylines-and-point-identity--accepted-2026-10-05)
supersedes the route-line collection and endpoint synchronization examples below.
Route definitions and runtime routes store ordered, identifiable `points` directly.
Line definitions use the same model with exactly
two points. Every point groups coordinates under `position`. Adjacent pairs
implicitly define segments, so disconnected-line insertion and endpoint snapping
no longer apply. Point/path editing will be reviewed against this model; earlier
`addLine`, line removal/replacement, and line-based notification signatures are
historical, not implemented contracts.

The current `route.points` array is read-only, but each owned `MapPoint` accepts
position updates through `point.position = new Point3(x, y)`. `MapRoute` forwards
the point's `change` event without rebuilding geometry. ID lookup in `map.objects`
still returns the route instance; owned points are available through that route.
Independent points and line endpoints use the same `MapPoint` class, and `MapLine`
forwards endpoint changes in the same way. Runtime objects expose no `geometry`
property. The spatial subsystem creates stable views that read their current
positions. See the [position and geometry boundary](GEOMETRY_AND_ROUTES.md#object-positions-and-internal-geometry-views--accepted-2026-10-05).

`map.definition` returns `ResolvedMapDefinition | undefined`, preserving required
IDs on objects and owned points after a successful load. It remains the immutable
resolved load input; runtime position edits do not change this snapshot.
`load` continues to accept `MapDefinition` with optional IDs.

## Map definition reuse — accepted 2026-10-06

One `MapDefinition` may be reused to initialize multiple map instances; it is not
bound to a single `MapElement`. The user explicitly confirmed this reuse rule.
The current ID handling decision below applies independently of definition reuse.
The current prototype copies input into independent runtime objects on each load.
Sharing one runtime map between multiple views remains a separate design question.

<a id="internal-model-observation-and-loading--accepted-2026-10-06-implemented-for-review"></a>

## Internal model observation and loading — merged in PR #23

The [scene-ownership substep](RENDERER_AND_COMPONENT.md#internal-scene-model--accepted-2026-10-06-implemented-for-review)
moves the immutable resolved load snapshot, root collection, geometry, spatial
queries, and scene subscriptions into internal `MapModel`. The existing collection
and runtime-object APIs, instance sharing and duplicate-ID semantics are unchanged.
The component still validates/copies load input before candidate construction;
constructor signatures and validation boundaries are unchanged.

Observation is controlled internally by the connected view, using existing
`EventTarget` mechanisms. Stopping it releases listeners from the collection and
all actually observed roots, without disposing runtime objects. Restarting observes
current membership without duplicate notifications. Queries continue to read current
objects and route points even during stopped observation; reconnect requests display
synchronization. The original ownership step did not add dirty tracking; later
[explicit invalidation](#mutation-invalidation--implemented-for-review-2026-10-07)
is merged in PR #27. Its internal scene-change queue has one renderer consumer.

A candidate has no scene subscriptions during renderer/image preparation. The old
map remains active; failure preserves its objects, definition, camera, display and
picking. Success swaps the prepared display and model, releases old observation,
cancels a pending click and fits the new background. Overlapping loads still reject
with `MAP_LOAD_IN_PROGRESS`. Old retained objects/collections remain functional
without retaining the model through forgotten change listeners.

The model is not exported from the package root. Public model lifecycle, a core
entry point, live serialization and a new loader framework remain unimplemented.

<a id="route-append--accepted-2026-10-05-implemented-for-review"></a>

## Route append — merged in PR #14

Merged in PR #14 on 2026-10-06 with the simplified ID handling decision below.

`MapRoute.addPoint(definition: MapPointDefinition): MapPoint` adds one point to the
end of a route and returns its new runtime instance. In an empty route,
this creates the first point; subsequent points create connecting segments through
the existing ordered-point model. The insertion/removal and range replacement steps
below extend this contract.

The operation validates and copies input and generates an omitted ID. Explicit
duplicate IDs are accepted under the ID handling decision below. Invalid input preserves state and emits
no change event. A successful append preserves existing point instances and IDs,
emits `change`, and updates rendering and spatial picking. `map.definition` remains
the resolved load snapshot.

Each successful append replaces `route.points` with a new frozen readonly array.
Previously retained arrays preserve their membership; their existing `MapPoint`
instances remain live and editable. Position changes and repeated reads do not
replace the array. The input must explicitly declare `kind: 'point'`, just as in
map loading. Standalone and loaded routes use the same creation rules, with no
occupied-ID registry or owner-specific creation callback.

When `change` fires, the point belongs to the route and spatial queries already
see the new vertex and segment. Rendering remains deferred to the next scheduled
frame. Internal geometry and scene-entry arrays update lazily after membership
changes; existing views and SVG nodes are retained. Reconnecting observes points
appended while the component was detached. The Factory example includes an append
button for manual review.

`addLine` is removed from route plans: consecutive points already define each
segment. Historical line-based examples below are superseded and do not authorize
an `addLine` implementation. Independent `MapLine` objects remain supported.

<a id="route-point-insertion-and-removal--accepted-2026-10-06-implemented-for-review"></a>

## Route point insertion and removal — merged in PR #19

Merged in PR #19 on 2026-10-06.

The user approved point removal and the next insertion step together.
`MapRoute.insertPoint(index: number, definition: MapPointDefinition): MapPoint`
inserts a newly validated, copied point before the given index. Valid indices are
integers from `0` through `route.points.length`, inclusive: zero prepends, and the
length appends. An empty route accepts only zero. Invalid indices throw `AtlasError`
with `INVALID_ROUTE_POINT_INDEX` and the index/bounds in `details`. Invalid indices
or definitions preserve membership and emit no change. Missing IDs are generated;
explicit duplicate IDs remain accepted. `addPoint` uses insertion at the end.

`MapRoute.removePoint(point: MapPoint): boolean` removes the exact owned instance,
returning `true` when it was present and `false` otherwise. Equal IDs do not select
another point. Removing an interior point connects its former neighbors directly;
removing an endpoint shortens the path. Removing the last point leaves an empty
route. The removed point remains functional, but the route releases its change
subscription. If that point is also attached as a map root, its root appearance
and map subscription remain active. Shared routes update independently in each map.

Each successful operation replaces the frozen readonly point array and emits one
`change` after membership and subscriptions are updated. Surviving point instances
and IDs remain stable. Retained arrays preserve their old membership and live
references; `map.definition` remains the resolved load snapshot. An absent-point
removal preserves the array and emits no event.

Internal polyline arrays now follow current point order after membership changes,
reusing weakly cached coordinate views for surviving points. Scene entries and SVG
nodes are reused; inserted symbols occupy their route's composition position, and
removed symbols disappear. Spatial queries observe the new path immediately,
including inside change handlers and before rendering. A point removed in a surface
handler cannot produce an object click through its former route. Disconnected maps
observe current membership on reconnect. Range replacement is described below.

The Factory example inserts between the first two vertices and removes the most
recent inserted point through retained instance identity.

<a id="route-point-range-replacement--accepted-2026-10-06-implemented-for-review"></a>

## Route point range replacement — merged in PR #20

`MapRoute.replacePoints` has this contract:

```ts
replacePoints(
  startIndex: number,
  endIndex: number,
  definitions: readonly MapPointDefinition[],
): readonly MapPoint[];
```

It replaces the half-open range `[startIndex, endIndex)` and returns a frozen array
of the new runtime points in
insertion order. Both indices must be integers satisfying
`0 <= startIndex <= endIndex <= route.points.length`. Negative indices, rounding,
and clamping are unsupported. Invalid bounds throw `AtlasError` with
`INVALID_ROUTE_POINT_RANGE` and the indices/bounds in `details`.

An empty range inserts before `startIndex`; the array length inserts at the end.
An empty replacement list deletes the selected range. Selecting
`[0, route.points.length)` replaces the whole route, or clears it with an empty
list. An empty range with an empty list returns a frozen empty array, retains the
current `route.points` array, and emits no event. An empty route accepts only
`[0, 0)`.

All definitions are validated and copied, and all new points are created before
route membership or subscriptions change. Invalid input or failed preparation
preserves the point array, membership, and subscriptions and emits no `change`.
Input must be an array of explicit `kind: 'point'` definitions with valid positions
and optional IDs. Missing IDs are generated; explicit duplicate IDs remain accepted.

Every selected point is removed, and every new definition creates a new `MapPoint`,
even when its ID or coordinates match a selected point. Points before `startIndex`
and from `endIndex` onward retain their exact instances and IDs. There is no
endpoint-matching or snapping requirement: connectivity follows the resulting
ordered points. The route releases removed-point subscriptions; retained external
references stay editable and emit their own events. A removed point also attached
as a map root keeps that root appearance and subscription.

A successful change replaces the frozen readonly point array and emits exactly
one `change` after membership and subscriptions are updated. Previously retained
arrays keep their old membership and live point references. `map.definition`
remains the immutable resolved load snapshot. Geometry and picking see the new
order immediately, including inside change handlers. SVG updates on the next
scheduled frame, retaining surviving scene entries, coordinate views, and nodes.
Same-length replacement is detected by array identity, including after reconnect.
Meaningful event payloads and `map.batch` remain separate steps.

The Factory example replaces the whole route interior with two new vertices in one
operation while preserving both endpoint instances and IDs.

<a id="id-handling--accepted-2026-10-06-implemented-for-review"></a>

## ID handling — merged in PR #14

Merged in PR #14 on 2026-10-06. The earlier uniqueness experiments remain historical.

Atlas generates an omitted ID through `createId()` using `crypto.randomUUID()`.
Explicit IDs remain non-empty opaque strings and are preserved as supplied.
IDs remain stable for the lifetime of each runtime object. Atlas does not reserve
IDs, search for collisions, or reject duplicates during loading or mutations.
Application code and the editor decide whether uniqueness matters for their task
and how to enforce it. A reusable definition carries no runtime ID registry.

`MapObjectCollection` retains every root object in input order, including objects
with the same ID. Its size counts all objects, and iteration yields all of them.
`get(id)` returns the first matching root object in that order, or `undefined`.
Owned points remain accessible through their line or route. Rendering and picking
use runtime object identity rather than requiring unique ID strings; the component
checks whether the loaded collection is still current before dispatching a click.

`MapPoint` constructors and line/route point definitions accept optional IDs again.
`MapRoute.addPoint` simply creates a `MapPoint`, appends it, and emits `change`.
The registry, constructor injection, decorator, and scoped factory experiments
below are superseded and removed from the implementation.

An opt-in debug method to find duplicate IDs is a possible later diagnostic,
not an implemented or agreed public API. Its result format and placement remain
open; it would report duplicates without making ordinary loading or edits fail.

<a id="runtime-object-addition--accepted-2026-10-06-implemented-for-review"></a>

## Runtime object addition — merged in PRs #15 and #30

Merged in PR #15 on 2026-10-06.

`map.objects.add(definition)` accepts `MapPointDefinition`, `MapLineDefinition`,
`MapRouteDefinition` or `MapPolygonDefinition`, appends a new root object, and returns
its concrete runtime instance. TypeScript overloads preserve the point/line/route/polygon return type; a union
definition returns `MapEntry`. Validation, copying, and ID generation use the same
resolver as loading. Invalid input changes no membership and emits no notification.
Explicit duplicate IDs remain accepted. `get(id)` still returns the first matching
root, size counts every root, and iteration follows collection order.

The operation creates the complete object before changing membership. A retained
iterator keeps its original membership; a new iterator includes additions.
The object and owned points are copies of the input. Mutation of the original
definition does not update the map. `map.definition` remains the resolved load
snapshot and does not gain dynamically added objects.

Selected new roots render above earlier roots within each layer; unselected roots
require direct ID membership or eligible automatic bounds. Layer order takes priority;
route vertices follow their path within that root's position. Picking reads the
updated scene immediately, including from an addition handler, while SVG updates
on the next frame. Existing scene entries, geometry views, and SVG nodes are reused.
Added points, line endpoints, and route points propagate later changes in the same
way as loaded objects; added routes also support `addPoint`.

The component subscribes to additions and new object changes while connected.
Reconnect observes additions made while disconnected. Successful loading replaces
the collection; retained old collections and objects stay usable independently,
and their additions/edits do not update the replacement map.

Prototype notification: the collection extends `EventTarget` and emits a synchronous
`CustomEvent<MapEntry>('add', { detail: object })` after membership is committed.
The component uses it to observe the new instance and schedule rendering. This is
a provisional membership notification, not the settled collection/change-event
contract; replace it when that contract is agreed. The original addition step had
no removal/replacement and detected growing collection size. The removal step below
also compares root identities so equal-size membership changes are detected.

The Factory example includes Add point and Move added point controls.

<a id="runtime-object-removal--accepted-2026-10-06-implemented-for-review"></a>

## Runtime object removal — merged in PR #16

Merged in PR #16 on 2026-10-06.

`map.objects.remove(object: MapEntry): boolean` detaches the exact root runtime
instance. It returns `true` after successful removal and `false` when that instance
is absent. ID equality does not select another object: duplicate IDs remain accepted,
and removing the first matching root makes `get(id)` return the next one, if any.
An instance absent from this root collection returns `false`, including owned
line/route points that have not also been attached as roots here.
Removing a route removes its path and vertex symbols from the map while preserving
the route's owned points and behavior. Editing route membership remains separate.

Removal replaces the frozen root array. New iteration and size reflect the change;
a retained iterator keeps its original membership and live object references.
`map.definition` remains the immutable resolved load snapshot. The detached object
keeps its ID, setters, events, and owned-point behavior. It has no public `dispose`.
`add(definition)` still creates a copy. The instance-attachment step below adds a
separate overload that retains an existing runtime instance.

Prototype notification: after membership is committed, the collection synchronously
emits `CustomEvent<MapEntry>('remove', { detail: object })`. An absent-instance removal
changes no membership and emits no event. As with `add`, this notification is
provisional until the collection/change-event contract is agreed. The component
removes its change listener from the detached root and schedules rendering; later
changes to that root do not request map renders. Internal owner-to-point subscriptions
remain part of the retained object's behavior.

Picking sees current membership immediately, including inside a removal handler.
A surface handler may remove a hit root; the component then suppresses the stale
object click, also for a route-owned point. Removing and adding before a scene read
is detected even when root count is unchanged. Scene descriptions compare ordered
root instances; weak caches preserve live entries without retaining removed roots.
The next SVG synchronization removes retired nodes and releases old scene entries,
including with a zero-sized viewport; surviving nodes and the background are reused.
While disconnected, rendering stays paused; reconnect synchronizes current membership.
Successful loading replaces the collection and removes the old map subscriptions.

The Factory example includes a Remove added point control.

<a id="runtime-instance-attachment--accepted-2026-10-06-implemented-for-review"></a>

## Runtime instance attachment — merged in PRs #17 and #30

Merged in PR #17 on 2026-10-06.

`map.objects.add(instance)` accepts an existing `MapPoint`, `MapLine`, `MapRoute`, or `MapPolygon`
and returns that exact reference. A generic overload preserves the instance's
concrete type, including a subclass. The root's ID, current position, owned-point
instances, point order, and behavior are retained; attachment does not copy or
generate IDs. Input recognized as an instance of these runtime classes uses this
path; serializable definitions continue through the validated-copy path.

If that instance is already a root in the same collection, `add` returns it without
changing membership, composition order, or emitting `add`. Other instances with
the same ID remain distinct roots. New attachments append in root order and emit
the existing provisional addition notification after membership is committed.
Retained iterators keep their original membership. `map.definition` remains the
resolved load snapshot.

A removed root can be edited and reattached; rendering and picking use its current
state, including points appended to a detached route. The component resumes its
change subscription. Removal listeners may reattach the same instance synchronously;
the component checks current membership before removing its change subscription.
No-op additions do not request rendering or duplicate subscriptions.

One runtime instance may be present in several maps. Each map keeps its own
collection, scene entries, rendering, and subscriptions. Removing it from one
map leaves the other maps' membership and subscriptions active. This step supports
the current point/line/route/polygon changes; it adds no global ownership mechanism.

A route-owned point may also be attached as a root. Scene entries are cached per
owner and object, so the two appearances keep distinct SVG nodes and click context:
the root appearance has no route context, and the vertex appearance names its route.
Removing one root appearance preserves the other active appearances. Editing the
shared point updates its active root and owner displays. Owned-point membership
remains controlled by the owning line or route; root removal does not edit it.

The Factory example keeps Move added point available after removal and includes
Restore added point, demonstrating editing and reattaching the same reference.

<a id="browser-lifecycle-regression-coverage--implemented-for-review-2026-10-06"></a>

## Browser lifecycle regression coverage — merged in PR #24

Focused real-browser tests complement the existing model/spatial tests. Runtime
edits, route membership changes (including equal-length replacement), root
removal/replacement with duplicate IDs, and shared root/route point appearances
are checked against actual SVG coordinates and surviving nodes. Provider pointer
tasks verify current picking before the next RAF.

Component tests also protect edits while detached, repeated reconnect without
duplicated clicks, stale-click suppression after synchronous removal/disconnect,
and shared instances across two components. Real resource and decoding failures
preserve the previous definition, collection, camera, SVG nodes, and picking; a
later successful load retires the old scene and its retained objects remain
independent. See [browser coverage](RENDERER_AND_COMPONENT.md#browser-svg-regression-coverage--implemented-for-review-2026-10-06)
and [test commands](../TOOLING.md#regression-tests).

The suite also passed against the `MapModel` ownership extraction merged in PR #23
on 2026-10-07. That browser-test stage protected behavior without implementing
dirty tracking, revisions, batch, new event payloads or the then-planned
invalidation step. The subsequent invalidation stage is described below.

<a id="mutation-invalidation--implemented-for-review-2026-10-07"></a>

## Mutation invalidation — merged in PR #27

In the merged baseline, root add/remove and route membership/order operations mark
internal scene membership. The accepted route-local membership correction remains
under review; it is not part of this documented baseline.
Point coordinate setters mark their dependent display entries before existing events
are dispatched. These marks persist independently of connected view subscriptions.
Unchanged scene reads no longer scan root or route membership. Current picking still
reads live coordinates and synchronizes explicitly invalidated membership immediately,
including earlier synchronous handlers and disconnected queries. Separate maps and
root/owned appearances retain independent entries keyed by identity.
Reattachment marks newly tracked sources for geometry refresh, including when an
intervening synchronous query detached them before RAF while their SVG nodes survived.
Detached-source tracking is still released; current state refreshes on reattachment.

Public notifications, definition snapshots, validation atomicity, sharing, and
remove/reattach behavior are preserved. This step adds no public event payload,
batch, ownership restriction, or load operation. See the
[chosen internal mechanism](RENDERER_AND_COMPONENT.md#explicit-scene-invalidation--implemented-for-review-2026-10-07)
and [before/after results](../performance/INVALIDATION.md).

## Object ID registry — superseded experiment, 2026-10-06

Historical review variants below are superseded by the ID handling decision above.
They describe the explored implementation, not current runtime requirements.

`ObjectIdRegistry` owns occupied IDs, duplicate rejection, and collision-safe
generation within one map. IDs may repeat in separate maps or replacement loads.
Definition resolution uses a temporary registry: all explicit IDs are reserved
before missing IDs are resolved. The runtime factory uses its own registry seeded
with every resolved root and owned-point ID from the loaded map. A new point's ID
is validated and occupied through `create(field, id)` before runtime construction.
The registry is now internal, rather than a dependency supplied by library callers.

### Factory creation — superseded trial, 2026-10-06

This factory-only trial was paused. The user clarified that the expected result
retains an annotation for automatic dependency injection, and requested agreement
on definition reuse and ID scope before further implementation. The code below
describes the earlier trial, not an accepted replacement architecture.

The user clarified that the intended improvement was to remove explicit registry
passing, then requested a concrete factory variant. `MapObjectCollection` creates
one internal `MapObjectFactory` for each load. That factory reserves the resolved
map IDs, constructs runtime objects, and binds its point-creation callback to every
loaded route. Runtime objects have no `idRegistry` field or constructor parameter.
The collection remains read-only with `size`, `get(id)`, and iteration.

`route.addPoint(definition)` calls the bound factory, which validates the optional-ID
input, assigns an available ID, and constructs a `MapPoint`. The route then commits
membership and emits `change` as before. Rejected input does not occupy an ID, and
rejected appends preserve membership and emit no change event. The factory retains
only the shared ID namespace; existing rendering, picking, and snapshot behavior
are unchanged. Lookup in `map.objects` still indexes only root objects.

A standalone route lazily creates a local point factory seeded with its own ID and
initial point IDs. It has the same append rules in an independent namespace.
`bindPointFactory` is an internal symbol used only by the map factory to connect
that callback; the symbol is not exported from the library entry point. It is a
construction hook for this review variant, not a public map-attachment API or an
exclusive-ownership check. There is no ambient current-map state, global registry,
DI container, annotation framework, or mutable object-to-map lookup table.

The provisional constructor boundary is now explicit: `MapPoint` takes
`WithId<MapPointDefinition>`, while `MapLine(id, points)` and `MapRoute(id, points)`
take point definitions with required IDs. Constructors validate and copy these
already identified inputs. For example, `new MapRoute('route', [])` still works,
and its `addPoint` accepts an omitted ID. Direct construction with missing point
IDs now rejects instead of generating them. Input JSON, `map.load`, and
`route.addPoint` continue to accept optional IDs. This narrower constructor
contract is part of the trial; keep it only if factory creation is adopted,
otherwise restore the earlier constructor-based resolution contract.
`MapObjectFactory`, point-factory helpers, and `ObjectIdRegistry` are internal and
are not additional application-facing creation APIs. A public root-object add API
remains a separate step.

### Constructor injection — superseded review variant

The earlier implementation passed one `ObjectIdRegistry` through the constructors
as `idRegistry` and retained it in `MapObject`. Standalone object trees received a
local registry by default, and the registry class was exported for explicitly
shared namespaces. Owners created points with explicit IDs first so generated IDs
could not take later explicit IDs. This replaced the earlier route-specific
`WeakMap` and `bindRouteIds`, but still required dependency threading. The factory
trial above replaces those constructor arguments and the public registry export.

### Unique ID decorator — superseded review variant, 2026-10-06

The `@uniqueId(object => object.idRegistry)` method-decorator trial reserved an ID
before `MapObject.#resolveId` resolved or generated it. It inherited the same map
scope, but continued to require constructor injection. The user expected removal
of explicit registry passing, which this wrapper did not provide. The factory
trial removes the decorator, its private resolver method, and the extra Vite
TypeScript pre-transform that was needed to execute modern decorator syntax.

## Updates and runtime objects — discussion ongoing

Mixed decision history: plain `change` and provisional root `add`/`remove`
notifications are implemented; property/previous/new payloads, batch, schemaVersion
and resource loading beyond image backgrounds are accepted future design. Live
export and unfinished operation signatures remain open. See the
[current notification limits](CURRENT_CONTRACT.md#temporary-implemented-contracts).

The runtime collection is named `MapObjectCollection` and lives alongside map
objects in `src/objects/map-object-collection.ts`. The public property remains
`map.objects`, with `size`, `get(id)`, `add(input)`, `remove(object)`, and iteration. A separate `collections/`
directory is unnecessary for this domain-specific collection; introduce shared
collection infrastructure only when concrete consumers need it.

- Storing and restoring user state is the application's responsibility (Redux,
  MobX, etc.). Atlas introduces no session-snapshot system. It provides current
  values, change events, and control APIs.
- Accepted future runtime object change notification contents (not implemented): object, changed property,
  previous value, and new value. Subscriptions may target one object or changes
  across the map, without a Redux/MobX dependency. The exact event API remains open.
- Exporting a serializable map description remains a separate task. Its exact
  contents and the boundary between persisted parameters and temporary changes
  are not yet agreed; the proposed export contents should not be treated as approved.

- Initial map loading is strictly validated: invalid data rejects the entire load.
  No partial/lenient mode is introduced.
- Accepted future Map JSON includes schemaVersion (for example, 1), identifying
  the format independently of the library version. This field/check is not implemented. Unsupported versions cause
  a clear error. Separate adapters may transform old formats in future;
  automatic built-in migrations have not been approved.
- Failure to load a required resource (background, icon, etc.) also fails map loading.
  Diagnostics identify the resource and known failure reason; successful loading
  with a silently omitted resource is not allowed.
- While a new map is validated and its resources load, the current map remains usable.
  Replacement occurs only after successful preparation. On failure, the current map
  remains and the application receives a loading error.
- Loading errors must explain what failed validation and why. Agreed contents:
  error code, object ID when available, path to the problematic field, and reason;
  expected and received values where applicable. The exact diagnostic structure
  and strategy for collecting multiple errors remain open.

- Following the user's clarification, registering one runtime instance in multiple
  maps is not prohibited, and no special ownership check is introduced to enforce
  such a prohibition. Reuse across maps remains the developer's responsibility.
  This cancels the discussed one-instance/one-map rule and OBJECT_ALREADY_ATTACHED
  error. The decision does not promise complete synchronization between maps;
  necessary internal runtime links will be determined during implementation.

- Failed operations, such as invalid point coordinates or empty explicit IDs, throw
  an exception with a clear code and description. The calling application may use
  try/catch; logging does not replace an exception.
- An operation rejected by validation does not change object state. This guarantee
  applies to an individual operation, not to batch as a transaction; earlier
  successful batch changes remain in the accepted future batch design. `AtlasError`
  is implemented with codes/details/cause; the complete future code list is undefined.

- Removing an independent object from a map detaches it and removes its display,
  but a retained reference remains a functional runtime instance: it can be modified
  and added back. Detachment is not destruction.
- The user's clarification replaces the dispose() decision: runtime objects have
  no public dispose. The application decides whether to retain a reference;
  unreachable objects are reclaimed by GC.
- Detachment emits an event; its name, recipient, and payload remain open.
  Atlas must release its own retaining references and map bindings (indexes,
  rendering, subscriptions, etc.) while preserving a functional instance when an
  external reference exists. Renderer-resource cleanup is an internal responsibility,
  not a requirement for users to call dispose on every object.
- A future editor may use this separation for undo/redo; this decision itself
  does not add undo/redo to the core.

- Adding, modifying, and removing objects must update the map incrementally.
  This is a runtime/renderer mechanism, independent of Shadow DOM isolation.
- batch is accepted but not implemented: several changes may be grouped while display updates are deferred.
  Data changes immediately during the callback while display updates are suspended;
  after the callback, Atlas updates affected display content. This is not a transaction:
  earlier successful changes are not rolled back on failure. Events fire immediately
  after each successful change; handlers see current data and may make related changes.
  batch suspends only rendering, not object behavior or events. Nested batches are
  supported: rendering resumes only after leaving the outermost batch. The callback
  is synchronous; async batch is unsupported. The application obtains asynchronous
  data before batch, then applies changes synchronously. The exact signature and
  diagnostics for an incorrect async callback remain open.
- The user chooses runtime instances with behavior: registration must return an
  instance reference the application can retain and modify. Lookup by ID must
  provide that instance, not merely plain JSON.
- Serializable Map JSON remains the input/output format; a runtime instance with
  methods/observable properties is a separate representation of the same object.
- API under discussion: map.object(id).update(...), instance methods, and setters,
  including marker.position.x = 50. Exact support for nested setters and collections,
  patch/update semantics, and stability of nested references are not agreed yet.
- The earlier proposal to use only map.updateObject(id, patch) and ignore all mutations
  was not accepted. Mutating original input JSON and mutating a runtime instance are
  different operations; precise rules still need to be stated.

### Historical route-line editing — superseded

The bullets below retain the earlier line-based design history. The ordered-point
model and accepted append contract above replace it; `addLine` is removed from
the current plans.

- Accepted: route.lines is a custom stable runtime collection with domain methods
  and iteration support. The primary addition path is route.lines.add(description).
  The collection does not imitate Array APIs such as push/splice.
- Collection membership changes follow route rules: validation, continuity maintenance,
  and change notifications. Direct geometry changes to nested lines must also obey
  their owner's rules.
- for...of iterates lines; converting to an array creates a separate array, but its
  elements remain references to runtime line instances.
- The proposal of a getter returning a one-shot generator and separate route.addLine/removeLine
  methods was replaced by the collection API. Exact removal, reordering, and lookup
  signatures, add's return value, and iteration semantics during changes remain open.
- The later clarification for connected routes takes precedence over route.lines.add:
  the user chose two route operations — addLine and addPoint.
- route.addLine takes a complete line description and appends it only if its start
  matches the current route endpoint; otherwise it rejects the operation without
  repairing geometry. Failure form and comparison precision remain open.
- route.addPoint({x, y, z}) uses the route's last point as the new line's start and
  the supplied point as its end, then appends the line to the route.
- For an empty route, the first addPoint sets the starting point; the second creates
  the first line. The first addLine requires no predecessor check, only ordinary line
  validation. Serialization of the starting point before the first line exists is
  undefined; route.points is not reintroduced.
- The route.lines read API, removal/insertion, and changes to existing lines
  still require agreement.
- Accepted shared-point editing: moving a line's end automatically moves the next
  line's start; moving its start moves the previous line's end. The route synchronizes
  coordinates in both directions, maintaining continuity without a shared point registry.
  This edits an existing path; it does not repair a mismatching new line in addLine,
  which is still rejected.
- Two separate methods for changing a contiguous route section are agreed:
  replacement (replace) and removal; exact names, arguments, and return values remain open.
- Replacement takes a sequence of new lines forming a connected path. Its start and
  end must match the outer endpoints of the replaced section; mismatches reject the operation.
- Coordinate comparisons for continuity need floating-point tolerance rather than
  strict numeric equality. The value, absolute/relative metric, and tolerance
  configuration remain open. If a new line's start matches the previous endpoint
  within tolerance, snap it to that endpoint's exact coordinates to remove the tiny gap.
  Differences beyond tolerance reject the operation.
- Removing an internal section replaces it with one straight line between its outer
  endpoints. Removing a leading/trailing section simply removes it without a connector.
  Removing the entire path leaves an empty route.
- This replaces the preliminary proposal to prohibit removal from the middle.
  A straight connector preserves continuity but does not guarantee terrain traversability.
  Transferring label and data (including data.type), choosing a material, and identity of created/removed
  parts in these operations still need definition.

## Loading requests — accepted direction, separate implementation task

Keep this work outside the current background/component change. A load will have
its own operation object with an ID, temporary prepared data, completion result,
and cancellation. The current displayed map stays intact during preparation;
only an accepted, fully prepared result is swapped into the component.

The operation must be available immediately so cancellation does not require
waiting for loading to finish. Exact API names, cancellation by ID versus by the
operation handle, and whether a newer load automatically cancels its predecessor
remain decision points. Cancellation and final application must be coordinated
so a cancelled or stale operation cannot replace the displayed map; release any
unused resources. Workers are not part of the current change.

For now, the component supports one load at a time. Overlapping calls reject with
`MAP_LOAD_IN_PROGRESS`; the loading flag is cleared on success or failure.
