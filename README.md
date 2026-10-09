# Atlas

Atlas is a renderer-independent interactive map engine for browser pages. The
current prototype provides an SVG renderer through an explicitly registered Web
Component. Application UI stays outside the engine.

Available now:

- Map loading with explicit layers, image backgrounds and independent visibility.
- Points, straight lines, routes and horizontal polygons with optional vertical
  extrusion; runtime object addition, removal and geometry edits.
- Direct layer membership and automatic x/y/z intersections with shared source
  identity for display and picking.
- Camera center/zoom/fit, mouse drag/wheel, touch pan/pinch, coordinate conversion,
  `press`, `release` and `objectclick` events with the hit layer.

This is a prototype, with provisional built-in appearance and URL/size backgrounds.
SVG displays an x/y projection, including extruded polygons; it is not a 3D view.
Materials, labels, a resource registry and current-state export are not implemented.
Synchronous `map.batch()` is implemented for review and not yet merged; see the
[batch contract](docs/design/RUNTIME_AND_LOADING.md#synchronous-nested-batch--accepted-contract-2026-10-09).
Framework adapters and an editor are future consumers. Browser,
mobile and performance validation remain incomplete. See the
[current contract](docs/design/CURRENT_CONTRACT.md) and the
[integration guide's follow-up status](docs/INTEGRATION.md#object-events-and-the-external-panel).

## First map

The package is private and has no npm/CDN distribution. From this checkout:

```sh
npm ci
npm run build
npm run dev
```

The build produces `dist/index.js` and bundled types in `dist/index.d.ts`; it clears
previous `dist/` output. Run it outside benchmark measurement windows.
Save this as `quickstart.html` beside `package.json`, then open
[the quickstart page](http://127.0.0.1:8080/quickstart.html):

```html
<!doctype html>
<html lang="en">
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atlas quickstart</title>
  <style>
    atlas-map {
      display: block;
      width: 100%;
      height: 360px;
    }
  </style>
  <atlas-map role="region" aria-label="Example map"></atlas-map>
  <script type="module">
    import { MapElement, Rect } from './dist/index.js';

    customElements.define('atlas-map', MapElement);
    const map = document.querySelector('atlas-map');
    if (!(map instanceof MapElement)) throw new Error('Map element is missing.');

    await map.load({
      layers: [{ id: 'ground', objects: ['entrance'] }],
      objects: [{ id: 'entrance', kind: 'point', position: { x: 50, y: 50 } }],
    });
    map.camera.fit(new Rect(0, 0, 100, 100));
  </script>
</html>
```

The application registers the element and gives it nonzero dimensions. `layers`
is required; there is no implicit default layer. Without a background, use
`camera.fit(rect)` as above: `map.fit()` fits backgrounds only.

Continue with the [integration guide](docs/INTEGRATION.md) for a self-contained
background, all four object kinds, floors, click details, runtime edits and load
error handling. `await map.load()` commits the prepared map; it does not promise
that the browser has painted it.

## Development and examples

`npm run dev` serves [Factory](http://127.0.0.1:8080/examples/) and
[Buildings](http://127.0.0.1:8080/examples/buildings.html) on loopback port 8080.
Factory demonstrates camera/input, layers, routes and object editing; Buildings
demonstrates independent floors and a shared extruded polygon. Both use local
assets. No initial build is needed for these examples: Vite transforms their source
imports, and component changes reload the page, resetting its state.

Node is needed for development tools only; use a version supported by the locked
dependencies. No project Node version is pinned.

| Command                                   | Purpose                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| `npm ci`                                  | Install locked tools and enable the pre-commit hook          |
| `npm run dev`                             | Serve source examples                                        |
| `npm run typecheck:watch`                 | Watch browser source types                                   |
| `npm run build`                           | Check types, build ESM and bundle declarations               |
| `npm run check`                           | Check source/tooling/test/example types, lint and formatting |
| `npm test` / `npm run test:browser`       | Run Node / Chromium regression tests                         |
| `npm run test:e2e`                        | Build examples and run browser integration tests             |
| `npm run lint` / `npm run lint:fix`       | Check code / apply lint fixes                                |
| `npm run format:check` / `npm run format` | Check / apply formatting                                     |

Vite does not type-check development pages. VS Code's **Atlas: dev** task starts
Vite and the type watcher together. Browser test setup, templates, build output,
benchmark commands and CI details are in [Tooling](docs/TOOLING.md).

- [Integration guide](docs/INTEGRATION.md): practical page integration.
- [Current contract](docs/design/CURRENT_CONTRACT.md): implemented, provisional and pending behavior.
- [Design overview](docs/DESIGN_MAIN.md): decisions, scope and topic navigation.
- [Tooling](docs/TOOLING.md) and [repository conventions](AGENTS.md).
