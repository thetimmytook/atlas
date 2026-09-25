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
- Add packages and abstractions only when they have a concrete consumer.

## Tooling

- The development toolchain, package manager, runtime versions, and browser
  support targets remain undecided. Do not select them by copying another
  project's setup; discuss them with the user first.
- Prettier configuration is retained as a formatting reference. Dependencies
  and hooks are deferred. Preserve original and archived source documents.
- Run checks appropriate to the change before committing. Do not add placeholder
  test or build scripts that report success without checking anything.
- Evaluate linting and type-checking tools when choosing the implementation stack.
  Do not copy another project's React, API, or deployment configuration into the engine.

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
