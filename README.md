# Atlas

Renderer-independent interactive map engine.

The project is currently in the design and prototyping stage.

Start with the [design overview](docs/DESIGN_MAIN.md) for accepted decisions,
topic documents, open questions, and the agreed prototype scope.

## Development

Install development tools with `npm ci`, which also enables the pre-commit hook.
Node is needed only to run those tools. No project Node version is pinned; use a
version supported by the dependencies in `package-lock.json`. This setup was
checked on Node 20.19.6.

| Command                                   | Purpose                                         |
| ----------------------------------------- | ----------------------------------------------- |
| `npm run check`                           | Type checking, lint, and formatting checks      |
| `npm run typecheck`                       | Check browser TypeScript without emitting files |
| `npm run lint` / `npm run lint:fix`       | Check code / apply automatic lint fixes         |
| `npm run format:check` / `npm run format` | Check formatting / format files                 |

The pre-commit hook lints and formats staged files. Run the complete check before
requesting a commit. Original design sources and archives are excluded from formatting.

`src/index.ts` is an empty future entry point, not an implemented engine. TypeScript
uses ESM and browser types without ambient Node types. ES2022 is the provisional
type-checking baseline; it does not establish a browser compatibility guarantee or
a build target. The bundler-style module resolution describes how imports are
checked, without installing a bundler.

All dependencies are development-only. There is no runtime dependency, framework,
bundler, publishing configuration, minification, CI, or placeholder test command.
The package is private. Internal consumption and distribution will be configured
with the first real consumer; this is not yet a built package.

See [AGENTS.md](AGENTS.md) for repository conventions and
[the setup notes](docs/TOOLING.md) for the reference and scope.
