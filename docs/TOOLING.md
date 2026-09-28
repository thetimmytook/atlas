# Basic library setup

The user requested a basic setup for an internal browser library, based on
Timmy Academy, with bundle size kept small and no CI, npm publishing, or minification.

Reference inspected: Timmy Academy commit `065e835c112e1d29f13b298d96e5bcb84f3d2ffb`.

## Adapted tooling

- One private ESM package, npm lockfile, and an empty `src/index.ts`.
- TypeScript strictness from the reference, including unchecked indexed access,
  exact optional properties, unused code, implicit returns, and type-only imports.
- Browser `DOM` types and `types: []` to avoid implicit Node globals. ES2022 is a
  provisional checking baseline, not an agreed browser support matrix. No emit.
- ESLint flat config in JavaScript so loading configuration needs no TypeScript
  runtime loader. Typed source rules, import checks, SonarJS, security checks,
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

## Deferred

React and other adapters, workspace splits, a bundler, a test runner, built package
exports, distribution, minification, publication, and CI are not part of this setup.
There are no success-only build or test scripts. Runtime implementation is not
started by this tooling task.
