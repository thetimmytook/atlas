# First Atlas prototype

Current public baseline: [Current contract](CURRENT_CONTRACT.md), checked against
merged `a5be046` on 2026-10-09. Polygon PR #30 and the route-membership/gesture fixes
(PRs #33–34) are merged. Batch subsequently merged in
[PR #38](https://github.com/thetimmytook/atlas/pull/38). The user confirmed the first
material slice merged in [PR #39](https://github.com/thetimmytook/atlas/pull/39).
The user confirmed the first label preparation step merged in
[PR #40](https://github.com/thetimmytook/atlas/pull/40).
Point visual labels are merged in PR #41 (`33a6a11`). Line/route labels and the
white outline are merged in PR #42 (`bd8b508`), confirmed by the user. Polygon labels
are merged in PR #43 (`69c0006`). Representative materials/labels measurements
are merged in PR #44; the updated platform plan is merged in PR #45 (`59fe8ff`).
Visual labels cover all current object kinds. The first bounded automated engine
slice is recorded in the [cross-browser report](../validation/CROSS_BROWSER_2026_10_20.md).
Physical devices, installed desktop browsers, full scenario cards and keyboard/focus
contracts remain open. The separate [focused zoom profile](../performance/ZOOM_PROFILE_2026_10_20.md)
records the representative scripted-camera follow-up, with no engine change or
numerical acceptance gate. Older review-stage sections below retain dated implementation/validation history.

Current label decisions and open questions are recorded in
[Properties and labels](PROPERTIES_AND_LABELS.md#label-content-and-appearance--accepted-separation-2026-10-16).

Scope clarification accepted on 2026-10-16: the next label stage uses a built-in
object property and material appearance group. General registration of new visual
properties and behaviors moves to a separate next stage. This supersedes the older
label-registration example in the historical sequence and proposed extension
criterion below. Existing selection-property registration remains available.
After reviewing the nested `label.font` signatures, the user requested the bounded
preparation step below. A subsequent explicit request authorizes the bounded point
visual step recorded here. The subsequent explicit line/route request is implemented
below. The subsequent explicit polygon-label request is implemented here.

## Portable engine validation — implemented for review, 2026-10-20

`chore/cross-browser-validation` starts at fetched `origin/master` `59fe8ff` in the
main checkout, with a clean initial working tree. `npm run test:platform` uses the
existing Vitest/Playwright, builds Factory/Buildings once, serves a frozen copy and
runs Chromium, Firefox and WebKit sequentially in fresh scenario contexts. The
separate config and Node exclusion keep ordinary tests/E2E/Chromium-only CDP tests
and CI unchanged. Runtime, public API, dependencies and lockfile are unchanged.

The bounded slice covers loading/resize/zero-size recovery, native drag/wheel and
scroll/layout coordinates, independent floors/source identity, SVG/PNG decoding,
rendered sample colors/rectangles, material/load preservation, analytic four-kind
labels/fallback/origins/typography, native label-only/overlap/clipped hits, before-RAF
nested batch, stale captures, removal/reconnect and one shared object in two maps.
The [dated report](../validation/CROSS_BROWSER_2026_10_20.md) contains actual engine
versions, source/build identity, every subcase result and regression results;
[Tooling](../TOOLING.md#opt-in-portable-engine-validation) contains reproduction steps.
Each pass applies only to its named subcase. Real Safari/iPhone, installed Chrome/Edge,
physical multitouch/orientation/cancellation, full acceptance cards, accessibility
and performance acceptance remain separate. No benchmark/profiling or numerical
threshold is introduced. The user authorized commits and PR publication on
2026-10-20; the dated capture metadata retains its original pre-commit state.

## Polygon labels — implemented for review, 2026-10-19

Work starts from current `origin/master` at `bd8b508`, the merge of path labels in
PR #42, on `feat/polygon-labels` in the main repository, without a worktree. The
initial working tree was clean. No commits, push or PR are requested for this step.

`src/spatial/polygon-label-position.ts` computes each existing convex cell's area
centroid and their area-weighted union centroid, with membership checking and the
first largest-cell fallback. Local XY translation, independent axis scaling and
relative area weights support accepted small/large and thin polygons without raw
area overflow/underflow. Existing `PolygonGeometry` cells supply displayed geometry;
no source mutation, retriangulation, union reconstruction or runtime points/IDs are
introduced. Flat/extruded labels share the same XY rule, with positive-area and
vertical appearance eligibility, direct-membership priority and no height displacement.

`scene-geometry.ts` updates attachments through existing root/layer dependencies on
geometry/membership edits before picking, including batch. Text/material-only changes
do not recalculate area. Polygon materials resolve common font/color inheritance
with centered origin and zero offset after inheritance, leaving own declarations
and immutable snapshots unchanged. `ObjectLabels` / `ObjectLabelView` supply existing
measurement/cache/typography and outline-aware rectangles to SVG and spatial picking.
Geometry changes reuse unchanged metrics. SVG retains owner/path/text nodes across
direct/clipped entry switches. Labels follow fills in normal composition, extend
whole beyond contour/intersection bounds, and clip at the viewport.

Initial/captured hits share the entry geometry/label test. Polygon captures check
only the original owner/layer's current appearance, retaining valid direct/clipped
switches and suppressing stale hits without selecting underneath. Point/path capture
semantics remain covered. Existing scene queues handle removal/reattachment, shared
objects and disconnect/reconnect. No public API/dependency or typography tracking
mechanism is added; the accepted CSSOM/media boundary remains unchanged.

Node regressions cover independently known rectangle/trapezoid centroids, unequal
areas, concave/outside fallback and deterministic ties, disconnected clipped regions,
direct priority, no positive area, winding/translation, extreme scales/aspect ratios,
local invalidation, source identity and stale reattachment. Material inheritance
regressions now include polygons. Real-SVG/browser objectclick tests cover defaults,
all origins, literal spaces/outline, px/rem/zoom, flat/extruded per-layer regions,
fallback, outside-contour/bounds and viewport clipping, composition/duplicate IDs,
immediate/batch edits, disappearing/returning appearances, local DOM/metrics reuse,
node preservation, shared maps/reconnect and valid/obsolete press/release captures.

The Buildings example labels its existing extruded polygon `Shared zone`, with no
new UI controls. Review files are the position helper, scene/material/view/SVG/spatial
integration, `tests/polygon-label-position.test.ts`, `tests/label-materials.test.ts`,
`tests/browser/polygon-labels.browser.test.ts`, `examples/buildings.ts` and these topic
documents/main index.

Final validation on 2026-10-19:

- `npm run check` passes: type checking/formatting succeed, lint has zero errors
  and the existing 35 advisory warnings.
- `npm test` passes all 468 Node tests in 21 files, including 18 polygon-position
  cases and polygon coverage in the three shared material inheritance cases.
- `npm run test:browser` passes all 323 Chromium tests in 11 files, including 64
  new polygon-label cases and the complete existing point/path suites.
- `npm run build` succeeds; API Extractor retains its existing bundled-TypeScript
  5.9.3/project-TypeScript 6.0.3 advisory.
- `npm run test:e2e` builds both examples and passes all 23 tests in two files.

`npm ci` installed the existing locked tools without dependency/lockfile changes.
Sandbox restrictions required escalation for fetching/creating the requested Git
branch, enabling the Husky hook after install, and local browser/E2E servers
(`listen EPERM`). All required checks subsequently completed. Changes remain
unstaged, with no commits, push or PR.

Visual labels for all current kinds are complete for review. No benchmark or platform acceptance run is
part of this step. Next: representative measurements with materials/labels, then
platform acceptance. Text fitting/collision avoidance, multiline, zoom visibility,
3D label depth and general visual registration remain outside the current scope.

## Path-label review fixes — implemented for review, 2026-10-19

Both supplied findings were reproduced before correction. Removing a route and
synchronizing the scene left cached label attachments behind: reattaching an empty
direct route retained its old label/hit area, and reattaching an old single fragment
as two clipped fragments retained two labels. Root appearance removal now clears
its label positions before cached entries can be reused. Node and real-SVG browser
regressions cover removal synchronized by a query or painting, empty reattachment,
fragment splitting, label counts and clicks at the obsolete/current positions.

Finite coordinates could overflow a segment length or the total projected length,
producing NaN or no attachment. The label helper now rescales relative lengths on
overflow and interpolates without an overflowing endpoint difference, preserving
exact endpoints. Ordinary finite lengths keep their existing calculation so tiny
displacements at a large constant coordinate are retained. Node regressions cover
opposite extreme endpoints, diagonal norms, accumulated-length overflow, asymmetric
routes, exact fragment boundaries and tiny displacements. No public API, geometry
contract or text-measurement behavior changes.

Validation after the review fixes: `npm run check` passes with zero errors and the
existing 35 warnings; all 447 Node tests, 259 Chromium browser tests and 23 E2E
tests pass. `npm run build` succeeds with the existing API Extractor advisory.
The user approved committing and publishing the complete implementation, including
these fixes, on 2026-10-19.

## Label contrast follow-up — implemented for review, 2026-10-19

The user requested a light outline because dark text disappears on dark map areas.
Point/line/route text now paints a white 3 CSS-pixel outline with round joins before
its existing fill. The outline stays constant through camera zoom, does not shift
origin/offset or remeasure text, and expands the picking rectangle by 1.5 CSS pixels
per side. All appearance defaults now live in `src/objects/material-defaults.ts`:
material resolution imports `DEFAULTS`, and layout/SVG share its `labelOutline`
color/width/join/paint-order settings. No separate outline constant or inline style
defaults remain. No public API or material declaration field is added. The user
approved publishing this follow-up together with path labels.

Follow-up validation: the main browser suite passes all 256 tests in ten files
(`npm run test:browser -- --exclude '**/review-scratch*'`); `npm run build`, including
all TypeScript checks, succeeds with the existing API Extractor advisory.
The final `npm run check` passes with zero errors and the existing 35 warnings.
This follow-up is included in the complete implementation approved for publication.

## Line and route labels — implemented for review, 2026-10-19

`feat/path-labels` starts from current `origin/master` at `33a6a11`, the merge of
point labels in PR #41. Work uses the main repository, with no worktree. The initial
working tree was clean. The user requested committing and publishing the complete
implementation after the review fixes and contrast follow-up.

Line/route materials reuse point label inheritance/defaults. One attachment per
runtime owner/layer uses the displayed line midpoint or half the summed displayed
route XY length, excluding invisible gaps and choosing the first exact boundary.
Zero projected length uses the first displayed position; absent geometry has no
label. Empty/singleton routes and direct-membership priority remain supported.
Scene preparation owns the DOM-independent calculation and existing dependencies
invalidate only affected paths. No runtime points, IDs or connector geometry are
created at cuts. Separate instances with the same ID keep their own labels.

The existing browser label pipeline is renamed to `ObjectLabels` / `ObjectLabelView`
and reused for metrics, typography notifications, origin/offset and px/rem. Numeric
text layouts are independent of geometry attachment, so moving/reclipping/editing
a path never remeasures unchanged text/font. The last route fragment hosts the text
after all owner geometry and before owned points/following roots; fragment/direct
membership reconciliation transfers a surviving text node. SVG and spatial picking
use the same current attachment and rectangle. Path labels select their owner and
hit layer; owned-point pickability and route context retain their existing behavior.
Captures revalidate their original owner/layer after synchronous handlers without
picking underneath. Paths use current fragments of that same owner/layer, retaining
valid captures when a host changes and suppressing obsolete ones; point context
eligibility is unchanged. Shared maps, batch, reconnect and immutable snapshots retain their contracts.

Factory now shows `Crossing` and `Patrol route` beside the existing point labels,
without new controls. Existing benchmark instrumentation forwards the additional
internal geometry read; no benchmark is run or performance claim added.

Node regressions cover full/clipped lines, unequal route segments, excluded gaps,
source order/exact fragment boundaries, zero XY transitions, absent/singleton paths,
source/runtime identity and local geometry invalidation. Membership reconciliation
retains unchanged path attachments, including when another path moves in the same
synchronous edit group. Material inheritance tests
now run for point, line and route. Browser regressions use actual SVG rectangles and
objectclick, native clicks plus same-turn synthetic input for edits before RAF,
independent expected anchors, all nine origins, zoom/pan, literal text/whitespace,
fragment/layer/duplicate-ID composition, visibility/viewport, topology/clipping/
membership changes inside batch, metric reuse/local SVG mutations, shared maps,
reconnect and obsolete press/release captures. All existing point tests are retained.

Final validation on 2026-10-19: `npm run check` passes with zero errors and the
existing 35 advisory warnings; `npm test` passes 437 Node tests in 20 files;
`npm run test:browser` passes 255 Chromium tests in ten files, including 63 new
path-label cases and all 47 point-label cases; `npm run build` succeeds with the
existing API Extractor TypeScript 5.9.3/project 6.0.3 advisory;
`npm run test:e2e` passes all 23 tests in two files. Browser/E2E local servers
required sandbox escalation after `listen EPERM`. `npm ci` installed the existing
tools; the pre-commit hook was enabled separately after sandbox restrictions on
Git config. No dependency or lockfile change was needed.

**Retained prototype limitation:** arbitrary CSSOM and non-viewport media changes
that leave the typography probe unchanged and emit no supported notification can
wait for the next ordinary render or picking query. That query reads current root
font size/container family synchronously. No CSS-rule traversal, media subscriptions,
interception, polling, permanent RAF or refresh API is introduced.
Polygon labels remain the next visual step. Collision avoidance, zoom visibility,
multiline, visual-extension registration and broader mobile/browser acceptance are
outside this change.

Review files: `src/spatial/path-label-position.ts`, `src/spatial/scene-geometry.ts`,
`src/spatial/object-label.ts` (renamed from `point-label.ts`), `src/spatial/spatial.ts`,
`src/components/map-element/object-labels.ts` (renamed from `point-labels.ts`),
`src/components/map-element/map-element.ts`, `src/objects/map-materials.ts`,
`src/objects/map-model.ts`, `src/renderers/svg/svg-renderer.ts`,
`src/renderers/svg/svg-renderer.utils.ts`, `tests/path-label-position.test.ts`,
`tests/label-materials.test.ts`, `tests/browser/path-labels.browser.test.ts`,
the import/mock/geometry adapters in `tests/map-element.test.ts`,
`tests/browser/point-labels.browser.test.ts`, `tests/browser/materials.browser.test.ts`,
`examples/prototype-bench.instrument.ts`, `examples/stress.instrument.ts`,
`examples/index.html`, this document, `PROPERTIES_AND_LABELS.md`,
`RENDERER_AND_COMPONENT.md`, `CURRENT_CONTRACT.md` and `../DESIGN_MAIN.md`.

## Point labels — implemented for review, 2026-10-16

The working branch `feat/point-labels` starts at `aa06446`, the merge of PR #40.
The three pre-existing document edits recording that merge are preserved. After
the local implementation and independent review follow-ups below, the user
requested PR publication on 2026-10-16. Material resolution, point visuals and
the documentation are prepared as separate commits.

Standalone and route-owned points now render safe literal single-line labels with
preserved spaces, all nine origins and zoom-independent px/rem typography/offsets.
Label/font inheritance is field-based, offset is atomic, and defaults are internal;
container font family remains map-specific. Symbols circle/image/none all work.
Empty/whitespace-only/undefined labels retain their stored value and have no visual
or label hit area. Labels follow each owner's layer appearance, extend beyond
intersection bounds, and stay immediately after their own geometry in composition.

The view measures hidden SVG text and supplies neutral screen-pixel rectangles to
spatial queries. Queries refresh dirty text/material/typography independently of
paint and use live point positions, preserving effective pickable and captured-hit
rules. Text edits have a separate local queue; material descendants use existing
consumer invalidation. Measurements are reused across a point's appearances in one
map, while different maps retain their own container fonts. Position/pan/zoom and
color/offset-only edits reuse metrics. Browser typography uses a rem/text ResizeObserver
probe, style/load/resize observers and font-set completion events, with synchronous
computed root/family refresh before every render and picking query. Disconnect releases browser subscriptions and
helper nodes; reconnect refreshes missed font/style changes. Scene replacement
resets the per-scene caches without changing immutable load snapshots.

Factory now includes `Entry` on the standalone marker and `Checkpoint` on the
route-owned point, with no new controls. Node regressions cover the material chain,
atomic offsets, defaults, frozen own values and retained snapshots. Real-SVG browser
regressions cover appearance, alignment, fonts/rem, composition/clipping, rectangular
picking, immediate batch updates, shared roles/maps, reconnect, local mutations,
node reuse and obsolete press/release hits. Tests use RAF or observable browser
events, with no arbitrary sleeps or fixed system-font width assumptions.

Initial validation on 2026-10-16: `npm run check` passes with zero errors and the existing
35 advisory warnings; `npm test` passes 418 Node tests in 19 files;
`npm run test:browser` passes 178 desktop Chromium tests in nine files (33 new
point-label scenarios); `npm run build` produces the library/bundled declarations;
`npm run test:e2e` passes all 23 existing built-example/native-input tests in two
files. The E2E surface selectors now exclude the hidden measurement SVG. Browser
and E2E servers required sandbox escalation after local `listen EPERM`.
API Extractor retains its bundled-TypeScript 5.9.3/project-TypeScript 6.0.3 advisory.

The first review correction on 2026-10-16 explicitly fixes horizontal writing mode
on both SVG text paths and tracks inherited probe text width. Stylesheet load and
window resize refresh typography; ancestor observation crosses nested shadow hosts
and assigned slots. Regression cases retain vertical-rl/vertical-lr, stylesheet
completion, viewport media, CSSOM changes that resize the probe, nested open/closed
Shadow DOM and slot inheritance. Lifecycle checks include removing font/load/resize
listeners. The private spatial helper is named `#hitTestEntry`; initial
picking and captured-hit revalidation still share it unchanged.

Validation before the independent review follow-up on 2026-10-16: `npm run check` passes with zero errors
and the existing 35 warnings; all 418 Node tests, 186 Chromium browser tests
(41 point-label scenarios) and 23 E2E tests pass. `npm run build` succeeds with the
existing API Extractor TypeScript-version advisory. At that review, changes remained
unstaged and the pre-existing index was preserved, with no commits, push or PR.

The independent review follow-up keeps `text-anchor: start` and `text-transform:
none` on both displayed and measurement SVG text, alongside horizontal writing mode.
Cached labels retain literal case, origin/offset placement and picking alignment
after container text CSS changes, including later remeasurement. The recursive
stylesheet/media traversal and its subscriptions are removed. Empty maps do not
read CSS-rule or stylesheet collections; no global CSS manager, CSSOM interception,
polling or persistent RAF loop replaces that work.

**Accepted update boundary:** ResizeObserver probe changes, document font completion,
observed container/ancestor style/class changes, stylesheet DOM/load events, window
resize and reconnect refresh automatically. Arbitrary CSSOM and non-viewport media
changes with unchanged probe dimensions and no supported notification need not
render automatically while idle. A Latin probe can miss changed Cyrillic label
metrics. The next ordinary render or picking must synchronously read current root
font-size/container family and update the affected metrics/layouts; queries do not
drain deferred paint. There is no public refresh API or complete automatic CSSOM
tracking promise. Tests cover both next-render and next-query recovery, including
real Cyrillic SVG reference measurements and owner objectclick at rectangle edges.

Independent follow-up validation on 2026-10-16: `npm run check` passes with zero
errors and the existing 35 warnings; `npm test` passes 418 Node tests;
`npm run test:browser` passes 192 Chromium tests, including 47 point-label cases;
`npm run build` succeeds with the existing API Extractor TypeScript-version advisory;
`npm run test:e2e` passes all 23 existing tests. Real SVG/objectclick regressions
cover cached anchor/transform changes, later remeasurement, both render/query
recovery paths and Cyrillic text whose Latin probe stays unchanged. Three empty
maps with 500 unrelated CSS rules make zero accesses to application stylesheet/
CSS-rule collections. No benchmark or new public API is added. During that follow-up,
the pre-existing index and unrelated unstaged edits, including `#hitTestEntry`, were
preserved; the fixes remained unstaged, with no commits, push or PR before the
subsequent publication request.

Review files: `src/validators/material.validator.ts`, `src/objects/map-materials.ts`,
`src/objects/map-object.ts`, `src/objects/map-model.ts`,
`src/spatial/scene-invalidation.ts`, `src/spatial/scene-geometry.ts`,
`src/spatial/point-label.ts`, `src/spatial/spatial.ts`,
`src/components/map-element/point-labels.ts`, `src/components/map-element/map-element.ts`,
`src/renderers/svg/svg-renderer.ts`, `src/renderers/svg/svg-renderer.utils.ts`,
`tests/label-materials.test.ts`, `tests/map-element.test.ts`,
`tests/browser/materials.browser.test.ts`, `tests/browser/point-labels.browser.test.ts`,
`tests/e2e/example.e2e.test.ts` (select the display SVG rather than hidden measurement SVG),
`examples/index.html`, this document, `PROPERTIES_AND_LABELS.md`,
`RENDERER_AND_COMPONENT.md` and `../DESIGN_MAIN.md`.

At that point step, remaining line/route/polygon labels retained their prepared fields and the accepted
midpoint/projected-length/visible-centroid rules. Collision avoidance, zoom
visibility, multiline, general visual registration and broader browser/mobile
acceptance remain separate work. No new benchmark or performance claim is added.

## Label preparation — implemented for review, 2026-10-16

Preparation passed final acceptance on 2026-10-16 and subsequently merged in
PR #40, as confirmed by the user.

The first mini step adds five package-root type exports (`LabelLength`,
`LabelOrigin`, `LabelOffset`, `LabelFontProperties`, `LabelProperties`), common
object `label?: string`, runtime `MapObject.label` and material `label` declarations.
Typography is nested under `label.font`; flat font-prefixed fields are rejected.
See [accepted types and diagnostics](PROPERTIES_AND_LABELS.md#label-preparation--accepted-signatures-and-implemented-scope-2026-10-16).

Common attribute copying preserves text in all concrete constructors, loading,
root definition additions and route-owned point edits. Instance attachment retains
shared identity/text. Strings, including empty/space-only and literal HTML/Markdown,
are preserved without normalization. `undefined` removes runtime text; invalid
types and LF/CR/CRLF reject before mutation or successful `change` notification.
Every successful assignment, including the same value, emits existing `change`.

Material validation checks nested fields with exact diagnostic paths, finite decimal
px/rem strings, positive font sizes, complete offset pairs, nine origins, color,
family and weight. Label/font/offset copies are frozen, empty groups are retained
and own declarations never receive defaults. Whole-value replacement keeps the
existing material contract and immutable load snapshots. Selectors, reader
projections, shared consumers, collections and whole-image inheritance are unchanged.

The Node regressions exercise copying/input paths, notifications/shared objects,
failed-operation/map preservation, deep freezing, nested unknown/undefined fields,
strict length grammar (including TypeScript-accepted exponent/hex/whitespace inputs)
and runtime edits that leave load snapshots unchanged.
The review correction reads an input label getter once, then validates and copies
that captured value; constructor and resolved-snapshot regressions cover changing getters.

Validation on 2026-10-16: `npm run check` passes with zero errors and the existing
35 advisory warnings; `npm test` passes 415 Node tests in 19 files;
`npm run test:browser` passes all 145 existing desktop Chromium tests in eight files;
`npm run build` produces the library and bundled declarations. The browser run
required permission for the local Vitest server after sandbox `listen EPERM`;
the permitted run passed. API Extractor retains its existing bundled-TypeScript
5.9.3/project-TypeScript 6.0.3 advisory. No new label SVG/E2E scenarios, performance
measurements or broader platform acceptance are claimed.

**Boundary at preparation merge (historical; extended by the point step above):**
label/font inheritance per field was not implemented.
The next visual step resolves that chain and defaults; only offset is atomic.
Text measurement, browser fonts/rem, SVG composition, placement/clipping and label
picking remain separate work. No renderer/picking code, visual stubs, future
invalidation mechanism or general visual registration is added. The accepted
design decisions are retained alongside the bounded implementation.

## First material slice — implemented for review, 2026-10-12

After accepting the revised [public contract](MATERIALS_FIRST_SLICE_CONTRACT.md),
the user requested implementation. All five steps passed final acceptance on
2026-10-16 and subsequently merged in PR #39, as confirmed by the user. This section updates the
current stage while retaining the dated baseline/history below.

- `material-definition.ts`, the material/data validators and `AtlasMaterialError`
  add the serializable/type-only public contracts, copied own declarations, strict
  JSON boundary, graph/rule/reference checks and fixed diagnostics.
- `property-configuration.ts` implements accumulating/locking registrations and
  strict readers over frozen candidate projections. `material-consumers.ts` and
  `MapMaterials` preflight all map consumers without relying on DOM observation;
  route membership refresh stays local and preserves independent root use.
- Full-definition line/route construction, common data/material fields and the
  independent `pickable` override are wired through direct construction, load,
  root additions/attachments and route point edits. Material lookup/handles stay
  map-owned; edits update only selected consumers/descendants and retain load snapshots.
- Browser `image-resources.ts` prepares every SVG/PNG declaration and its intrinsic
  dimensions before replacement. Failure releases candidate resource URLs and
  retains the active map. Successful replacement releases old map-consumer links and
  image URLs, so retained handles do not constrain or invalidate the new map.
- The scene resolves per-map/per-role appearance shared by SVG and spatial queries.
  Style edits queue local appearance work independently of geometry/clipping.
  The renderer drains separate geometry/appearance sets, avoiding coordinate reads
  and serialization on color-only edits while applying both causes within batch.
  SVG keeps surviving groups/shapes, replacing a point child only for a symbol-kind
  switch. Picking and captured-hit revalidation update synchronously, including batch.
- Factory demonstrates an ordinary bend and an explicitly styled/pickable checkpoint.
  Benchmark fixtures explicitly request vertex circles/picking; comparison reference
  styles and checks follow the accepted removal of circle outlines. Historical
  measurements/artifacts remain unchanged; no new performance claim is made.

First-slice validation on 2026-10-12: 285 Node tests, 124 desktop Chromium browser tests and 23
built-example/native-input E2E tests pass, together with project checks and the
library/declaration build. New material suites cover registration/data strictness, graph/rule
precedence, parent edits, atomic shared membership/assignment, both point roles,
image dimensions/anchors/transparency, unused broken resources, stale handles,
local SVG mutations, immediate batch picking and reconnect. Broader browser/mobile
acceptance, labels, universal interactions/hit areas, background migration and the
full resource manager remain separate work.

Review corrections reject unknown material/resource/rule fields and `null` map
collections while retaining arbitrary application data keys. Focused regressions
count renderer coordinate reads for 1000-vertex routes/polygons and check combined
geometry/color batches in both assignment orders, plus active-map preservation
after rejected loads.

### Type/default/name refactor — implemented for review, 2026-10-16

The small follow-up preserves the accepted material behavior and remains in the
working tree, without commits, push or PR. `PointImage extends Partial<Size>` and
the exported plain-string `ImageResourceId` alias are used consistently for image
references, resource keys and prepared-image maps. `MapMaterials` centralizes its
existing defaults in one internal `DEFAULTS` object, keeps `appearanceFor` returning
`ResolvedAppearance` and leaves TypeScript configuration unchanged.

Internal weak links now use Consumer terminology in `material-consumers.ts`;
`#decrementObjectUsage` retains the same usage-count cleanup at zero. Preflight,
commit ordering and shared/disconnected consumers are unchanged. Public `pickable`
JSDoc and the [README](../../README.md)/[integration guide](../INTEGRATION.md) explain
explicit overrides, both role defaults and independent symbol/picking choices.
The guides now show current material/route examples and distinguish review from merge.

Validation on 2026-10-16: `npm run check` passes with 36 advisory warnings and no
errors; all 285 Node tests and 124 Chromium browser tests pass, together with the
library/declaration build, `git diff --check` and 203 local links in the seven
updated Markdown files (including anchors). The 2026-10-12 E2E result above is
historical and is not a new E2E run. Existing null/unknown-field, color-only
coordinate-read and mixed geometry/appearance batch regressions are retained.

### Final material acceptance — 2026-10-16

Independent review corrections reject explicit zero, negative and nonfinite SVG
dimensions even when a positive viewBox is available. A failed image preparation
now aborts sibling work immediately, releases candidate URLs and guards late
fetch/body/decode results. The original error and previous map are preserved;
a subsequent valid load succeeds. Focused regressions cover invalid dimensions,
late resolutions/rejections, URL cleanup and unhandled-rejection prevention.

Fresh acceptance passes 285 Node tests, 145 desktop Chromium browser tests and 23
built-example/native-input E2E tests, plus project checks (35 advisory warnings,
zero errors), library/declaration build and diff checks. Independent browser
reproductions confirm both corrections. Earlier dated counts above remain
historical; no new performance or broader platform acceptance claim is made.

## Synchronous nested batch — implemented for review, 2026-10-09

Subsequently merged in [PR #38](https://github.com/thetimmytook/atlas/pull/38).
The dated implementation and validation history below is retained.

The user confirmed the preceding measurements complete and accepted, then requested
implementation of the [agreed batch contract](RUNTIME_AND_LOADING.md#synchronous-nested-batch--accepted-contract-2026-10-09).
`MapElement.batch(callback: () => void): void` now defers only this component's
render scheduling. The outermost `finally` resumes existing RAF coalescing only
for accumulated work. Data, events and picking remain immediate, including nested
handlers; successful edits survive exceptions. Callback and returned-thenable
diagnostics use `INVALID_BATCH_CALLBACK` and `ASYNC_BATCH_CALLBACK`. Async continuations
cannot be cancelled or have their later errors intercepted by this diagnostic.

Implementation changes are limited to `MapElement`, a dedicated native Chromium
regression suite, native pointer/touch E2E checks, the Buildings example and its
built E2E scenario, plus these contract/status documents. Buildings has a combined action to edit the shared
zone's contour, base and height through batch. Application UI remains outside the engine.

The focused browser suite checks RAF scheduling inside
callbacks and on outer exit, actual SVG output, surviving nodes and exactly one
final point-transform write with no unrelated attribute writes. It also covers
nested change handlers, component picking before paint in a native pointer task,
exception identity/recovery, thenable/getter failures, async continuation limits,
empty/no-change batches, already scheduled work, disconnect/reconnect, shared
objects across two maps, root/layer membership, route topology, camera and polygon
shape/vertical changes. Loading and ResizeObserver settle before counting requests;
test waits bypass the component RAF counter.

### Validation on updated master

The branch was fast-forwarded from `bc87449` to `a5be046` (`origin/master`) before
reapplying only batch changes. PR #31 contract consolidation, PR #35 integration
guidance and the merged route-topology/pointer corrections (PRs #33–34) are retained.
The following commands passed sequentially on the updated base on 2026-10-09:

1. `npm run check`: type checking and formatting passed; zero lint errors and 34
   advisory warnings in existing benchmark/test files.
2. `npm test`: 230 Node tests across 16 files.
3. `npm run test:browser`: 106 Chromium tests across seven files, including 26 batch
   regressions. The added integration case checks route-local topology invalidation
   with immediate picking, deferred painting and no unrelated geometry reads or SVG writes.
4. `npm run build`: library and bundled declarations built successfully. API Extractor
   retains its bundled-TypeScript 5.9.3/project-TypeScript 6.0.3 advisory.
5. `npm run test:e2e`: 23 tests across two files, including the built Factory/Buildings
   scenario and native pointer/touch checks. Two new cases verify second-pointer
   protection with a batched press handler and press eligibility rechecking after
   a synchronous handler changes `clickTrigger` through batch.

The fresh public declaration contains `batch(callback: () => void): void`; a separate
TypeScript consumer verifies required function input, nested calls and the void result.
The platform acceptance plan and performance comparison already belong to the updated
master and are unchanged by the batch diff. No new performance measurements were run.

### Earlier validation on bc87449 — historical

Validation on the original base on 2026-10-09: `npm run check` (zero errors; nine advisory duplicate-string
warnings), `npm test` (223 Node tests), `npm run test:browser` (100 Chromium tests,
including the 25 new batch regressions), `npm run build`, `npm run bench:build` and
`npm run test:e2e` (one combined built Factory/Buildings scenario, including the
batch action and a 390 CSS-pixel viewport) passed. Library, benchmark and example
builds ran sequentially. The bundled public declaration contains exactly
`batch(callback: () => void): void`; a separate TypeScript consumer verifies the
callback input, nested calls and void result. API Extractor retains its existing
bundled-TypeScript version advisory; declaration generation and consumer checking pass.

These earlier results do not replace validation on the updated base. They are
separate from the historical polygon acceptance below. No new
timing measurements or speedup claim belong to this task. Existing saved benchmark
evidence remains unchanged.
The implementation was ready for pull-request review at this stage and
subsequently merged in PR #38.

## Repeat-review follow-up — accepted, 2026-10-09

The polygon/extrusion implementation is merged in PR #30. The user accepted the
following triage of the [repeat solution review, findings 19–33](../archive/SOLUTION_REVIEW_2026_10_09.md).
The original report remains unchanged historical evidence; its proposed remedies
are not automatically accepted architecture or implementation requirements.

The sequence below records the accepted plan. The preceding measurements are now
complete and accepted; batch implementation proceeds after the merged corrections.

The original implementation sequence was:

1. **Prepare a representative scene and freeze its baseline (19, 30).** Extend load
   validation to deterministic 3000/5000-root workloads with several buildings,
   independently selected floors, spatial routes, polygons/extrusions, automatic
   intersection bounds and a realistically complex background. Record root and
   owned-vertex counts, layer/appearance counts, background dimensions/complexity,
   source and harness hashes, environment, raw samples and functional checks.
   Existing point/line/route and Leaflet results retain their narrower meaning;
   a new multi-floor Leaflet adapter is not required. Timing and instrumentation
   runs are separate. Animation-frame intervals measure callback cadence, not
   completed GPU rendering or display presentation. Numerical acceptance targets
   remain open; the new baseline alone does not pass the prototype load gate.
2. **Bound route-owned membership invalidation (20).** Adding, removing or replacing
   route points currently triggers global membership reconciliation and refreshes
   unrelated automatic appearances. Ordinary position edits already invalidate
   affected geometry locally. Distinguish a route's owned-point topology changes
   from root-collection/layer-membership changes; preserve immediate picking,
   subscription ordering, source identity and unaffected SVG nodes. A general
   scene rewrite, multi-view change log or new public event API is not required.
3. **Protect gestures and fix second-pointer press picking (23, 29).** A second touch
   over an object can currently produce an immediate `objectclick` and consume an
   otherwise valid pinch when `clickTrigger` is `press`. Keep the accepted first-hit
   press-consumes-gesture behavior and surface-event semantics. Add real browser
   coverage for pan, anchored wheel zoom, pinch, click suppression and cancellation
   cleanup. Pointer cancellation/lost capture do not become normal releases; a new
   application cancellation notification remains a separate public-contract decision.
4. **Repeat the same measurements after integration, then continue the agreed slice.**
   Compare the same source workloads, harness and environment. Use measured evidence
   to choose any further bounded corrections before batch, minimal materials and
   labels. Profile repeated load validation/copying (21) and input layout reads (24)
   before choosing optimizations. Several DOM reads do not establish several forced
   layouts. Preserve validation at public input boundaries and avoid persistent
   rectangle caches that become stale after scrolling or layout changes.

Current-contract documentation (22, 27, 31, 32) can proceed alongside the two fixes
after the baseline is captured. Separate implemented behavior, provisional
contracts, accepted but unimplemented design, and open/deferred decisions. Preserve
duplicate-ID semantics, `Point2`/`Point3`, complete-position replacement with omitted
z becoming zero, polygon x/y contours with independent vertical state, and the
current provisional single scene-change consumer. Do not infer a uniqueness
registry, mandatory multi-view architecture, exact-arithmetic rewrite, Node pin,
new pre-commit checks or warning policy from the report. Keep historical documents
and benchmark evidence linked rather than rewriting their results.

Parallel work in the primary checkout requires disjoint file ownership and no
concurrent branch switching, staging or commits. Performance runs use a frozen,
identified build without competing tests/builds; capture the baseline before
runtime fixes change that input. Serialize builds because their output directories
overlap, and perform final integrated validation after the agents finish editing.
Each task still needs concrete mini review; this plan does not authorize commits.

## Polygon and extrusion contract — accepted, 2026-10-09

The user confirmed that automatic intersections/z/clipping and the `Point2`/`Point3`
migration are merged. The polygon design below is also merged in PR #30: a horizontal `MapPolygon` with a
frozen x/y `Point2` contour and independent `baseZ`/`height` getter/setter pairs. All
vertex inputs reject the presence of z, including explicit undefined. Each vertical
setter validates the complete resulting state before mutation, including finite
`baseZ + height`. See the
[full accepted contract](GEOMETRY_AND_ROUTES.md#horizontal-polygons-and-vertical-extrusion--accepted-contract-2026-10-09).

Clipping drops every cell without positive x/y area. An appearance with no remaining
positive-area cells is absent from both display and picking. A temporary fill without
an outline is sufficient for this stage; obtaining external contours is required
geometry work before future outline support, independently of materials.

The implementation merged in PR #30 consists of three parts:

1. Flat polygon input/loading, frozen coordinate snapshots, atomic contour edits,
   SVG fill and picking of the original object/runtime layer.
2. Vertical extrusion and layer clipping: cached O(n²) ear clipping, convex-cell
   rectangle clipping, positive z overlap, half-open ownership and positive-area
   filtering. Disconnected regions share one appearance/path. Height-only edits
   reuse planar cells; unchanged SVG projection does not rewrite the path.
3. `examples/buildings.html`: two buildings with independent floor selection, one
   shared concave volume and a connecting spatial route. The application can move
   a corner or change base/height and inspect hit context. The existing Factory
   example and benchmark workloads remain intact.

No runtime package was added. Temporary translucent SVG fill names its intended
material replacement at the implementation site; external contours and outlines,
holes, nonhorizontal polygons and real 3D rendering remain outside this step.

Implementation files include `map-polygon-definition.ts`, `map-polygon.ts`,
`map-polygon.validator.ts`, `math/polygon.ts`, `polygon-clipping.ts` and
`polygon-geometry.ts`, plus explicit loading/collection, scene, SVG and spatial
dispatch. Existing benchmark types explicitly retain their point/line/route workload;
saved measurements are unchanged. The definition-only contract decision did not
itself authorize these changes; the later user instruction did.

Regressions cover invalid input and z properties, winding/collinear source vertices,
triangulation area, disconnected U cuts, zero-area cells beside valid cells, fill
boundaries, adjacent floors, original identity, live invalidation, atomic load,
captured-hit revalidation, hidden/disconnected/detached edits and unchanged SVG nodes.
Validation on 2026-10-09: `npm run check` (no errors; advisory duplicate-string
warnings remain), `npm test` (223 Node tests), `npm run test:browser` (75 Chromium
tests), `npm run build`, `npm run bench:build`, and `npm run test:e2e` (one combined
built Factory/Buildings scenario, including a 390 CSS-pixel viewport). Public bundled
declarations include the accepted `MapPolygonDefinition` and `MapPolygon` signatures.
The orientation fallback uses a power-of-two scale to preserve exact collinearity
without a snapping tolerance. Regressions reject the zero-area contour
`(0,0), (1,33), (6,198)` and pick `(1,11)` on the allowed edge of
`(0,0), (7,77), (-11,1)` in both winding directions, alongside extreme finite
coordinate cases.

No new performance measurements were produced. The user authorized commits, push
and PR preparation on 2026-10-09.

<a id="coordinate-migration--implemented-for-review-2026-10-09"></a>

## Coordinate migration — merged in PR #29, 2026-10-09

The z/intersection implementation now separates frozen `Point2(x, y)` and
`Point3(x, y, z = 0)`. The former `Point` export/file is removed, without an alias.
Runtime `MapPoint.position` returns `Point3`; definitions and assignment accept
`Point2 | Point3` and plain x/y input. Construction, loading and owned-point editing
copy into `Point3`. Camera, events, conversions and planar queries use `Point2`.
See the [public signatures](GEOMETRY_AND_ROUTES.md#planar-and-spatial-coordinates--accepted-and-implemented-for-review-2026-10-09).

Bounds use `Partial<Point3>`, preserving absent axes. The optional definition field
has no explicit undefined union; typed callers omit it, while an untyped JavaScript
regression retains explicit undefined support. The runtime getter still returns
`IntersectionBounds | undefined` without a setter. `resolveLayerEntries` replaces
the internal `resolveAppearance` name. Clipping, picking, direct-content priority,
invalidation, source identity, live coordinate views and unaffected SVG nodes retain
the automatic-stage behavior described below.

Implementation covers `src/math/point2.ts`, `src/math/point3.ts`, math/bounds exports,
point definitions/validation/runtime positions, camera and interaction consumers,
spatial geometry/queries, executable examples/benchmarks and existing regression
suites. Current design summaries record the new decision; archived documents and
saved timing results remain unchanged. The initial review preserved existing staged
contents and kept this migration unstaged. The user authorized commits, push and PR
preparation on 2026-10-09.

Validation on 2026-10-09: `npm run check`, `npm test` (178 Node tests),
`npm run test:browser` (68 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built Factory test) passed. Lint retains the eight
pre-existing duplicate-string warnings with zero errors. Bundled declarations
confirm mandatory `Point3.z`, distinct position getter/setter types, planar
conversions, the optional bounds input and getter without a setter or `Point` alias.

Existing boundary regressions still pass: a four-pixel stroke at zoom 1 hits the
included min tangent and points near excluded max when eligible interior positions
are within the hit disk; an excluded max-only tangent misses. Adjacent floor strokes
and vertical transitions remain pickable, with visible overlap resolved by composition.
Live views, source objects, surviving SVG nodes and invalidation counters retain their
existing checks. No full timing benchmark rerun or new timing artifacts were required.
The initial review confirmed an identical staged manifest before/after implementation.

<a id="automatic-height-and-intersection-stage--implemented-for-review-2026-10-08"></a>

## Automatic height and intersection stage — merged in PR #29

The user authorized implementation in the primary repository, with no worktree,
commit, push or PR. This stage preserves the merged explicit-layer/review base and
existing local merge/contract notes. The original 2026-10-08 version added optional
`Point.z`, normalized copied map-object positions and validated, frozen
`IntersectionBounds`. That version did not add a second public coordinate type or a
runtime bounds setter. The coordinate-type
decision is superseded by the 2026-10-09 migration above; the behavior below remains.

Every layer with bounds prepares automatic appearances of current roots, while
directly selected roots appear whole once. Bounds do not change `layer.objects` or
`objectIds`. Shared segment clipping retains original runtime identity and ordered
route fragments; SVG/picking share these entries. Cut coordinates create no runtime
points, symbols or separate point hit areas. See the [contract, example boundary
results and click rules](LAYERS_AND_INTERACTION.md#intersection-bounds-contract--accepted-and-implemented-for-review-2026-10-08)
and [preparation/invalidation counters](RENDERER_AND_COMPONENT.md#automatic-spatial-appearances--implemented-for-review-2026-10-08).

```ts
{
  objects: [{
    id: 'route', kind: 'route', points: [
      { kind: 'point', position: { x: 20, y: 100, z: 1 } },
      { kind: 'point', position: { x: 120, y: 100, z: 5 } },
      { kind: 'point', position: { x: 220, y: 100, z: 1 } },
    ],
  }],
  layers: [
    { id: 'lower', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
    { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
    { id: 'overview', objects: ['route'] }, // full direct appearance
  ],
}
```

Factory uses a common background, two independent z floor layers and one whole
route that rises and returns. It is not added to each floor's ID list. Original
vertices carry heights; an external button changes checkpoint height. The explicit
independent line remains whole in the first layer despite its bounds. Existing
camera, route/root editing and detached-edit controls remain in the application.
Click details include original object/route/layer IDs and x/y surface coordinates.

Validation: `npm run check`, `npm test` (176 Node tests),
`npm run test:browser` (68 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built Factory smoke test) passed on 2026-10-08.
Lint has zero errors and the eight pre-existing duplicate-string warnings. Bundled
public declarations were checked: the existing `Point` position type remains and
`MapLayer` exposes a getter for `IntersectionBounds` without a setter. Old 2D snapshot assertions now
explicitly check normalized z = 0; existing SVG primitive/coordinate/identity
assertions are retained. The previous unsupported-bounds regression now uses
invalid bounds and still checks atomic failure preservation.

Built benchmark functional checks also passed: all four stress Preview scenes
(3000/5000 roots, points/mixed), dense 3000/mixed Preview and sparse smoke for
Atlas SVG, Leaflet SVG and Leaflet Canvas. These use the existing SVG/picking/adapter
checks. No timing suite or new CSV/manifest exports ran; historical artifacts remain
unchanged. Library, benchmark and example builds were run in order because the
library build clears the common `dist` directory.

Limits: point/line/route geometry and axis-aligned bounds only; current vertex
symbols and four-pixel strokes remain temporary until materials/point interaction.
The SVG projection and camera remain 2D. Clipping traverses all segments of each
changed route; membership changes still reconcile layer/root candidates. Physical
mobile validation, volumetric zones, polygons, materials, labels, batch, LOD,
layer groups, editor, 3D and new performance measurements are outside this request.
Floating-point calculations use finite double-precision coordinates; this is not an
arbitrary-precision geometry engine.

### Files changed in the automatic stage

- Engine: [src/components/map-element/map-element.ts](../../src/components/map-element/map-element.ts), [src/definitions/map-definition.ts](../../src/definitions/map-definition.ts), [src/definitions/map-layer-definition.ts](../../src/definitions/map-layer-definition.ts), [src/index.ts](../../src/index.ts), [src/math/distance.ts](../../src/math/distance.ts), [src/math/intersection-bounds.ts](../../src/math/intersection-bounds.ts), `src/math/point.ts` (replaced by `point2.ts`/`point3.ts` in the migration), [src/objects/map-layer.ts](../../src/objects/map-layer.ts), [src/objects/map-point.ts](../../src/objects/map-point.ts), [src/spatial/clipped-appearance.ts](../../src/spatial/clipped-appearance.ts), [src/spatial/geometry.ts](../../src/spatial/geometry.ts), [src/spatial/intersection.ts](../../src/spatial/intersection.ts), [src/spatial/scene-geometry.ts](../../src/spatial/scene-geometry.ts), [src/spatial/spatial.ts](../../src/spatial/spatial.ts), [src/validators/intersection-bounds.validator.ts](../../src/validators/intersection-bounds.validator.ts), [src/validators/map-point.validator.ts](../../src/validators/map-point.validator.ts), [src/validators/point.validator.ts](../../src/validators/point.validator.ts).
- Application: [examples/index.html](../../examples/index.html).
- Regressions: [tests/automatic-layers.test.ts](../../tests/automatic-layers.test.ts), [tests/browser/intersection.browser.test.ts](../../tests/browser/intersection.browser.test.ts), [tests/browser/layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [tests/e2e/example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts), [tests/intersection.test.ts](../../tests/intersection.test.ts), [tests/layers.test.ts](../../tests/layers.test.ts), [tests/map-element.test.ts](../../tests/map-element.test.ts), [tests/map-model.test.ts](../../tests/map-model.test.ts), [tests/map-object-collection.test.ts](../../tests/map-object-collection.test.ts), [tests/map-point.test.ts](../../tests/map-point.test.ts), [tests/map-route.test.ts](../../tests/map-route.test.ts), [tests/spatial.test.ts](../../tests/spatial.test.ts), [tests/z.test.ts](../../tests/z.test.ts).
- Contract and status: [docs/DESIGN_MAIN.md](../../docs/DESIGN_MAIN.md), [docs/design/GEOMETRY_AND_ROUTES.md](../../docs/design/GEOMETRY_AND_ROUTES.md), [docs/design/LAYERS_AND_INTERACTION.md](../../docs/design/LAYERS_AND_INTERACTION.md), [docs/design/PROTOTYPE.md](../../docs/design/PROTOTYPE.md), [docs/design/RENDERER_AND_COMPONENT.md](../../docs/design/RENDERER_AND_COMPONENT.md), [docs/design/RUNTIME_AND_LOADING.md](../../docs/design/RUNTIME_AND_LOADING.md).

<a id="explicit-layer-first-stage--implemented-for-review-2026-10-08"></a>

## Explicit-layer first stage — merged in PR #28, 2026-10-08

Current status: merged, confirmed by the user on 2026-10-08 after the review fixes.

The authorized stage implements direct ID-based content, backgrounds, composition,
visibility and consistent picking on the existing invalidation foundation.
`map.layers` exposes runtime layers; stable `layer.objectIds.add/remove/has` controls
membership and `layer.objects` returns frozen current roots. Layers are mandatory,
without a default or flat compatibility layer. See the
[public contract](LAYERS_AND_INTERACTION.md#explicit-layers--accepted-and-implemented-for-review-2026-10-08)
and [renderer boundary](RENDERER_AND_COMPONENT.md#layer-display-and-invalidation--implemented-for-review-2026-10-08).

Factory now has a background-only layer and two independently toggled content layers
sharing one runtime route. Editing its point updates both displays; click details
identify the object, owning route when applicable, and hit layer. Existing dynamic
add/remove/detached-edit/restore controls use explicit ID membership. The built-example
e2e covers both appearances and picking after layer switches. Benchmark examples
are migrated to explicit content layers and select added IDs; historical measurement
artifacts remain unchanged. No new Atlas/Leaflet benchmark or speed claim is included.

The subsequent automatic `intersectionBounds`/z/clipping stage is merged in PR #29
above, preserving direct-content meaning, source geometry and runtime/event
identity. Bounds rejection was the first-stage boundary and is superseded. Volumetric zones, materials, labels, batch,
LOD, layer groups and public standalone model lifecycle remain later work. Physical
mobile and full prototype/load validation remain outstanding.

Validation on 2026-10-08: `npm run check`, `npm test` (130 Node tests),
`npm run test:browser` (57 Chromium tests), `npm run build`, `npm run bench:build`
and `npm run test:e2e` (one built-example smoke test) passed. Lint has no errors;
non-blocking duplicate-string warnings remain. Library declarations were also
inspected: runtime layer and ID-collection construction stays internal, with only
their types exported. The background-free replacement regression verifies display
after pending frames finish and unchanged camera center/zoom. Built stress Preview
with 3000 points, a short `position-single` Run and Atlas SVG sparse smoke also pass.
Post-review functional checks also cover sparse smoke for all three comparison
variants and all four stress Preview scenes. These are functional checks, not new
performance measurements.

### Files in this implementation review

The PR also includes the current Geometry and routes and Materials decisions.

- Runtime and loading: [src/components/map-element/map-element.ts](../../src/components/map-element/map-element.ts), [src/definitions/map-definition.ts](../../src/definitions/map-definition.ts), [src/definitions/map-layer-definition.ts](../../src/definitions/map-layer-definition.ts), [src/index.ts](../../src/index.ts), [src/interaction/object-click-event.ts](../../src/interaction/object-click-event.ts), [src/objects/map-layer-object-id-collection.ts](../../src/objects/map-layer-object-id-collection.ts), [src/objects/map-layer.ts](../../src/objects/map-layer.ts), [src/objects/map-model.ts](../../src/objects/map-model.ts), [src/renderers/renderer.ts](../../src/renderers/renderer.ts), [src/renderers/svg/svg-renderer.ts](../../src/renderers/svg/svg-renderer.ts), [src/renderers/svg/svg-renderer.utils.ts](../../src/renderers/svg/svg-renderer.utils.ts), [src/spatial/scene-geometry.ts](../../src/spatial/scene-geometry.ts), [src/spatial/spatial.ts](../../src/spatial/spatial.ts), [src/validators/layer-object-id.validator.ts](../../src/validators/layer-object-id.validator.ts).
- Application and benchmark input migration: [examples/comparison.adapter.ts](../../examples/comparison.adapter.ts), [examples/comparison.bench.ts](../../examples/comparison.bench.ts), [examples/comparison.leaflet.ts](../../examples/comparison.leaflet.ts), [examples/index.html](../../examples/index.html), [examples/stress.bench.ts](../../examples/stress.bench.ts), [examples/stress.check.ts](../../examples/stress.check.ts), [examples/stress.instrument.ts](../../examples/stress.instrument.ts), [examples/stress.scene.ts](../../examples/stress.scene.ts).
- Regressions and explicit-layer fixtures: [tests/browser/fixtures.ts](../../tests/browser/fixtures.ts), [tests/browser/layers.browser.test.ts](../../tests/browser/layers.browser.test.ts), [tests/browser/map-element.browser.test.ts](../../tests/browser/map-element.browser.test.ts), [tests/browser/svg-renderer.browser.test.ts](../../tests/browser/svg-renderer.browser.test.ts), [tests/e2e/example.e2e.test.ts](../../tests/e2e/example.e2e.test.ts), [tests/fixtures.ts](../../tests/fixtures.ts), [tests/layers.test.ts](../../tests/layers.test.ts), [tests/map-element.test.ts](../../tests/map-element.test.ts), [tests/map-model.test.ts](../../tests/map-model.test.ts), [tests/map-object-collection.test.ts](../../tests/map-object-collection.test.ts), [tests/scene-invalidation.test.ts](../../tests/scene-invalidation.test.ts), [tests/spatial.test.ts](../../tests/spatial.test.ts).
- Current contract and status: [docs/DESIGN_MAIN.md](../../docs/DESIGN_MAIN.md), [docs/design/LAYERS_AND_INTERACTION.md](../../docs/design/LAYERS_AND_INTERACTION.md), [docs/design/PROTOTYPE.md](../../docs/design/PROTOTYPE.md), [docs/design/RENDERER_AND_COMPONENT.md](../../docs/design/RENDERER_AND_COMPONENT.md), [docs/design/RUNTIME_AND_LOADING.md](../../docs/design/RUNTIME_AND_LOADING.md).

[Main navigation](../DESIGN_MAIN.md)

## Goal — agreed

Validate the idea, identify limitations, and clarify or determine the next steps.
Do not try to finish all design work in advance: the prototype should allow mistakes
and architectural corrections based on a working example.
A final public API and polished UI are not the goals of this stage.

## Scope — agreed

- One map with several buildings and layers, with local floor switching.
- Backgrounds, markers, lines, routes, and zones.
- Clipping validation, including vertical polygon extrusion.
- SVG renderer, camera, events, and an external description panel.
- Runtime objects, incremental updates, and batch.
- Minimal materials with explicit inheritance.
- Built-in labels, under the 2026-10-16 scope clarification. User-defined selection
  properties are already registered through application configuration; general
  visual-property/behavior registration follows as a separate stage.
- Desktop/mobile validation and loads of 3000/5000 objects.
- A complex behavior system, full editor, and 3D renderer are outside this stage.

## Expected outcome — agreed

Validated subsystem boundaries; identified limitations; necessary contract changes;
and a justified direction for the next steps.
Accepting this scope does not itself settle previously open signatures,
the layer-group contract, or the complete volumetric-zone schema.

## Revised implementation plan — solution review, 2026-10-06

Historical sequence, superseded for next work by the
[2026-10-09 follow-up](#repeat-review-follow-up--accepted-2026-10-09). Findings 5–18
refer to an earlier conversation; their original report is not stored here. The
accepted plan below preserves their context without making unavailable finding
numbers a prerequisite. Merged statuses are clarified where noted.

This replaces the earlier proposed sequence following solution-review findings 5–18.
The agreed prototype scope remains unchanged. The sequence is the working plan;
architecture details, new public signatures, ownership restrictions, and tooling
choices still require their own review. No implementation is authorized by this document.

The initial vertical slice is implemented: background, camera/input, points, lines,
routes, runtime edits, and application events. The next work must validate the risky
parts of the prototype rather than expand route editing or ID handling. Freeze further
route-operation and ID-API expansion; preserve existing behavior. Range replacement subsequently merged in PR #20; this plan itself did not approve
new route operations.

1. **Protect current behavior with focused tests (finding 15).** Choose the test runner
   and component-test environment as a concrete tooling step. Model/spatial/camera
   regression tests are merged: Vitest with the Node environment (77 tests).
   Component load/lifecycle contract tests using browser stand-ins are merged with
   the scene extraction in PR #23. Real-SVG Chromium coverage is implemented for
   review at that stage (subsequently merged in PR #24): 16 renderer tests and 13
   focused component integrations. See
   [browser coverage](RENDERER_AND_COMPONENT.md#browser-svg-regression-coverage--implemented-for-review-2026-10-06).
   This protects current results and surviving nodes before explicit invalidation;
   it does not validate mobile support or bounded geometry writes. Cover validation atomicity,
   route membership/order and surviving identity, immediate picking before render,
   stale-click suppression, detach/reconnect, reattachment during removal handlers,
   failed-load preservation, and camera behavior. Start with DOM-independent model,
   spatial, and camera tests; use component tests for browser-boundary behavior.
   These tests must run before and after the following refactors.
2. **Establish an early load baseline (findings 10, 16–18).** Add a reproducible stress
   example for 3000 and 5000 root objects, with documented point/line/route counts and
   owned-vertex counts. Measure initial load, mass additions/removals, pan, zoom,
   hit testing, and individual geometry edits. Record frame timing, SVG attribute
   writes, scene synchronization work, and repeated layout reads where useful.
   Record device/browser and distinguish synthetic desktop results from actual mobile
   measurements. Do this before optimization so the next steps have a comparison.
3. **Separate scene ownership from the browser view (finding 8).** Extract the current
   object collection, scene geometry, spatial queries, and their subscriptions into
   a DOM-independent model with a concrete consumer: the existing component.
   Keep camera, renderer, input, client-coordinate conversion, and browser lifecycle
   at the view boundary. Preserve atomic scene replacement after successful load.
   The bounded ownership extraction subsequently merged in PR #23 as internal
   `MapModel`; see the status below. Public model lifetime/exposure remains a separate
   decision. Multiple simultaneous viewports remain outside mandatory prototype scope.
4. **Make updates explicit and bounded (findings 9, 10, 17, 18).** Replace structural
   scans in geometry reads with explicit invalidation from root membership, route
   membership/order, and position changes. Select the simplest internal revision or
   dirty-state mechanism under review; a new public event payload API is not a
   prerequisite. Picking must still see current state before painting, including
   disconnected edits and synchronous handlers. Preserve surviving entries/nodes.
   Update SVG geometry only for affected objects; pan should update the view without
   rewriting unchanged object geometry, and zoom should update only the output that
   depends on screen scale. Address repeated membership scans, collection-copy costs,
   and layout reads using baseline evidence. Do not claim a Set alone fixes immutable
   array copying. Rerun the same load scenes and record before/after results.
5. **Validate layers, z, and clipping as the next feature (findings 6, 11).** First
   review the minimal scene/renderer contract with explicit layer object lists,
   optional bounds for automatic intersections, backgrounds,
   composition order, clipping, and picking eligibility together. Avoid cementing
   the current separate background argument or flat list as the final scene API.
   The [outer map structure](LAYERS_AND_INTERACTION.md#accepted-map-structure--2026-10-08)
   is accepted: common object definitions, a layers array, layer object-ID lists,
   layer backgrounds, and optional `intersectionBounds`. Omitted object lists are
   empty, layers start visible, unknown references reject loading, and references
   select all matching root instances. The first stage above settles mandatory
   explicit layers and direct runtime membership. Adding/removing/reordering layers
   remain outside that first stage. Direct-content priority subsequently merged
   with automatic appearances in PR #29.
   Build two buildings with independent floor selection, a connecting route, and
   a vertically extruded zone with slices. Validate that clipping retains original
   object identity and source geometry. The 2026-10-08 [layer clarification](LAYERS_AND_INTERACTION.md#layer-contract-clarification--2026-10-08)
   accepts automatic display clipping of a whole route without manual floor subdivision
   or new runtime points at cuts. Repeat the load measurements with layers,
   labels when available, and a heavy background. This is the central prototype
   validation gate; broader API work must not postpone it.
6. **Complete the remaining agreed slice.** Add synchronous nested batch, minimal
   materials with explicit inheritance, and the label registration example in
   separate reviewable steps. Reuse the update boundaries established above.
   Complete desktop/mobile input and accessibility validation, then document the
   prototype's demonstrated limits and justified next steps.

Each implementation substep needs its relevant checks and concrete mini review.
Commit authorization follows the repository instructions; this plan does not grant it.
Numerical performance targets must be agreed before calling the load gate passed.
If SVG falls short, use measurements to choose a bounded correction or document a
limitation; neither `<use>` nor a different renderer is selected in advance.

<a id="scene-ownership-substep--implemented-for-review-2026-10-06"></a>

## Scene-ownership substep — merged in PR #23

The user authorized only the first architecture substep: internal DOM-independent
scene ownership with current public behavior preserved. `MapModel` owns the resolved
input snapshot, runtime collection, prepared geometry, spatial queries and observation;
`MapElement` remains the viewport/browser consumer. See the
[concrete boundary and lifecycle](RENDERER_AND_COMPONENT.md#internal-scene-model--accepted-2026-10-06-implemented-for-review).

The committed regression foundation uses Vitest in Node. Focused model tests and
component load/lifecycle/stale-click contract tests are added in the same tooling,
without new dependencies. Component tests supply minimal browser stand-ins and a
renderer double. Seven additional real DOM/SVG checks passed in the Codex in-app
browser, including surviving nodes, reconnect and failed image preparation. The
model imports and queries without DOM or renderer globals. Physical mobile testing
remains outstanding.

At the 2026-10-06 ownership stage, this extraction preserved geometry synchronization
rather than implementing step 4. Explicit invalidation and affected SVG output
subsequently merged in PR #27. Public model lifecycle/core entry point and later
batch/material/label features remain unimplemented. No benchmark
or speed claim belongs to this substep; stress-baseline work is separate. Mini review
and separate commit authorization are still required.

<a id="explicit-invalidation-substep--implemented-for-review-2026-10-07"></a>

## Explicit invalidation substep — merged in PR #27

Step 4 is implemented on `origin/master` at `1c2e54b`, which already contains
`MapModel`, the real-SVG browser regressions, and the Atlas benchmark. Internal
mutation marks replace unchanged structural scans; the renderer updates affected
entries and separates viewport/viewBox from screen-scale changes. See the
[mechanism and lifecycle](RENDERER_AND_COMPONENT.md#explicit-scene-invalidation--implemented-for-review-2026-10-07).
The work subsequently merged in PR #27. At the 2026-10-07 invalidation stage,
the original Node/browser tests passed on the combined base; after the reattachment
review correction, 110 Node and 40 browser tests, check, and both builds passed.

The same four Atlas scenes and full scenario suite were measured before and after,
with separate timing and instrumentation before the reattachment correction. Its newer functional/counter checks are recorded separately; the old CSV/manifests remain unchanged. See [results and limits](../performance/INVALIDATION.md).
Initial load, mass updates, and membership operations are assessed alongside camera
and individual edits. Numerical targets remain unapproved; this does not complete
the prototype load gate, actual mobile testing, or layers/z/clipping validation.
Leaflet work is independent and unchanged.

## Contract and documentation follow-up

- **Polygon validation report — completed 2026-10-09:** corrected the historical
  polygon-stage report from 214 to 223 Node tests, the total independently verified
  during acceptance. The 75 Chromium tests and one combined E2E scenario are unchanged.
  This correction is already committed as `bc87449`; it is not a new task or part
  of the current-contract changes. The polygon orientation fix and regressions
  belong to the preceding polygon change. Batch remains unimplemented in this baseline.
- **Current contract summary — documented 2026-10-09 (earlier finding 7; repeat
  findings 22, 27, 31, 32):** [Current contract](CURRENT_CONTRACT.md) separates merged
  behavior, temporary implemented contracts, accepted future work and open/deferred
  decisions. Pending fixes are excluded from its merged baseline. Topic histories
  remain in place, with superseded sections and old anchors preserved; no archive
  migration is needed for this task.
- **Ownership/sharing (finding 12):** existing instance attachment and shared-point
  behavior remain accepted. Review their concrete consumer, lifetime, and eventual
  export semantics during the model-boundary step. Single ownership or unsupported
  shared export are alternatives requiring a user decision, not changes adopted
  from the review. Do not add more sharing machinery meanwhile.
- **Validation/constructors (finding 13):** inventory public construction paths and
  choose one clear validation/copying boundary before changing constructors. Keep
  validation at every public input boundary while avoiding redundant validation of
  trusted internal data. Constructor signature unification is a proposal, not a
  prerequisite or an approved breaking change.
- **Geometry dispatch (finding 14):** when zones introduce the next geometry kind,
  review where kind-specific logic belongs within each subsystem. Consolidate only
  repeated logic with a concrete consumer; no plugin registry or generic extension
  framework is planned.
- Findings 5–7 establish direction and scope discipline. Findings 8–11 and 15–18
  drive the ordered work above; findings 12–14 remain bounded decision points.

## Proposed verifiable success criteria

- Switching one building's floor does not change another building's selected view.
- Clipping does not change source geometry; events identify the original object and layer.
- Runtime object changes appear on the map; batch combines rendering updates.
- Materials and the label extension require no changes to SVG renderer business logic.
- The external application handles events and displays descriptions without accessing
  the renderer's internal DOM.
- Load scenes measure pan/zoom, hit testing, layer switching, object updates, and loading;
  the device, browser, and scene composition are recorded.
  Numerical performance thresholds are not yet approved.
- Problems and decision changes are documented rather than concealed by a more complex API.

These are proposed working steps and criteria, not additional approved requirements.
Source-map research: [TARKOV_MAP_AUDIT.md](../TARKOV_MAP_AUDIT.md).

<a id="benchmark-step-one--implemented-for-review-2026-10-06"></a>

## Benchmark step one — merged in PR #22; historical 2026-10-06 results

A standalone real-browser Atlas SVG benchmark now exercises deterministic 3000/5000
root point-only and mixed point/line/route scenes with the current Factory background.
Load, pan, zoom, internal picking, geometry edits, add/remove, route membership, and
wheel dispatch are measured before runtime architecture changes. Production timing
and intrusive counters are separate. See [baseline and method](../performance/BASELINE.md).
At the 2026-10-06 benchmark stage, Leaflet SVG/Canvas comparison was pending
approval; it subsequently merged in PR #25. Mobile,
layers/z/clipping, labels, and full prototype validation remain outstanding; no
numerical load gate has been passed or new architecture contract accepted.
