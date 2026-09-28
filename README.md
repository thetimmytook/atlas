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
| `npm run build`                           | Compile the library to `dist/`                  |
| `npm run dev`                             | Watch TypeScript and recompile changes          |
| `npm run examples`                        | Serve the example on localhost                  |
| `npm run lint` / `npm run lint:fix`       | Check code / apply automatic lint fixes         |
| `npm run format:check` / `npm run format` | Check formatting / format files                 |

The pre-commit hook lints and formats staged files. Run the complete check before
requesting a commit. Original design sources and archives are excluded from formatting.

`src/index.ts` is an empty future entry point, not an implemented engine. TypeScript
uses ESM and browser types without ambient Node types. ES2022 is the provisional
type-checking baseline; it does not establish a browser compatibility guarantee or
a final compatibility target. The bundler-style module resolution describes how imports are
checked, without installing a bundler.

All dependencies are development-only. There is no runtime dependency, framework,
bundler, publishing configuration, minification, CI, or placeholder test command.
The package is private. Internal consumption and distribution will be configured
with the first real consumer; `dist/` currently provides local development output.

## Running the example

In VS Code, run the default build task (`Ctrl/Cmd+Shift+B`) or select `Atlas: dev`.
It builds once before starting the TypeScript watcher and static server. TypeScript
diagnostics appear in the Problems panel. Stop both background tasks with
`Tasks: Terminate Task` when finished.

Without VS Code, run `npm run build`, then `npm run dev` and `npm run examples`
in separate terminals. Open http://127.0.0.1:8080/examples/.
The page stays blank until example content is implemented; it imports `dist/index.js`.
Saved TypeScript changes recompile automatically; refresh the browser manually.
The server disables caching and binds to loopback only. It serves the repository root
so the example can import `dist/`; it is for local development, not deployment.

Output consists of unbundled ES2022 modules, declarations, and source maps. Use explicit
`.js` (or `.mjs`) extensions in relative source imports so emitted imports work directly
in the browser. Avoid bare package imports without a browser resolution strategy.
Compilation errors prevent new output; any previous successful output remains.
TypeScript does not remove output for renamed/deleted source files: remove `dist/`
and rebuild when cleaning up those files. Generated output is ignored by Git.

See [AGENTS.md](AGENTS.md) for repository conventions and
[the setup notes](docs/TOOLING.md) for the reference and scope.
