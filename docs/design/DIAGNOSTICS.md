# Diagnostics

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

User requirement: console logging with three levels and an option to disable it completely.

Proposed but not separately confirmed: error / warn / debug; configuration
off | error | warn | debug; cumulative level enabling; default warn;
[Atlas] prefix. The final configuration contract remains open.

## Duplicate ID diagnostics — possible later step, 2026-10-06

The [ID handling decision](RUNTIME_AND_LOADING.md#id-handling--accepted-2026-10-06-implemented-for-review)
accepts explicit duplicate IDs during ordinary loading and edits. The user suggested
an opt-in debug method to find duplicates when needed. Its API and placement remain
open; no automatic scan, warning, or rejection is introduced in the runtime.
