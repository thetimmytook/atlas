# Atlas

Renderer-independent interactive map engine.

The project is currently in the design and prototyping stage.
Start with the [design overview](docs/DESIGN_MAIN.md) for accepted decisions,
open questions, and the agreed prototype scope.

## Development

Run `npm ci` to install development tools and enable the pre-commit hook.
Node is only needed for development tools. No project Node version is pinned;
use a version supported by the locked dependencies. Checked on Node 20.19.6.

| Command                                   | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                             | Start Vite for the examples, with automatic page updates      |
| `npm run typecheck:watch`                 | Watch browser source for type errors                          |
| `npm run build`                           | Check types, bundle ESM, and generate declarations in `dist/` |
| `npm run check`                           | Type checking, lint, and formatting checks                    |
| `npm run typecheck`                       | Check browser source and tooling configuration                |
| `npm run lint` / `npm run lint:fix`       | Check code / apply automatic lint fixes                       |
| `npm run format:check` / `npm run format` | Check formatting / format files                               |

In VS Code, run **Atlas: dev** (`Ctrl/Cmd+Shift+B`). It starts Vite and the type
watcher; compiler diagnostics appear in Problems. Tasks use blue map icons.
Stop background tasks through `Tasks: Terminate Task` when finished.

Without VS Code, run `npm run dev`; optionally run `npm run typecheck:watch` in
another terminal for continuous diagnostics. Open http://127.0.0.1:8080/examples/.
Vite binds to loopback and fails if that port is occupied. No initial build is needed.
Vite transforms TypeScript but does not type-check it; `build` checks types first.

The example imports library source directly during development. Changes propagate
through Vite; this custom element uses full page reloads, not in-place replacement
of a registered element class. Reloading resets example state.

## First component

`src/index.ts` exports `MapElement`, an initial custom-element shell. It creates an
empty SVG surface in an open Shadow DOM, follows the host's content size, releases
its resize observer when detached, and resumes observation on the same surface when
reconnected. The application provides dimensions and registers the element explicitly:

```js
import { MapElement } from './dist/index.js';

customElements.define('atlas-map', MapElement);
```

The example provides a resizable frame. Map data, camera behavior, and interaction
events remain subsequent implementation steps.

## Component templates

```text
src/components/map-element/
  map-element.ts
  map-element.html
```

Behavior lives in TypeScript; static markup and CSS live in the adjacent HTML file:

```ts
import html from './map-element.html?raw';
```

Vite handles the raw import in development and embeds the string in the library
bundle. There is no generated source file or custom template watcher. Templates are
trusted repository code inserted into Shadow DOM, not arbitrary application HTML.

## Build and tooling

Vite library mode emits one unminified ESM entry, `dist/index.js`, and a source map.
vite-plugin-dts and API Extractor bundle public types into `dist/index.d.ts`. A build
cleans previous output after type checks pass. ES2022 is the provisional output target,
not a final browser compatibility guarantee; no automatic polyfills are added.

All dependencies are development-only. The private package has no runtime dependencies,
framework adapter, publishing configuration, CI, or placeholder test command.
Vite's development client is not included in the library build.

ESLint loads `eslint.config.mts` through `jiti`. Tooling configuration has its own
TypeScript project with Node types; browser source has DOM types and no ambient Node
globals. The pre-commit hook lints/formats staged files. Run `npm run check` before
requesting a commit. Original design sources and archives are excluded from formatting.

See [AGENTS.md](AGENTS.md) for conventions and [tooling notes](docs/TOOLING.md) for scope.
