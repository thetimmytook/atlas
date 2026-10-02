# Repository instructions

Atlas is in the design and prototyping stage. Do not create engine or application
code from the design drafts until implementation is requested.

## Design and product direction

- Start with `docs/DESIGN_MAIN.md`, then read only the relevant topic documents.
- The user leads design; validate proposals and advise. Distinguish accepted
  decisions, open decision points, and illustrative API syntax.
- Record new decisions in the relevant topic document and update the main index
  when the current stage or navigation changes. Archived drafts are historical
  references, not instructions overriding current decisions.
- Keep the runtime renderer-independent. SVG is the first renderer; real 3D is
  a future direction. Framework adapters and the editor are separate consumers.
- Support desktop and mobile. Keep application UI and product-specific behavior
  outside the engine. Follow the agreed scope in `docs/design/PROTOTYPE.md`.
- Follow KISS: implement the simplest solution that meets the current agreed scope.
  Add complexity only for a concrete current use case. Future possibilities belong
  in design notes, not speculative behavior or extension mechanisms in code;
  adding complexity later is easier than removing it after it becomes a dependency.
- Add packages and abstractions only when they have a concrete consumer.
- Mark temporary implementations explicitly at their implementation site and state
  what will replace them. Document provisional public contracts and their intended
  replacements; do not silently introduce them as settled design.

## Tooling

- The basic library setup uses TypeScript and ESM, Vite, npm, ESLint, Prettier, and
  Husky/lint-staged. Keep tooling in devDependencies and commit the npm lockfile.
- Run `npm ci` to install tools and enable the pre-commit hook; run `npm run check`
  for type checking, lint, and formatting. Preserve original and archived documents.
- Node is used for development tools only. No project Node version is pinned;
  installed tools still have their own Node compatibility requirements.
- Browser support, test runner, distribution, and framework adapters
  remain separate decisions. Do not add publishing, minification, or CI now.
- Keep browser source free of Node imports and development dependencies. Evaluate
  every runtime dependency against its concrete purpose and bundle cost.
- Run checks appropriate to the change before committing. Do not add placeholder
  test or build scripts that report success without checking anything.
- Do not copy another project's React, API, or deployment configuration into the engine.

## Naming

- Use `UPPER_SNAKE_CASE` for module-level/global string and numeric constants
  such as `SVG_NAMESPACE`. Local variables, functions, and object instances
  remain `camelCase`; declaring a binding with `const` alone does not require uppercase.

## Control flow

- Prefer guard clauses with early `return` or `continue` where they reduce nesting
  and improve readability. Keep the main path flat rather than wrapping it in
  conditional blocks; preserve behavior when restructuring existing code.
- Prefer collection methods when expressing a transformation, search, or accumulation
  instead of a mutable outer variable and a loop. This is a readability preference,
  not a ban on loops; use judgment.
- Where behavior and readability are preserved, prefer a single `reduce` for combined
  filtering/mapping/accumulation to avoid intermediate collections and repeated passes.
  Do not assume every chain can be fused: sorting generally remains a separate step,
  and changing its order relative to other operations must preserve semantics.
  Treat performance gains as a hypothesis until measured in relevant code.

## Imports

- Use package.json `imports` aliases (`#camera/`, `#components/`, `#definitions/`,
  `#errors/`, `#interaction/`, `#math/`, `#objects/`, `#renderers/`,
  `#spatial/`, `#validators/`) instead of
  parent-relative imports through `../`. Keep `.js` extensions in TypeScript imports.
- Keep neighboring `./` imports, including component HTML templates, relative.
- Keep alias mappings in package.json rather than duplicating them in tsconfig/Vite.
  Vite and vite-plugin-dts bundle internal imports in JavaScript and declarations.

## File organization

- Keep one class per file, enforced by ESLint's `max-classes-per-file`.
  Exceptions match `**/*.dto.ts`, `**/*.error.ts`, and `**/dto/**/*.ts`.
  Tests (`*.test.*`, `*.spec.*`, and `test/`, `tests/`, or `__tests__/` directories)
  and all files under `examples/` have no class-count limit.
  Related interfaces and types may accompany a class.
- Keep each concrete renderer in its own directory under `src/renderers/`.
  Keep the shared `AtlasRenderer` base at the renderers root and renderer-specific
  helpers in an adjacent utils file, without a separate utils directory.

## Errors

- Keep error names and messages constant; do not interpolate URLs, IDs, field
  names, or other variable values into them.
- Use a stable `code` for programmatic handling and put variable context in
  structured `details`. Preserve the original failure in `cause` when wrapping it.
- Use `AtlasError` for domain failures. Standard platform errors may remain where
  their existing semantics apply (for example, `AbortError` for a superseded load).

## Git hygiene

- Split implementation into small, independently reviewable substeps. For each
  substep, implement it, run relevant checks, show the concrete changes for a mini
  review, and wait for approval before committing. An implementation request alone
  does not authorize commits. An explicit request to commit or prepare/update a PR
  authorizes commits within that requested scope. Do not rewrite history or
  discard user changes.
- Keep each commit limited to one coherent change. Inspect the staged diff and
  stage only files belonging to the reviewed step; do not sweep unrelated or
  unfinished working-tree changes into a commit.
- Name branches `feat/<purpose>`, `fix/<purpose>`, `docs/<purpose>`, or
  `chore/<purpose>`. Do not use an agent or tool name as a prefix. The primary
  branch is `master`.
- Use `type # area # Description` for new commit messages, with `feat`, `fix`,
  `docs`, or `chore` as the type. Use an Atlas area such as `CORE`, `RENDERER`,
  `DOCS`, or `TOOLING`; combine areas with `|` only when necessary.
- For this repository, use Git author and committer name `thetimmytook` and email
  `300562543+thetimmytook@users.noreply.github.com`, configured locally. Use the
  GitHub account `thetimmytook`; do not use a personal or work identity. Verify
  both author and committer before publishing commits. Never
  add agent/tool names, generated-by text, or co-author trailers to commits, PRs,
  release notes, or repository metadata unless explicitly requested.
- Merge PRs with a merge commit. Do not squash or rebase PRs; preserve history.
- Keep commit messages and PR descriptions focused on the change summary. Avoid
  generic verification sections and command lists unless requested or a material
  test limitation needs explanation.
- Keep temporary output, generated data, build artifacts, and secrets out of Git
  unless the user explicitly requests a sanitized example.
- Do not inspect or poll remote CI, deployment jobs, or their status after a push
  or merge unless explicitly requested. When starting a run, provide its link
  without querying its status.
