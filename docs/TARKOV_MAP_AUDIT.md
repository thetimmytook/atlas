# tarkov.dev map audit for Atlas

Date: 2026-09-25. Reference research, not new Atlas requirements.

## Coverage and sources

- Checked the complete catalog: 15 sections, 42 variants in maps.json,
  and 13 primary interactive configurations. The UI catalog additionally lists
  Night Factory, Ground Zero 21+, and The Lab Dark (45 links total).
- Examined regular/maps data for all 17 records (including variants and tutorial),
  configurations for all 42 variants, and the shared map implementation.
- Opened all 13 primary interactive maps, Openworld, Transits, and the separate Dorms
  view in the browser. This was a screen overview, not exhaustive testing of every
  control, zoom level, and floor. Not every alternative static illustration was viewed
  at full resolution. Some screenshots were captured while backgrounds were still loading;
  absent backgrounds in those screenshots are not treated as site bugs.
  Structural findings below were checked against data/code.
- Sources:
  - https://tarkov.dev/maps
  - https://github.com/the-hideout/tarkov-dev/blob/main/src/data/maps.json
  - https://json.tarkov.dev/regular/maps
  - https://github.com/the-hideout/tarkov-dev/blob/main/src/pages/map/index.jsx
  - https://github.com/the-hideout/tarkov-dev/blob/main/src/pages/map/index.css

## Inventory of all sections

Record count sums spawns, extracts, transits, locks, hazards, lootContainers, lootLoose, switches, stationaryWeapons, btrStops.
These are not visible markers/DOM nodes; quests, labels, nested vertices, and SVG backgrounds are excluded.

| Section           | Records | Characteristics                                                                                                      |
| ----------------- | ------: | -------------------------------------------------------------------------------------------------------------------- |
| streets-of-tarkov |    2800 | 5 additional levels; global height ranges; separate Lexos/Caches images.                                             |
| ground-zero       |     942 | Local showroom height adjustment; garage/underpass constrained to regions; 21+ variant.                              |
| customs           |    1212 | Different floor heights across buildings, basements in separate regions; 4th floor tiles only; separate Dorms plan.  |
| factory           |     385 | Three above-ground levels plus tunnels, 90° coordinate rotation; Night Factory shares the configuration.             |
| icebreaker        |     145 | 16 named switchable layers; Infirmary initially active; tiles only. Height ranges have gaps and overlaps.            |
| interchange       |    1610 | 2nd Floor initially active; floors constrained to the mall region. UI 2nd Floor corresponds to SVG First_Floor.      |
| the-lab           |     819 | Upper level constrained by local bounds, technical level by height; tiles, 270° rotation, Dark variant.              |
| the-labyrinth     |     267 | One interactive tile background without floors, 270° rotation; switches and hazard zones.                            |
| lighthouse        |    1792 | No switchable floors in configuration; volumetric hazard zones in data; SVG; elongated map.                          |
| reserve           |    1677 | Different vertical ranges within local building bounds; separate underground regions; svgBounds differs from bounds. |
| shoreline         |    1569 | Above-ground global ranges plus local west wing/admin underground regions; separate Resort plan.                     |
| terminal          |     126 | No switchable floors; SVG; categories/data volume differ from the main maps.                                         |
| woods             |    1130 | No switchable floors; wide map, hazard zones, and BTR stops.                                                         |
| transits          |       — | Static connections diagram between maps, including one-way transitions.                                              |
| openworld         |       — | Static world overview composition without a separate interactive configuration.                                      |

## Significant findings and implications for discussion

### 1. Local floors are not unique to Reserve

Customs and Ground Zero also use multiple spatial extents within one named level.
Shoreline has local underground regions. Reserve's dome second floor spans 22.1–25.7;
pawns spans -3.5–-0.64 (height is y in the source data). Choosing floor 2 is not choosing
one global plane. This strengthens the user's separate-building-group use case.
Options remain open: local layers under shared controls or multiple clipping regions;
neither is automatically accepted.

### 2. Floor number, name, and display order differ

Icebreaker has 16 named layers: infirmary, decks, engine rooms, etc. The list starts
with Infirmary, not the lowest room. Its 18.92–19.56 range overlaps Storage/Security
at 15–18.93; some other ranges have gaps. An importer must not assume a perfect partition.
Interchange initially shows 2nd Floor, linked to SVG First_Floor.
Conclusion: control labels/order, geometric bounds, and stackIndex are different things.

### 3. The site actually switches floors on click

activateMarkerLayer removes active overlays and enables the first matching spatial
extents. It is called for many markers and the player's position. This is application
behavior, not Leaflet detection of the nearest/topmost floor. Unselected objects are
frequently dimmed (off-level: opacity 0.2) rather than hidden and may remain interactive.
Do not adopt this automation as Atlas's default. Discussion implication: hidden,
visible as context, and interactive are separate settings.

### 4. Zones have vertical extent

Extracts, transits, and some hazards and switches have position, outline, and top/bottom.
They are not merely flat polygons at one height. Our polygon model with z per vertex
does not yet define a volume between lower and upper bounds. Volumetric-zone/extrusion
geometry needs a decision point; do not add kinds or fields without discussion.

### 5. A marker and outline can represent one semantic object

An extract, hazard, or quest zone is drawn as a marker plus an outline. The outline
frequently appears on hover and persists on click. This is a real example of composite
display and behavior, not a need to duplicate the domain entity. Atlas still needs
to define how such display relates to selection, IDs, and filtering.

### 6. Floor resources are heterogeneous

Reserve: upper floors use tiles; the underground layer also has SVG. Customs: 4th Floor
is tiles only. Icebreaker/Lab/Labyrinth are tiles only. A base SVG does not imply an SVG
for every floor. Importing into our first raster/SVG prototype requires preparing resources
or restricting the chosen reference; tiles are not automatically added to current scope.

### 7. Background and object coordinates require calibration

Rotations of 90/180/270, scale, and translation are specified separately; Reserve has
separate svgBounds. Alternative authors' plans and close-ups do not guarantee identical
georeferencing. Static "3D" variants are images, not interactive 3D models.

### 8. There is a direct reference for separate building views

Customs Dorms shows floor plans side by side, a legend, room numbers, and an isometric
floor diagram. Separate Resort, Reserve Tunnels, and Lexos views also exist. This supports
the user's idea of opening a building separately, but source images are not automatically
ready-to-use geometric data for Atlas.

### 9. Data variants over shared configuration

Factory/Night Factory, Ground Zero/21+, and Lab/Dark use altMaps. These are different
datasets/modes, not floors. Do not conflate dataset switching with layer switching.

### 10. Relationships and dynamics remain with the application

The data includes switches → extracts/doors, locks and keys, several possible items at
one lootLoose point, transitions to other maps, BTR stops, and a dynamic player marker
with heading. The Transits overview illustrates a graph of map connections. These are
useful cases for data, events, and incremental updates, not reasons to embed Tarkov logic
in Atlas. BTR stops alone do not supply BTR route geometry.

### 11. Load is not determined solely by object count

Interchange contains 77 additional text labels; Streets has 46. Overview zoom shows dense
marker/label clusters. One hazard zone creates a marker and an outline, and the background
itself may be a complex SVG. Measure semantic objects, route/zone vertices, labels,
background complexity, and visible slice count separately. Automatic label collision
avoidance was previously deferred; this research does not change that decision.

## Where to resume after the research

The user proposed two scenarios: a separate fullscreen/popup building view with a floor
menu, and a local floor menu next to a building on the main map. They confirmed the use
case of exploring a specific building. Layer groups and the exact control mechanism
are NOT yet approved; the research was performed before continuing the discussion.
The next discussion prioritizes local groups and surrounding context, then zones'
vertical extent. Other findings remain backlog items/decision points.
