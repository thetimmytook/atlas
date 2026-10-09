import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapLayerDefinition } from '#definitions/map-layer-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';

customElements.define('atlas-buildings', MapElement);
const map = document.querySelector<MapElement>('atlas-buildings')!;
const status = document.querySelector<HTMLElement>('#status')!;
const details = document.querySelector<HTMLElement>('#object-details')!;
const ZONE_ID = 'shared-zone';
const buildingNames = ['a', 'b'] as const;

// One shared background also establishes the full map extent for the Fit control.
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="360" height="200" fill="#edf2f8"/><g fill="#d6e5f3" stroke="#6b879f"><rect x="10" y="20" width="140" height="160"/><rect x="210" y="20" width="140" height="160"/></g><g font-family="sans-serif" font-size="9" fill="#233044"><text x="20" y="35">Building A</text><text x="220" y="35">Building B</text><text x="158" y="60">Courtyard</text></g></svg>`;

function floor(building: 'a' | 'b', index: number): MapLayerDefinition {
  const x = building === 'a' ? 10 : 210;

  return {
    id: `${building}-${index}`,
    intersectionBounds: {
      min: { x, y: 20, z: index * 3 },
      max: { x: x + 140, y: 180, z: (index + 1) * 3 },
    },
  };
}

const definition: MapDefinition = {
  layers: [
    {
      id: 'site',
      background: {
        source: 'data:image/svg+xml,' + encodeURIComponent(background),
        size: { width: 360, height: 200 },
      },
    },
    { id: 'courtyard', intersectionBounds: { min: { x: 150 }, max: { x: 210 } } },
    ...buildingNames.flatMap(building => [floor(building, 0), floor(building, 1)]),
  ],
  objects: [
    // One concave source volume crosses both buildings, the courtyard and both floors.
    {
      id: ZONE_ID,
      kind: 'polygon',
      contour: [
        { x: 30, y: 70 },
        { x: 330, y: 70 },
        { x: 330, y: 150 },
        { x: 280, y: 150 },
        { x: 280, y: 110 },
        { x: 80, y: 110 },
        { x: 80, y: 150 },
        { x: 30, y: 150 },
      ],
      baseZ: 1,
      height: 4,
    },
    {
      id: 'journey',
      kind: 'route',
      points: [
        { id: 'a-entry', kind: 'point', position: { x: 40, y: 165, z: 1 } },
        { id: 'a-stairs', kind: 'point', position: { x: 110, y: 165, z: 4 } },
        { id: 'b-stairs', kind: 'point', position: { x: 250, y: 165, z: 4 } },
        { id: 'b-entry', kind: 'point', position: { x: 320, y: 165, z: 1 } },
      ],
    },
    ...buildingNames.flatMap(building =>
      [0, 1].map(index => ({
        id: `${building}-room-${index}`,
        kind: 'point' as const,
        position: { x: building === 'a' ? 120 : 320, y: 50, z: index * 3 + 1 },
      })),
    ),
  ],
};

function updateStatus(): void {
  const zone = map.objects.get(ZONE_ID);

  if (zone?.kind === 'polygon') {
    status.textContent = `Buildings loaded. Zone: base ${zone.baseZ}, height ${zone.height}.`;
  }
}

function selectFloor(building: 'a' | 'b'): void {
  const selected = document.querySelector<HTMLSelectElement>(`#floor-${building}`)!.value;
  map.layers
    .filter(layer => layer.id.startsWith(`${building}-`))
    .forEach(layer => {
      layer.visible = layer.id === `${building}-${selected}`;
    });
}

buildingNames.forEach(building =>
  document
    .querySelector(`#floor-${building}`)!
    .addEventListener('change', () => selectFloor(building)),
);
document
  .querySelector('#fit')!
  .addEventListener('click', () => map.camera.fit(new Rect(0, 0, 360, 200)));
document.querySelector('#move')!.addEventListener('click', () => {
  const zone = map.objects.get(ZONE_ID);

  if (zone?.kind === 'polygon') {
    zone.setVertex(0, new Point2(zone.contour[0]!.x === 30 ? 50 : 30, 70));
  }
});
document.querySelector('#raise')!.addEventListener('click', () => {
  const zone = map.objects.get(ZONE_ID);

  if (zone?.kind === 'polygon') {
    zone.baseZ = zone.baseZ === 1 ? 3 : 1;
    updateStatus();
  }
});
document.querySelector('#height')!.addEventListener('click', () => {
  const zone = map.objects.get(ZONE_ID);

  if (zone?.kind === 'polygon') {
    zone.height = zone.height === 4 ? 1 : 4;
    updateStatus();
  }
});
map.addEventListener('objectclick', event => {
  const { object, layer, route } = (event as ObjectClickEvent).detail;
  details.textContent = JSON.stringify(
    {
      id: object.id,
      kind: object.kind,
      layerId: layer.id,
      routeId: route?.id,
      ...(object.kind === 'polygon'
        ? { baseZ: object.baseZ, height: object.height, contour: object.contour }
        : {}),
    },
    null,
    2,
  );
});

try {
  await map.load(definition);
  buildingNames.forEach(selectFloor);
  map.camera.fit(new Rect(0, 0, 360, 200));
  updateStatus();
} catch (error) {
  status.textContent = 'Unable to load buildings.';
  console.error(error);
}
