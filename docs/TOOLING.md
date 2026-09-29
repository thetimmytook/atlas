# Library tooling

The initial setup was adapted from Timmy Academy commit
`065e835c112e1d29f13b298d96e5bcb84f3d2ffb` for an internal browser library.
The user subsequently approved Vite for development, raw templates, and library builds.

## Current setup

- One private ESM package using npm and a committed lockfile.
- Strict TypeScript, including unchecked indexed access, exact optional properties,
  unused code checks, implicit returns, and type-only imports.
- Browser DOM types without ambient Node types. The narrowly scoped `*.html?raw`
  declaration describes imported template strings.
- ESLint configuration in TypeScript, loaded through development-only jiti. A separate
  tooling TypeScript project covers configs with Node types. Browser source rules
  reject Node built-ins and development-package imports.
- Prettier and Husky/lint-staged; original and archived documents are preserved.
- No project Node version pin. Development dependencies retain their own requirements;
  the setup is checked on Node 20.19.6. lint-staged remains on version 16 for compatibility.

## Development and build

`npm run dev` starts Vite at 127.0.0.1:8080. The example under `/examples/` imports
source TypeScript directly, and the dev server transforms it on demand. There is no
initial compilation step or separate static server. Custom-element source/template
changes cause page reloads through Vite's module graph; preserving live component
state through HMR is outside the current scope.

Vite does not check types. `npm run typecheck:watch` provides continuous source
checks. VS Code's default `Atlas: dev` task starts both processes, with `$tsc-watch`
diagnostics and blue map icons. `npm run typecheck` also checks tooling configuration.

`npm run build` checks types, then runs Vite library mode with vite-plugin-dts
and API Extractor to bundle declarations. Output is unminified ESM with a source
map and a single `index.d.ts` in ignored `dist/`. ES2022 is provisional, not an approved browser matrix.
The build contains no Vite development client. No runtime dependencies are present.

## Templates

A component imports its neighboring HTML with `?raw`. Vite embeds the string, including
its style block, in the library output. CSS remains isolated in Shadow DOM. The earlier
custom generator, generated `*.html.ts` files, HTML watcher, and http-server are removed.
No runtime request for an HTML template is necessary in the built library.
Templates are trusted source files, not a sanitizer for application data.

## Deferred

Framework adapters, workspace splits, a test runner, package distribution/exports,
minification, publication, and CI remain outside the current scope. There is no
`sideEffects: false` claim before actual registration behavior and consumption are
validated. Runtime dependencies must be evaluated for concrete purpose and bundle cost.

## Internal named imports

package.json `imports` maps `#camera/*.js`, `#components/*.js`, `#definitions/*.js`,
`#errors/*.js`, `#interaction/*.js`, `#math/*.js`, `#renderers/*.js`, and
`#validators/*.js` to the corresponding TypeScript files under `src/`.
TypeScript (Bundler resolution), Vite, and ESLint's TypeScript resolver use these
mappings. Neighboring `./` imports remain relative; parent-relative `../` source
imports use named paths instead. No duplicate tsconfig paths or Vite aliases are needed.

Vite resolves aliases into the browser bundle. vite-plugin-dts uses
`tsconfig.build.json` and `bundleTypes: true` with API Extractor to produce a
self-contained `dist/index.d.ts`. Consumers need neither the source files nor
internal alias configuration. The declaration plugin receives alias mappings derived
from package.json in vite.config.mts; there is no second hand-maintained mapping.
Both packages are development-only dependencies;
there is no custom declaration-rewriting script.

API Extractor 7.59.3 currently bundles TypeScript 5.9.3 and warns when processing
this project's TypeScript 6.0.3 output. The declaration bundle has been checked with
TypeScript 6 in isolated NodeNext and Bundler consumers; revisit compatibility when
upgrading tooling or introducing new TypeScript syntax.
