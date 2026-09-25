# Atlas

Renderer-independent interactive map engine.

The project is currently in the design and prototyping stage.

Start with the [design overview](docs/DESIGN_MAIN.md) for accepted decisions,
topic documents, open questions, and the agreed prototype scope.

## Development

Use Node.js 24 or newer and npm. Run `npm ci` to install development tools and
enable the pre-commit formatting hook. Run `npm run format:check` to check
formatting or `npm run format` to apply it.

Repository conventions are in [AGENTS.md](AGENTS.md). These tooling settings do
not define the engine's eventual browser or runtime requirements.
