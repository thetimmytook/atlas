# Factory background — original asset

Retrieved 2026-09-28 from https://tarkov.dev/map/factory.

- `Factory.svg`: unchanged bytes from https://assets.tarkov.dev/maps/svg/Factory.svg.
- `map-config.json`: Factory entry extracted from https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json; JSON formatting only was changed. Includes coordinates, floor selection, labels, and alternative raster tile URLs.
- `LICENSE.upstream.md` and `README.upstream.md`: unchanged license and attribution/use notes from https://github.com/the-hideout/tarkov-dev-svg-maps.

The website configuration credits **Shebuka**. The SVG repository identifies its license as CC BY-NC-SA 4.0; see the accompanying upstream files for the full terms and additional use notes. These third-party assets are separate from Atlas code.

`Factory.svg` is the unchanged original SVG used directly as the example asset. No separate source copy is stored, because no conversion was needed.

## Format and layers

The original is vector SVG, with no embedded raster images. No conversion was performed.

- Size: 30,980 bytes.
- ViewBox: `0 0 130.81831 141.23242`.
- SHA-256: `237344e31bee3f2d830299194bacfa2768eacd9cba16dfca2243a07b44426c6b`.
- Floor groups: `Basement`, `Ground_Floor`, `Second_Floor`, `Third_Floor`.
- Website base layer: `Ground_Floor`; the other floors are selected separately by the application.

Opening the full original SVG is not the same as the website's selected-floor view: the website filters top-level groups when displaying floors. The original is preserved here with all groups and styles intact, without the site's interactive markers or UI.

The deployed asset differs in byte size from the SVG repository's current `Factory.svg`; this copy deliberately preserves the file referenced by the live website configuration. The alternate Satellite background consists of PNG tiles and is not included in this SVG extraction.

## Ground-floor extract

`Factory-ground-floor.svg` contains only `Ground_Floor`, matching the floor in the reference screenshot. Derived from `Factory.svg` by removing the top-level `Basement`, `Second_Floor`, and `Third_Floor` groups. Styles, shared definitions, viewBox, and ground-floor geometry are unchanged. The background remains transparent; website markers, labels, and dark page background are not included. The same upstream attribution and license apply.
