# Initial zoom profile — incomplete input coverage

The first zoom capture, **16:39:23–16:41:56 Europe/Riga**, is retained as historical
evidence with an identified integrity limitation. It is superseded by the corrected
capture in [the current report](ZOOM_PROFILE_2026_10_20.md).

The benchmark input allowlist contained `examples/prototype-zoom.run.mjs` and
`examples/prototype-zoom.analyze.mjs`, but the subsequent `prototype-bench` name
filter excluded them from the embedded `__PROTOTYPE_BENCH_BUILD__` metadata.
Consequently its manifest and all 32 checkpoints checked **86 inputs**, omitting
both scripts. The earlier claim of complete harness identity was too broad.
Neither the original checkpoints nor this run's manifest have been amended to
pretend those scripts were checked. Its verification JSON applies only to the
recorded inputs and does not establish runner/analyzer identity during capture.

The original artifacts remain unchanged:

- [Manifest](zoom-2026-10-20-manifest.json)
- [Timing](zoom-2026-10-20-timing.csv) and [summary](zoom-2026-10-20-timing-summary.csv)
- [Diagnostics](zoom-2026-10-20-diagnostics.json)
- [Original offline verification](zoom-2026-10-20-verification.json)

Original raw traces/profiles and frozen build remain outside Git at
`/var/folders/cj/6xvtg19d5hzc85wsxr3bzc3m0000gn/T/atlas-zoom-atM5Dl`.
The full original report text is retained at
`/private/tmp/atlas-zoom-p2-previous-report.md`. Its numeric tables describe that
initial run; its complete-input-coverage claim is superseded by this correction.
The corrected run is a repetition with fixed provenance, not an optimization or a
controlled before/after performance comparison.
