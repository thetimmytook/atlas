# Basic library setup

The user requested a basic setup for an internal browser library, based on
Timmy Academy, with bundle size kept small and no CI, npm publishing, or minification.

Reference inspected: Timmy Academy commit `065e835c112e1d29f13b298d96e5bcb84f3d2ffb`.

## Adapted tooling

- One private ESM package, npm lockfile, and an empty `src/index.ts`.
- TypeScript strictness from the reference, including unchecked indexed access,
  exact optional properties, unused code, implicit returns, and type-only imports.
- Browser `DOM` types and `types: []` to avoid implicit Node globals. ES2022 is a
  provisional baseline, not an agreed browser support matrix. Type checking does not emit files;
  a separate build configuration emits local development output.
- ESLint flat config in TypeScript, loaded through the development-only `jiti` loader.
  `tsconfig.tooling.json` checks configuration types separately with Node types;
  browser source retains DOM types and no ambient Node globals. Typed source rules,
  import checks, SonarJS, security checks,
  and the reference's spacing conventions. Browser source cannot import Node
  built-ins or devDependencies.
- Existing Prettier settings, preserving original and archived design documents.
- Husky and lint-staged for staged files; full checks remain an explicit command.
  lint-staged 16 is used instead of the reference's 17 to work with the existing
  Node 20.19.6 development environment. No Node version pin or package engines
  constraint is introduced. Tool dependencies retain their own requirements.

All packages are devDependencies. Their installed size is not the browser bundle
size. Future runtime dependencies need an explicit purpose and size evaluation.
No `sideEffects: false` claim is made before actual code and registration behavior
exist; tree shaking must be verified against real consumption later.

## Local build and example workflow

Following the Academy contracts pattern, `build` runs `tsc` and `dev` runs `tsc --watch`.
`tsconfig.build.json` emits ES2022 modules, declarations, and source maps into ignored
`dist/`, with `noEmitOnError`. Explicit relative `.js`/`.mjs` imports keep output usable
directly in browsers. Old output remains on compilation failure; stale files after
source removal require cleaning `dist/` and rebuilding.

VS Code's default `Atlas: dev` task builds once, then starts the watcher and example
server in parallel. `$tsc` and `$tsc-watch` report compiler diagnostics. The example
imports compiled JavaScript. The dev-only http-server serves the repository on
127.0.0.1:8080 without caching. Browser refresh is manual. No bundler or live reload
is introduced.

## Deferred

React and other adapters, workspace splits, a bundler, a test runner, built package
exports, distribution, minification, publication, and CI are not part of this setup.
There are no success-only build or test scripts. Runtime implementation is not
started by this tooling task.
