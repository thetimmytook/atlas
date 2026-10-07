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

The earlier `@uniqueId` trial required an extra TypeScript pre-transform because
Vite preserved native decorator syntax. The
[ID handling decision](design/RUNTIME_AND_LOADING.md#id-handling--accepted-2026-10-06-implemented-for-review)
removes the registry and decorator experiments. The normal dev/build pipeline
needs no custom decorator transform or additional packages.

## Templates

A component imports its neighboring HTML with `?raw`. Vite embeds the string, including
its style block, in the library output. CSS remains isolated in Shadow DOM. The earlier
custom generator, generated `*.html.ts` files, HTML watcher, and http-server are removed.
No runtime request for an HTML template is necessary in the built library.
Templates are trusted source files, not a sanitizer for application data.

## Regression tests

Install development tools and the provider-managed Chromium build:

```sh
npm ci
npx playwright install chromium
```

On Linux, `npx playwright install --with-deps chromium` also installs required
system libraries (that part may need administrator permission). Browser binaries
are a local tool cache, not repository assets. Reinstall Chromium after changing
the locked Playwright version.

Run the two suites independently:

```sh
npm test
npm run test:browser
npm run check
npm run build
```

`npm test -- camera` filters Node tests by filename. `npm test -- --watch` enables
Node watch mode; `npm run test:browser -- --watch` does the same for Browser Mode.
`npm run test:browser -- svg-renderer` filters the renderer suite. Repeat the
browser command to check stability; there are no test retries or arbitrary sleeps.

Vitest 4.1.11 uses the existing Node 20.19.6, Vite 8.3.1, and TypeScript 6.0.3
toolchain. The [Vitest 4 Playwright provider configuration](https://v4.vitest.dev/config/browser/playwright)
uses `@vitest/browser-playwright`, whose exact peer dependency is `vitest@4.1.11`;
the provider is therefore pinned to 4.1.11. Playwright 1.63.0 is also pinned and
requires Node 20 or later. Both additions are development dependencies; the
existing toolchain versions, runtime dependencies, and package-root exports are
unchanged. Both test configs avoid the declaration-build plugin.

Discovery is separate: `vitest.config.mts` runs Node tests under `tests/` while
excluding `tests/browser/`; `vitest.browser.config.mts` includes only
`tests/browser/**/*.browser.test.ts`, using Playwright and headless Chromium.
The shared test TypeScript project includes Playwright action types and the
existing HTML-import declaration for the real component template.

The 103 Node tests cover models, route editing, spatial queries, camera state,
and component load/lifecycle contracts using browser stand-ins.
The 29 browser tests add 16 direct `SvgRenderer` regressions and 13 focused
`MapElement` integrations. They use native SVG, registered custom elements,
Shadow DOM, ResizeObserver, image decoding, browser RAF, and provider clicks.
Small inline SVG backgrounds and an intentionally revoked local Blob URL keep
fixtures independent of external network resources.

Renderer tests call `render` explicitly and check coordinates, composition,
membership, surviving group/shape references, and CSS-pixel symbols. Component
tests wait for specific DOM assertions with a two-second timeout. Before-RAF
picking tests edit objects in the capture phase of a trusted provider
`pointerdown`, then record the still-old SVG during `objectclick`; edits and
picking therefore happen in one native task before the next RAF. No renderer,
document, SVG, ResizeObserver, RAF, or resource decoder is mocked. Test hosts and
listeners are cleaned after every test. Diagnostic screenshots and Vitest
attachments go into ignored `node_modules/.cache/`.

This headless desktop Chromium regression run does not establish the supported
browser matrix, mobile/touch behavior, accessibility, or performance targets.
Scene invalidation and bounded geometry-write assertions remain the next
optimization step; these tests currently protect results and surviving identity.

## Browser benchmark

`npm run bench:build` builds the standalone `examples/stress.html` production app
into ignored `dist/benchmark`; `npm run bench:preview` serves it at port 8081.
Build it after `npm run build`, which clears the library output directory.
`npm run bench:dev` is explicitly development mode. The browser performs all timing;
Node only builds/serves and captures source metadata. Benchmark source has its own
TypeScript/ESLint scope and is excluded by Vitest's `tests/**/*.test.ts` include.
Library mode still starts solely at `src/index.ts`, excluding benchmark code.
Mutation scenarios validate definition-derived SVG coordinates, ordered primitives,
root/owned-point membership, and picking through a spatial view retained before the
operation. Diagnostic picking also uses a separate focused camera to distinguish
changed objects in dense scenes. Preparation precedes timing and instrumentation
reset; validation follows both timing and recording of instrumentation metrics.
A mismatch invalidates the run. Historical baseline files remain unchanged; new
exports identify this harness revision through source hashes.
See [baseline method and limitations](performance/BASELINE.md).

## CI and built example smoke test

Project-check CI is approved on 2026-10-07. `.github/workflows/checks.yml` runs
on every pull request targeting `master` and every push to `master`, with no path
filters. One `Atlas checks` job uses Ubuntu 24.04, Node 24 LTS, and headless
Playwright Chromium, with a 20-minute timeout. Node 24 is a CI tooling choice,
not a consumer requirement or a project-wide Node version pin. The locked Vite,
Vitest, Playwright, ESLint, and lint-staged Node ranges all include Node 24.

The workflow uses the current official
[checkout v7](https://github.com/actions/checkout),
[setup-node v7](https://github.com/actions/setup-node), and
[upload-artifact v7](https://github.com/actions/upload-artifact) actions.
setup-node caches npm downloads using `package-lock.json`; `npm ci` still installs
from the lockfile. Permissions are `contents: read`; checkout does not persist
credentials. New changes cancel older runs of the same PR. No test retries,
continue-on-error, publishing, or deployment are configured.
See the [Node release schedule](https://nodejs.org/en/about/previous-releases)
for Node 24 LTS status and the [Playwright browser installation instructions](https://playwright.dev/docs/browsers)
for the Linux dependency installation.

To run the same checks locally, use Node 24 LTS and this order:

```sh
npm ci
npm run check
npm test
npx --no-install playwright install --with-deps chromium
npm run test:browser
npm run build
npm run bench:build
npm run test:e2e
```

On macOS, use `npx --no-install playwright install chromium` instead of the
Linux installation command. `bench:build` builds both benchmark pages; CI never
runs performance measurements or enforces performance thresholds.

`npm run test:e2e` builds the existing `examples/index.html` with the small
`example.config.mts` into ignored `dist/example`, then runs one Node/Vitest test
using the existing Playwright library. It adds no runner or dependency.
`npm run build:example` is also available separately. Library build configuration
is unchanged; build the library first because it clears `dist/`. The example
build uses its source imports, bundles the real component and Factory background,
and contains no Vite development client. This is page/component integration
coverage; package-consumer and declaration coverage remain separate.

The test uses Vite's HTTP production preview API on loopback with an OS-assigned
port. It waits for the decoded-background loaded status and visible SVG objects,
clicks Zoom in and checks the rendered viewBox, clicks the known route checkpoint
and checks the external details panel, then clicks Move route point and checks
both the moved SVG point/route and the newly picked position in the panel.
Only DOM output and trusted mouse/button actions are used. Each wait has a bounded
timeout; uncaught page errors and error-level console messages fail the test.
Nested cleanup closes the browser and preview server on success and failure.
Node test discovery explicitly excludes `tests/e2e/`; the e2e config includes only
`tests/e2e/**/*.e2e.test.ts`. Run `npm run test:e2e` twice sequentially to verify
repeatability without fixed ports or leftover processes.

On browser-test failure, Vitest retains screenshots and Playwright traces under
`node_modules/.cache/browser-tests/`, with attachments under
`node_modules/.cache/vitest-attachments/`. On e2e failure after page setup, the test
writes `page.png`, `trace.zip`, and `errors.json` under `node_modules/.cache/e2e/`;
it clears old e2e diagnostics before each run. CI uploads `browser-diagnostics`
for seven days only when browser/e2e fails and diagnostic files exist. Setup/build
failures without these files are diagnosed through the job log. Open traces with
`npx --no-install playwright show-trace <path-to-trace.zip>`.

The workflow alone does not prevent merging. After the first GitHub run, configure
branch protection for `master`: enable **Require status checks to pass before
merging**, add the exact check **Atlas checks** (source: GitHub Actions), and enable
**Require branches to be up to date before merging**. Require PRs and disallow
bypassing these requirements if the gate must apply to administrators too. Bring
PR branches up to date by merging `master`, preserving repository history.
See [GitHub's protected-branch documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
Repository settings are managed separately; this workflow does not change them.

This checks one desktop Chromium environment on Linux. Firefox, WebKit,
mobile/touch, accessibility, the full supported-browser matrix, and performance
remain separate validation work. Local macOS results do not confirm a GitHub Linux
run; action execution and Linux system dependencies need the first real CI run.

## Deferred

Framework adapters, workspace splits, package distribution/exports,
minification, publication, deployment, and release automation remain outside the current scope. There is no
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
