# Runtime And Loading

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Updates and runtime objects — discussion ongoing

- Storing and restoring user state is the application's responsibility (Redux,
  MobX, etc.). Atlas introduces no session-snapshot system. It provides current
  values, change events, and control APIs.
- Runtime object change notifications are confirmed: object, changed property,
  previous value, and new value. Subscriptions may target one object or changes
  across the map, without a Redux/MobX dependency. The exact event API remains open.
- Exporting a serializable map description remains a separate task. Its exact
  contents and the boundary between persisted parameters and temporary changes
  are not yet agreed; the proposed export contents should not be treated as approved.

- Initial map loading is strictly validated: invalid data rejects the entire load.
  No partial/lenient mode is introduced.
- Map JSON has an explicit schemaVersion field (example: 1) identifying the data
  format version independently of the library version. Unsupported versions cause
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

- Failed operations, such as mismatching addLine endpoints or duplicate IDs, throw
  an exception with a clear code and description. The calling application may use
  try/catch; logging does not replace an exception.
- An operation rejected by validation does not change object state. This guarantee
  applies to an individual operation, not to batch as a transaction; earlier
  successful batch changes remain. Error classes and the code list are undefined.

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
- batch is approved: several changes may be grouped while display updates are deferred.
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
  Transferring label/data/type, choosing a material, and identity of created/removed
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
