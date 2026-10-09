# Resources and serialization

Status on 2026-10-09: accepted future document/resource design, not implemented.
Current input contains objects and explicit layers with provisional URL/size image
backgrounds. There is no schemaVersion validation, resource registry or pluggable
loader. `map.definition` is a load snapshot, not runtime export; see
[Current contract](CURRENT_CONTRACT.md#layers-identity-and-runtime-state).

[Main navigation](../DESIGN_MAIN.md)

## Accepted: map resource registry

- Resources are described in a separate registry: backgrounds, icons, fonts,
  and eventually 3D models.
- JSON stores each resource description once under an ID. Objects and materials
  reference that ID. Atlas loads and reuses the resource.
- The application can supply its own loader, for example for authentication or
  local files. Runtime loader functions are not part of serializable JSON.
- Loading errors are handled strictly under the map-loading rules.
- Exact resource schemas, loader API, cache scope, resource release, loading strategy,
  and export contents are not yet defined.

## Accepted: map document contents

- schemaVersion.
- Map space and bounds.
- objects and layers.
- Materials and their assignment rules.
- Resource registry.
- homeView and camera constraints.

Handler registrations, loaders, and other executable behavior live in application
configuration outside JSON. The map contains display data; the application supplies
extension code. Exact names of other fields and the complete schema are not defined yet.

## Open: runtime export

Document contents are agreed, but which current runtime changes are exported,
how defaults are represented, and how built-in materials are referenced still need
definition. User-session storage remains the application's responsibility.
