# Diagnostics

[Navigation and current summary](../DESIGN_MAIN.md)

First-slice `AtlasMaterialError` signatures, codes and fixed messages are
implemented for mini review and listed in the [accepted contract](MATERIALS_FIRST_SLICE_CONTRACT.md).

The implemented point-level `pickable` flag uses ordinary `AtlasError` for an
invalid boolean/undefined input: code `INVALID_POINT_PICKABLE`, fixed
message `Point pickable must be a boolean or undefined.`, variable context in
`details`. This belongs to point interaction validation, independently of the
material error subclass. See the
[flag contract](MATERIALS_FIRST_SLICE_CONTRACT.md#point-picking--proposed-minimal-flag).

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

User requirement: console logging with three levels and an option to disable it completely.

Proposed but not separately confirmed: error / warn / debug; configuration
off | error | warn | debug; cumulative level enabling; default warn;
[Atlas] prefix. The final configuration contract remains open.

<a id="material-error-category--proposal-2026-10-12"></a>

## Material error category — accepted, 2026-10-12

The user accepted `AtlasMaterialError extends AtlasError` for material-system
failures, consistent with the repository's naming of library errors. This is
implemented for mini review, not committed or merged. The options-only constructor,
code union and fixed messages follow the first-slice contract; broader logging
configuration remains open.

- The subclass identifies material validation, selection and update failures as
  a group for `instanceof` handling while retaining general `AtlasError` handling.
- Stable `code` values distinguish individual failure reasons, including unknown
  materials/parents, inheritance cycles and incompatible parameters.
- Variable context belongs in inherited `details`; wrapped failures retain their
  original error in `cause`. Names and messages remain constant.
- The accepted category uses distinct codes for individual validation reasons.

The [accepted material validation guarantees](MATERIALS.md#material-validation-and-failed-updates--accepted-2026-10-12)
apply unchanged when errors use this subclass.

## Duplicate ID diagnostics — possible later step, 2026-10-06

The [ID handling decision](RUNTIME_AND_LOADING.md#id-handling--accepted-2026-10-06-implemented-for-review)
accepts explicit duplicate IDs during ordinary loading and edits. The user suggested
an opt-in debug method to find duplicates when needed. Its API and placement remain
open; no automatic scan, warning, or rejection is introduced in the runtime.
