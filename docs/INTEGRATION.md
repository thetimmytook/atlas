# Integrating the Atlas prototype

This guide uses the current public exports from [src/index.ts](../src/index.ts).
The [current contract](design/CURRENT_CONTRACT.md) distinguishes merged behavior,
provisional contracts and pending work. The example is plain browser ESM with an
SVG Web Component; framework adapters, an editor and application features are
outside its scope.

## A complete local example

From the repository root, install the locked development tools and build:

```sh
npm ci
npm run build
```

This emits unminified `dist/index.js`, its source map and bundled
`dist/index.d.ts`. The package is private; publication and npm/CDN installation
are not configured. The build clears shared `dist/`, including example/benchmark
output, so run it outside other tasks' performance measurements.

Create an isolated demo directory and copy the output into it:

```sh
demo_dir=$(mktemp -d /tmp/atlas-demo.XXXXXX)
mkdir "$demo_dir/dist"
cp dist/index.* "$demo_dir/dist/"
printf '%s\n' "$demo_dir"
```

Save the following two files in the printed directory. The inline SVG background
needs no external service or map download.

**index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Atlas integration</title>
    <style>
      body {
        margin: 16px;
        font-family: system-ui, sans-serif;
      }
      atlas-map {
        display: block;
        width: 100%;
        height: 360px;
        background: #edf2f8;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <p id="status" role="status">Loading…</p>
    <button type="button" disabled>Move entrance</button>
    <atlas-map role="region" aria-label="Demo floor plan"></atlas-map>
    <aside aria-label="Object details">
      <pre id="details">Click a point, line, route or zone.</pre>
    </aside>
    <script type="module" src="./map.js"></script>
  </body>
</html>
```

**map.js**

```js
import { AtlasError, MapElement, ObjectClickEvent, Point3 } from './dist/index.js';

customElements.define('atlas-map', MapElement);
const map = document.querySelector('atlas-map');
const status = document.querySelector('#status');
const details = document.querySelector('#details');
const moveButton = document.querySelector('button');
if (!(map instanceof MapElement) || !status || !details || !moveButton) {
  throw new Error('Demo elements are missing.');
}

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#edf2f8"/><path d="M10 10H190V130H10Z" fill="none" stroke="#9aadc4"/></svg>';
const background = {
  source: 'data:image/svg+xml,' + encodeURIComponent(svg),
  size: { width: 200, height: 140 },
};

// Application information lives outside Atlas, keyed by stable object IDs.
const metadata = new Map([
  ['entrance', { title: 'Entrance' }],
  ['wall', { title: 'Connecting line' }],
  ['stairs', { title: 'Route upstairs and back' }],
  ['zone', { title: 'Shared zone' }],
]);

map.addEventListener('objectclick', event => {
  if (!(event instanceof ObjectClickEvent)) return;
  const { object, layer, route, mapPoint } = event.detail;
  details.textContent = JSON.stringify(
    {
      title: metadata.get(object.id)?.title ?? object.id,
      id: object.id,
      kind: object.kind,
      layerId: layer.id,
      routeId: route?.id,
      mapPoint,
      ...(object.kind === 'point' ? { position: object.position } : {}),
    },
    null,
    2,
  );
});

moveButton.addEventListener('click', () => {
  const entrance = map.objects.get('entrance');
  if (entrance?.kind !== 'point') return;
  const { x, y, z } = entrance.position;
  entrance.position = new Point3(x === 40 ? 60 : 40, y, z);
});

try {
  await map.load({
    layers: [{ id: 'ground', background, objects: ['entrance', 'wall', 'stairs', 'zone'] }],
    objects: [
      { id: 'entrance', kind: 'point', position: { x: 40, y: 30, z: 1 } },
      {
        id: 'wall',
        kind: 'line',
        points: [
          { kind: 'point', position: { x: 20, y: 60, z: 1 } },
          { kind: 'point', position: { x: 180, y: 60, z: 4 } },
        ],
      },
      {
        id: 'stairs',
        kind: 'route',
        points: [
          { id: 'start', kind: 'point', position: { x: 20, y: 110, z: 1 } },
          { id: 'landing', kind: 'point', position: { x: 100, y: 90, z: 4 } },
          { id: 'end', kind: 'point', position: { x: 180, y: 110, z: 1 } },
        ],
      },
      {
        id: 'zone',
        kind: 'polygon',
        contour: [
          { x: 120, y: 15 },
          { x: 185, y: 15 },
          { x: 185, y: 45 },
          { x: 120, y: 45 },
        ],
        baseZ: 1,
        height: 4,
      },
    ],
  });
  status.textContent = 'Loaded. Click an object; try Move entrance.';
  moveButton.disabled = false;
} catch (error) {
  status.textContent = error instanceof AtlasError ? error.message : 'Unable to load map.';
  console.error(error);
}
```

Serve that directory with the existing Vite tool, from the repository root in the
same terminal where `demo_dir` was set:

```sh
./node_modules/.bin/vite "$demo_dir" --host 127.0.0.1 --port 8090 --strictPort
```

Open [the local demo](http://127.0.0.1:8090/). You should see a blue entrance, an
orange line and route, and a translucent polygon. Click an object to update the
external panel; click **Move entrance**, then click the moved point. Drag empty
space to pan and use the wheel to zoom. Stop Vite with Ctrl+C when finished.

## Registration, sizing and coordinates

Importing the module does not register an element. Call `customElements.define`
once per page for the chosen tag, then query/create that tag. The browser import
path is relative to the importing module (to the document URL for the README's
inline module). Serve files over HTTP rather than opening `file://` URLs.

The host needs nonzero width and height. A percentage height works only when the
containing block has a definite height. Resize preserves camera center/zoom;
it does not refit the map. Shadow DOM contains the SVG; buttons and the details
panel are ordinary application HTML outside it.

Coordinates are x right, y down, z up. `Point2` represents planar values such as
camera centers and pointer coordinates; `Point3` represents runtime point
positions. Both are immutable values. Plain `{ x, y }` and `{ x, y, z }` inputs
are accepted where applicable. Omitted position z becomes 0.

The `objects` array holds root definitions. Every definition, including a line's
or route's owned points, explicitly declares `kind`. A line has exactly two
points; a route joins its ordered points as a polyline. IDs may be omitted and
will be generated; use explicit unique IDs for application lookup in this example.
The runtime permits duplicate root IDs: `get(id)` returns the first match, while
direct layer membership selects all matching roots.

A polygon contour contains x/y only: even a vertex with `z: undefined` is invalid.
Set `baseZ` and nonnegative `height` separately. Height 0 is a plane; positive height
is a vertical extrusion used for intersections. SVG still displays its x/y fill
projection. Simple convex/concave contours are supported; holes, self-intersections
and polygon outlines are not.

## Background paths and load completion

The current **provisional** background contract is
`{ source, size: { width, height } }` on a layer, at map origin `(0, 0)`. Size is in
map units and sets the displayed extent; it need not equal the image's pixel size.
The URL/size contract is intended to be replaced by the agreed resource and
background-placement design. There is no resource registry or pluggable loader now.

The renderer assigns `source` to a browser `Image.src`. A relative source therefore
resolves against **`document.baseURI`**, including any HTML `<base>` element. It is
not relative to `dist/index.js`, the JavaScript module, or a fetched map JSON URL.
For a local file beside `map.js`, add this after the `background` declaration,
before `map.load()`:

```js
background.source = new URL('./floor.svg', import.meta.url).href;
```

When fetching map JSON, fetch/parse it in the application and resolve its relative resource URLs
against the chosen JSON URL explicitly before passing it to `map.load()`.

Loading validates/copies the definition and prepares/decodes backgrounds before
replacing the active map. It also calls `map.fit()`. `await map.load()` means the
prepared map was committed, **not** that a browser paint completed. Display updates
are scheduled through animation frames; automated checks should wait for the
specific visible output they need.

## Camera and fit

Add `Point2` and `Rect` to the import at the top of `map.js`. Add the following after
the successful `await map.load(...)`, inside the existing `try` block:

```js
map.camera.center = new Point2(100, 70);
map.camera.zoom = 2; // Positive CSS pixels per map unit.
map.camera.fit(new Rect(10, 10, 180, 120)); // Fit a chosen map-space rectangle.
```

Use `map.fit()` to restore the extent of all layer backgrounds, including hidden
ones. It does nothing when there are no backgrounds; it does not compute object
bounds. Camera constraints, animation and a saved home view are not implemented.

For an external overlay, `map.coordinates.mapToClient(new Point2(x, y))` gives
viewport CSS coordinates, suitable for `position: fixed`. The reverse is
`clientToMap(point)`. Conversion requires a connected nonzero surface; check
`map.coordinates.available` first. These conversions are planar and infer no z.

## Floors and automatic intersections

Reload the page with the example's `layers` array replaced by the following. Leave
the root `objects` and `background` variable unchanged:

```js
layers: [
  { id: 'site', stackIndex: -1, background },
  {
    id: 'ground',
    objects: ['entrance', 'wall'],
    intersectionBounds: { min: { z: 0 }, max: { z: 3 } },
  },
  {
    id: 'upper',
    stackIndex: 1,
    intersectionBounds: { min: { z: 3 }, max: { z: 6 } },
  },
],
```

Layers start visible. `stackIndex` controls composition, ascending, with declaration
order breaking ties. Add this after the successful load to select one floor:

```js
const showFloor = id => {
  for (const layer of map.layers) {
    if (layer.id === 'ground' || layer.id === 'upper') {
      layer.visible = layer.id === id;
    }
  }
};
showFloor('ground');
```

For TypeScript, annotate the function parameter as `id: 'ground' | 'upper'`.
Call `showFloor('upper')` from your own button/select handler. Visibility controls
both display and picking; the independent `site` background remains visible.

There are two membership mechanisms:

- `objects: ['entrance', 'wall']` in a layer definition is **direct membership** by
  root ID. The entire wall remains on `ground`, although its endpoint reaches z = 4.
- `intersectionBounds` automatically derives appearances from all current roots.
  The stairs cross both floors; the zone spans z = 1 through 5 and appears in both.
  The upper floor also gets the intersecting part of the wall. Direct membership
  takes priority over clipping of that same root in the same layer.

Bounds use `[min, max)`; omitted axes are unbounded. Add x/y limits when floors
also need different footprints. Clipped polygons require positive x/y area (and
positive vertical overlap for a volume). Cuts create no new runtime points or IDs.
There is no runtime bounds setter; changing the bounds requires a new load.

To change direct membership at runtime, add this after the floor-selection code:

```js
const ground = map.layers.find(layer => layer.id === 'ground');
if (!ground) throw new Error('Ground layer is missing.');
ground.objectIds.add('stairs'); // Whole route on ground, overriding its clipping here.
ground.objectIds.remove('stairs'); // Restore automatic floor intersections.
```

Run the add/remove separately to inspect each state. `layer.objects` is a frozen
array of current **direct roots only**; it is not an editable collection or a list
of automatic appearances. The top-level `layers` field is required; `layers: []`
is valid but displays nothing. There is no implicit default layer. Load-time direct
IDs must reference existing roots; runtime ID membership can precede root addition.

## Object events and the external panel

The initial `objectclick` handler already updates the HTML panel using `textContent`.
Its `object` is the original runtime instance, including when the appearance was
clipped. `layer` is the actual hit runtime layer. A route-path hit returns its
`MapRoute`; a route-vertex hit returns its `MapPoint` and the owning `route`.
Polygon hits return the original `MapPolygon`. Overlapping appearances follow the
visible composition order.

The detail also includes planar `mapPoint` and viewport-CSS `clientPoint`.
`objectclick`, `press` and `release` bubble and cross Shadow DOM. Surface events
also cover empty space; `release.detail.isClick` distinguishes eligible clicks from
drag/pinch/wheel gestures. Pointer cancellation/lost capture emits no normal release.
In TypeScript, use the exported `ObjectClickEvent` as in the example to narrow the
listener's DOM `Event` before reading its detail.

Application metadata is kept in the native JavaScript `Map` by ID. There is no
implemented object `data`, material or label field. Atlas creates no selection or
panel UI. If you keep a selected runtime instance, refresh your panel after your own
edits; a click panel is a snapshot of what its handler rendered.

To pick on press, add this after the element lookup/guard:

```js
map.clickTrigger = 'press';
```

`clickTrigger` is a JavaScript property, not an observed HTML attribute. Its default
is `'release'`, which picks only eligible releases. An accepted first-hit press
consumes the gesture: pan, pinch and wheel are suppressed until tracked pointers
end, and release produces no second object click. Pressing empty space allows pan.
Surface handlers run before object delivery; the captured hit is revalidated after
them rather than replaced by an underlying hit.

The current-contract baseline (`bc87449`, checked on 2026-10-09) records a
press-mode defect where a second pointer can pick and consume a valid pinch.
The [second-pointer correction](https://github.com/thetimmytook/atlas/pull/34)
and the separate
[bounded route-membership invalidation fix](https://github.com/thetimmytook/atlas/pull/33)
have since merged. First-hit press consumption is preserved; a public cancellation
notification and broader physical mobile/input validation remain open.
Parallel checkout changes alone do not establish merged behavior.
The complete example uses the default release mode. See the
[baseline input contract](design/CURRENT_CONTRACT.md#input-and-events).

## Runtime changes and snapshot limits

The initial move button replaces the entrance's complete position. It explicitly
preserves `z`: assigning only `{ x, y }` or `new Point2(x, y)` would reset it to 0.
For another point, including a line/route-owned point, use the same pattern:

```ts
// Inside the successful-load block; works with both layer configurations above.
const route = map.objects.get('stairs');
if (route?.kind === 'route') {
  const landing = route.points[1];
  if (landing) {
    const { x, y, z } = landing.position;
    landing.position = new Point3(x + 5, y, z);
  }
}
```

Add the following after the `ground` lookup from the membership section, inside
the successful-load block. It adds a root and explicitly selects it for display:

```js
const added = map.objects.add({
  id: 'temporary-point',
  kind: 'point',
  position: new Point3(75, 35, 1),
});
ground.objectIds.add(added.id);
metadata.set(added.id, { title: 'Temporary point' });
```

Adding a root alone does not guarantee an appearance: a visible layer needs
matching direct membership or suitable automatic `intersectionBounds`. With the
floor configuration this point also qualifies automatically for `ground`.

For removal, execute the following later, for example in your own button handler
closing over `added` and `ground`:

```js
map.objects.remove(added); // Exact runtime instance, not an ID.
ground.objectIds.remove(added.id);
metadata.delete(added.id);
```

Removing direct membership alone can leave an automatic appearance; removing the
root removes all its appearances. A detached instance remains usable and can be
reattached with `map.objects.add(added)`; restore direct membership if needed.
Successful `load()` creates new roots/layers, so reacquire references after it.

`map.definition` is an immutable resolved **load snapshot**, with generated IDs
filled in. Runtime positions, additions/removals, layer membership and visibility
never update it. Do not use it as an export/save of the current edited state.
Maintain application state separately when persistence is required. Current-state
export and batch updates are not implemented.

## Failed replacement loads keep the previous map

Add `MapDefinition` as a type-only import for this optional **TypeScript** fragment:
`import type { MapDefinition } from './dist/index.js';`. In a TypeScript consumer,
place the function after the successful initial load. Call it from your own async
load handler; it replaces neither map nor camera on validation/resource failure:

```ts
const replaceMap = async (next: MapDefinition): Promise<boolean> => {
  try {
    await map.load(next);
    return true;
  } catch (error) {
    if (error instanceof AtlasError) {
      console.error(error.code, error.details, error.cause);
      status.textContent = `Load failed: ${error.code}. Previous map retained.`;
    } else {
      console.error(error);
      status.textContent = 'Load failed. Previous map retained.';
    }
    return false;
  }
};

// Deterministic validation failure, requiring no network request:
await replaceMap({ layers: [{ objects: ['missing-root'] }], objects: [] });
```

This rejects with `UNKNOWN_LAYER_OBJECT`. A background decode failure rejects with
`BACKGROUND_LOAD_FAILED`, structured source/layer context and the original `cause`.
The previous runtime instances, edits, visibility, snapshot and camera remain active.
On the first failed load there is no previous map, as handled by the initial example.
Concurrent loads reject with `MAP_LOAD_IN_PROGRESS`; await one before starting
another. Disconnecting the component does not cancel an in-flight load.

## Prototype limits and further reading

Point circles, line/route strokes and polygon fill are **provisional appearance
defaults**, intended to be replaced by resolved materials. Original route vertices
currently have symbols and separate picking when eligible; the accepted future
no-symbol/no-point-picking default is not implemented. Line endpoints have no
separate symbols. SVG extrusion remains a planar projection.

The current build targets ES2022 without automatic polyfills; this is not a final
browser support promise. Desktop Chromium checks and responsive layouts do not
establish physical mobile/input coverage or production performance limits.

- [Current contract](design/CURRENT_CONTRACT.md): authoritative status and limits.
- [Design overview](DESIGN_MAIN.md): accepted direction and open decisions.
- [Tooling](TOOLING.md): source examples, tests, builds and template details.
- [Buildings example](../examples/buildings.html): independent building floors.
- [README](../README.md): entry point and development commands.
