# Platforms, accessibility, and load

Browser/input targets below are accepted direction, not a validated support matrix.
[Current contract](CURRENT_CONTRACT.md) records available behavior and pending gesture
work. Benchmark results retain their original dates and workloads; the representative
load gate and physical mobile validation remain outstanding.

[Main navigation](../DESIGN_MAIN.md)

## Accepted

- Modern Chrome, Firefox, Safari, Edge; Safari on iOS and Chrome on Android.
  Specific minimum versions have not been selected.
- Mouse and touch input; basic keyboard camera navigation.
- Interactive objects must support keyboard focus and activation;
  accessibility details are validated by the prototype.
- At the user's explicit request, keyboard handlers remain an open question:
  specific keys, registration/interception API, focus, and the division of
  responsibility between Atlas and the application are not yet approved.

## Measuring the tarkov.dev reference

Checked on 2026-09-25. Source: https://json.tarkov.dev/regular/maps
Regular mode. The API path was established from source code:
https://github.com/the-hideout/tarkov-dev/blob/main/src/features/maps/do-fetch-maps.mjs
https://github.com/the-hideout/tarkov-dev/blob/main/src/modules/api-request.mjs

Counted array lengths: spawns, extracts, transits, locks, hazards, lootContainers, lootLoose, switches, stationaryWeapons, btrStops.
These are source-category records, not unique visible markers or DOM nodes.
Quest objectives, configuration labels, SVG backgrounds, user routes, and nested
geometry are excluded. Clipping and filters may reduce visible counts;
a single record may produce several visual elements.

| Map               | Records in selected categories |
| ----------------- | -----------------------------: |
| streets-of-tarkov |                           2800 |
| lighthouse        |                           1792 |
| reserve           |                           1677 |
| interchange       |                           1610 |
| shoreline         |                           1569 |

Agreed prototype reference: a baseline of about 3000 semantic objects, an additional
5000-object test with headroom, plus routes, labels, multiple layers, and a heavy
background. This is neither a product limit nor an SVG performance guarantee.
Update frequency, route lengths, target devices, FPS/loading time, and memory budget
are undefined; object count alone does not describe the entire workload.

## Identified clipping-model question

Source: https://github.com/the-hideout/tarkov-dev/blob/main/src/data/maps.json
Streets uses global height ranges for levels. Reserve defines several extents
with different height ranges and local building bounds for one displayed floor.
A single rectangular clip cannot directly reproduce such a combined floor.
Decision point: multiple layers under shared controls or a union of clipping regions.
The current model is not automatically extended; arbitrary clipping shapes remain deferred.

<a id="early-svg-benchmark--implemented-for-review-2026-10-06"></a>

## Early SVG benchmark — merged in PR #22; historical 2026-10-06 results

The [Atlas baseline](../performance/BASELINE.md) records deterministic 3000/5000-root
scenes, distinguishes semantic roots/owned points/visual primitives/DOM nodes, and
uses production browser timing separately from local instrumentation. It measures
the current flat scene and temporary symbols; the current Factory background is
not the future heavy-background/layer/label gate. Actual phone performance remains
unmeasured; instructions for a physical-device run are included. The separately
requested [Leaflet SVG/Canvas comparison](../performance/LEAFLET_COMPARISON.md)
subsequently merged in PR #25 with its separately dated Atlas measurements, explicit metric
boundaries and weaker Canvas correctness coverage. No FPS budget or thresholds are added.
