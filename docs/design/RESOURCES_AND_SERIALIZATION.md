# Resources and serialization

Status on 2026-10-16: first-slice image resources and SVG/PNG preparation are
implemented and accepted for PR, pending merge. The full
resource manager/custom loader, schemaVersion and broader document design remain
future work. Backgrounds keep their provisional URL/size input; `map.definition`
remains a copied/frozen load snapshot rather than live export.

[Main navigation](../DESIGN_MAIN.md)

The [accepted first-slice contract](MATERIALS_FIRST_SLICE_CONTRACT.md) covers image
IDs, source-size rules, normalized anchors and final screen dimensions. Browser
preparation uses standard fetch/CORS access to inspect the source bytes, then
browser image decoding. It prepares every declaration, including unused icons,
and releases candidate URLs on failure; replacement retains the previous map
until all icon/background preparation succeeds. See
[implementation/checks](PROTOTYPE.md#first-material-slice--implemented-for-review-2026-10-12).
The dated design notes below describe the broader future registry separately.

## Accepted: map resource registry

- Resources are described in a separate registry: backgrounds, icons, fonts,
  and eventually 3D models.
- JSON stores each resource description once under an ID. Objects and materials
  reference that ID. Atlas loads and reuses the resource.
- The application can supply its own loader, for example for authentication or
  local files. Runtime loader functions are not part of serializable JSON.
- Loading errors are handled strictly under the map-loading rules.
- The first image-resource fields and first-slice icon loading strategy are accepted
  below. Complete TypeScript contracts, loader API, cache scope, resource release,
  export contents and schemas/strategies for other future resource types remain open.

Custom icons are required in the
[first material slice](MATERIALS.md#first-material-slice--accepted-2026-10-09),
as confirmed on 2026-10-09. SVG and PNG are accepted icon formats, with the first
resource fields accepted below. These decisions do not implement the full resource
registry. See the accepted
[icon appearance rules](MATERIALS.md#icon-appearance--accepted-2026-10-09).

## Image resource fields — accepted, 2026-10-12

`MapDefinition.resources` is a dictionary keyed by `ImageResourceId`, an exported
plain alias of `string`. The same alias types `PointImage.resource` and internal
prepared-image map keys; source URLs and material names keep their separate string
roles. This is type/documentation reuse, with unchanged validation. The first stage
supports SVG and PNG image resources with `kind: 'image'` and `source` identifying
the image URL.

Accepted fragment of a map definition:

```json
{
  "resources": {
    "exit-icon": {
      "kind": "image",
      "source": "/icons/exit.svg"
    }
  }
}
```

An image is described once under its ID; a material references that ID. Icon
display dimensions and aspect-ratio preservation belong to the material, allowing
the same resource to be displayed at different sizes. Source dimensions remain
a separate input to the accepted icon-size calculation.

This is accepted future schema, not implemented input. Complete TypeScript
declarations, the precise material field for the resource reference, URL-resolution
rules, and source-dimension handling (including SVGs without explicit dimensions)
remain open. These fields do not choose background-placement migration or schemas
for future resource types.

## First-slice icon loading — accepted, 2026-10-09

- `map.load()` prepares every icon declared in the candidate map's resource
  registry, including icons not currently selected by an object.
- Loading completes only when all declared icons are ready. An icon-loading
  failure rejects the load; the previous map remains active and usable, following
  the accepted strict map-loading rules. Replacement happens only after successful
  preparation.
- Runtime material edits and assignments may switch between already loaded icon
  resources synchronously.
- Adding new resource sources while the map is running is outside this first
  slice and remains a separate future stage.

This is accepted future behavior, not an implemented resource API. The basic image
fields are accepted above; complete TypeScript contracts and loader signatures
remain open.

## Accepted: map document contents

- schemaVersion.
- Map space and bounds.
- objects and layers.
- Materials and their assignment rules: the basic `materials` and `materialRules`
  fields are accepted in
  [Materials](MATERIALS.md#serializable-material-fields--accepted-2026-10-09).
- Resource registry: the first `resources` image fields are accepted above.
- homeView and camera constraints.

Handler registrations, loaders, and other executable behavior live in application
configuration outside JSON. The map contains display data; the application supplies
extension code. Exact names of other fields and the complete schema are not defined yet.

## Open: runtime export

Document contents are agreed, but which current runtime changes are exported,
and how defaults are represented still need definition. The 2026-10-12 first-slice
review keeps standard appearance/defaults internal, with no public built-in
material reference names or mutable handles; named references resolve only to
user-declared materials. See [review corrections](MATERIALS.md#first-slice-review-corrections--accepted-2026-10-12).
User-session storage remains the application's responsibility.
