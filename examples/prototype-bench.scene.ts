import type { MapDefinition, MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MaterialDefinition } from '#definitions/material-definition.js';

export const PROFILES = ['control', 'materials-labels'] as const;
export type Profile = (typeof PROFILES)[number];
export const BATCH_IDS = Array.from({ length: 16 }, (_, index) => `root-${16 + index}`);
export const SVG_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#0369a1" d="M8 0L16 8L8 16L0 8Z"/><circle cx="8" cy="8" r="3" fill="white"/></svg>';

// Original 1x1 RGBA PNG, embedded to avoid network or filesystem resource variance.
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';

export const SEED = 0x50_52_4f_54;
export const MAP_SIZE = { width: 1200, height: 800 };
export const MAP_VIEWPORT = { width: 960, height: 640 };
export const BUILDINGS = [
  { x: 40, y: 40 },
  { x: 640, y: 40 },
  { x: 40, y: 440 },
  { x: 640, y: 440 },
] as const;
export const INITIAL_FLOORS = [0, 1, 2, 0] as const;

export function point(id: string, x: number, y: number, z: number): MapPointDefinition {
  return { id, kind: 'point', pickable: true, position: { x, y, z } };
}

/** Small deterministic vector plan, not a randomly generated or downloaded image. */
export function backgroundSvg(): string {
  const buildings = BUILDINGS.map(({ x, y }, building) => {
    const rooms = Array.from({ length: 96 }, (_, index) => {
      const rx = 12 + (index % 12) * 41;
      const ry = 25 + Math.floor(index / 12) * 31;

      return `<g><rect x="${rx}" y="${ry}" width="35" height="25"/><path d="M${rx + 4},${ry + 25}h8v-5"/><text x="${rx + 3}" y="${ry + 12}">${building + 1}-${index + 1}</text></g>`;
    }).join('');

    return `<g transform="translate(${x} ${y})"><rect width="520" height="300" fill="#e2e8f0"/><text x="12" y="16">Building ${building + 1}</text>${rooms}</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f8fafc"/><g fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.6" font-family="sans-serif" font-size="7">${buildings}</g></svg>`;
}

export function backgroundMetadata(): object {
  const svg = new DOMParser().parseFromString(backgroundSvg(), 'image/svg+xml');
  const elements = Array.from(svg.querySelectorAll('*'));

  return {
    format: 'image/svg+xml',
    intrinsic: MAP_SIZE,
    viewBox: '0 0 1200 800',
    mapSize: MAP_SIZE,
    utf8Bytes: new TextEncoder().encode(backgroundSvg()).length,
    elements: elements.length,
    byTag: elements.reduce<Record<string, number>>((counts, element) => {
      counts[element.tagName] = (counts[element.tagName] ?? 0) + 1;

      return counts;
    }, {}),
    roomsPerBuilding: 96,
    notes:
      'External SVG image: 384 room groups, each rect + door path + text; no filters or remote resources. Text uses browser sans-serif.',
  };
}

function probes(): MapEntryDefinition[] {
  return [
    {
      id: 'probe-route',
      kind: 'route',
      points: [point('pr-0', 60, 80, -10), point('pr-1', 100, 80, 10), point('pr-2', 140, 80, 30)],
    },
    {
      id: 'probe-direct',
      kind: 'route',
      points: [point('pd-0', 50, 115, -10), point('pd-1', 150, 115, 30)],
    },
    {
      id: 'probe-line',
      kind: 'line',
      points: [point('pl-0', 60, 155, -10), point('pl-1', 140, 155, 30)],
    },
    {
      id: 'probe-polygon',
      kind: 'polygon',
      contour: [
        { x: 50, y: 180 },
        { x: 90, y: 180 },
        { x: 90, y: 210 },
        { x: 50, y: 210 },
      ],
      baseZ: 5,
      height: 10,
    },
    {
      id: 'probe-flat',
      kind: 'polygon',
      contour: [
        { x: 60, y: 250 },
        { x: 90, y: 250 },
        { x: 90, y: 270 },
        { x: 60, y: 270 },
      ],
      baseZ: 20,
      height: 0,
    },
    {
      id: 'probe-clip-polygon',
      kind: 'polygon',
      contour: [
        { x: 20, y: 310 },
        { x: 80, y: 310 },
        { x: 80, y: 330 },
        { x: 20, y: 330 },
      ],
      baseZ: 0,
      height: 25,
    },
    point('probe-point', 670, 80, 15),
    point('probe-membership', 670, 480, 5),
    {
      id: 'connector-route',
      kind: 'route',
      points: [
        point('cr-0', 500, 300, 5),
        point('cr-1', 600, 300, 10),
        point('cr-2', 700, 300, 15),
      ],
    },
  ];
}

export function createScene(
  roots: 3000 | 5000,
  background: string,
  profile: Profile = 'control',
): MapDefinition {
  let state = SEED;

  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 2 ** 32;
  };

  const objects = probes();

  for (let index = objects.length; index < roots; index += 1) {
    const building = BUILDINGS[index % 4]!;
    const floor = Math.floor(index / 4) % 3;
    const slot = Math.floor(index / 12) % 10;
    const id = `root-${index}`;
    const x = building.x + 180 + random() * 290;
    const y = building.y + 60 + random() * 200;
    const z = floor * 10 + 3;

    if (slot < 4) {
      objects.push(point(id, x, y, z));
      continue;
    }

    if (slot < 6) {
      objects.push({
        id,
        kind: 'line',
        points: [point(`${id}-0`, x, y, z), point(`${id}-1`, x + 25, y + 15, z + 12)],
      });
      continue;
    }

    if (slot < 8) {
      const length = [4, 8, 12][Math.floor(index / 120) % 3]!;
      objects.push({
        id,
        kind: 'route',
        points: Array.from({ length }, (_, vertex) =>
          point(
            `${id}-${vertex}`,
            x + vertex * 2,
            y + Math.sin(vertex) * 8,
            -5 + (vertex * 40) / (length - 1),
          ),
        ),
      });
      continue;
    }

    const contour = [
      { x, y },
      { x: x + 24, y },
      { x: x + 24, y: y + 12 },
      { x: x + 12, y: y + 12 },
      { x: x + 12, y: y + 24 },
      { x, y: y + 24 },
    ];
    objects.push({ id, kind: 'polygon', contour, baseZ: z, height: slot === 8 ? 0 : 18 });
  }

  const visual = profile === 'materials-labels' ? visualProfile(objects) : {};

  return {
    objects,
    materials: { vertex: { properties: { symbol: 'circle' } } },
    materialRules: [{ when: { kind: 'point' }, material: 'vertex' }],
    ...visual,
    layers: [
      { id: 'background', stackIndex: -1, background: { source: background, size: MAP_SIZE } },
      ...BUILDINGS.flatMap((building, b) =>
        Array.from({ length: 3 }, (_, floor) => ({
          id: `b${b}-f${floor}`,
          stackIndex: b * 3 + floor,
          ...(b === 0 && floor === 0 ? { objects: ['probe-direct'] } : {}),
          intersectionBounds: {
            min: { x: building.x, y: building.y, z: floor * 10 },
            max: { x: building.x + 520, y: building.y + 300, z: (floor + 1) * 10 },
          },
        })),
      ),
    ],
  };
}

export function composition(definition: MapDefinition): object {
  return (definition.objects ?? []).reduce(
    (counts, object) => {
      counts.roots += 1;

      if (object.kind === 'polygon') {
        counts.polygonContourVertices += object.contour.length;
        counts[object.height ? 'extrudedPolygons' : 'flatPolygons'] += 1;
      } else if (object.kind === 'point') {
        counts.points += 1;
      } else {
        counts.ownedMapPoints += object.points.length;
        counts[object.kind === 'line' ? 'lines' : 'routes'] += 1;

        if (object.kind === 'route') {
          counts.routeVertices += object.points.length;
        }
      }

      return counts;
    },
    {
      roots: 0,
      points: 0,
      lines: 0,
      routes: 0,
      flatPolygons: 0,
      extrudedPolygons: 0,
      ownedMapPoints: 0,
      routeVertices: 0,
      polygonContourVertices: 0,
    },
  );
}

/** Bounded application profile; geometry, membership and PRNG consumption are unchanged. */
function visualProfile(objects: MapEntryDefinition[]): Partial<MapDefinition> {
  objects.forEach((object, index) => {
    const labelled = index < 9 || Math.floor(index / 4) % 4 === 0;
    const visual = ['svg', 'png'][index % 7] ?? 'standard';
    const decorated = {
      ...object,
      data: { visual },
      ...(labelled
        ? { label: `${object.kind[0]!.toUpperCase()}${String(index).padStart(6, '0')}` }
        : {}),
      ...(index < 9 ? { material: object.kind === 'point' ? 'probe-marker' : 'probe-style' } : {}),
    };

    if (decorated.kind === 'route' && labelled) {
      const owned = Math.floor(decorated.points.length / 2);
      decorated.points = decorated.points.map((vertex, pointIndex) =>
        pointIndex === owned
          ? {
              ...vertex,
              label: `O${String(index).padStart(6, '0')}`,
              material: index < 9 ? 'probe-owned' : 'svg-marker',
              pickable: true,
            }
          : vertex,
      );
    }

    objects[index] = decorated;
  });

  const materials: Record<string, MaterialDefinition> = {
    typography: {
      properties: {
        label: { font: { family: 'monospace', size: '12px', weight: 'normal' }, color: '#0f172a' },
      },
    },
    vertex: {
      inherits: 'typography',
      properties: { symbol: 'circle', color: '#2563eb', size: 10 },
    },
    'svg-marker': {
      inherits: 'vertex',
      properties: { symbol: 'image', image: { resource: 'diamond', width: 16, height: 16 } },
    },
    'png-marker': {
      inherits: 'vertex',
      properties: { symbol: 'image', image: { resource: 'pixel', width: 14, height: 14 } },
    },
    'line-style': { inherits: 'typography', properties: { color: '#0e7490', width: 3 } },
    'route-style': { inherits: 'line-style', properties: { color: '#7c3aed', width: 4 } },
    'polygon-style': { inherits: 'typography', properties: { color: '#c2410c', opacity: 0.35 } },
    'probe-style': {
      inherits: 'typography',
      properties: { label: { origin: 'top left', offset: { x: '40px', y: '-20px' } } },
    },
    'probe-marker': {
      inherits: 'svg-marker',
      properties: { label: { origin: 'top left', offset: { x: '40px', y: '-20px' } } },
    },
    'probe-owned': {
      inherits: 'vertex',
      properties: { label: { origin: 'top left', offset: { x: '-60px', y: '-20px' } } },
    },
  };

  return {
    materials,
    materialRules: [
      { when: { kind: 'point' }, material: 'vertex' },
      { when: { kind: 'line' }, material: 'line-style' },
      { when: { kind: 'route' }, material: 'route-style' },
      { when: { kind: 'polygon' }, material: 'polygon-style' },
      { when: { kind: 'point', benchVisual: 'svg' }, material: 'svg-marker' },
      { when: { kind: 'point', benchVisual: 'png' }, material: 'png-marker' },
    ],
    resources: {
      diamond: { kind: 'image', source: `data:image/svg+xml,${encodeURIComponent(SVG_ICON)}` },
      pixel: { kind: 'image', source: `data:image/png;base64,${PNG_BASE64}` },
    },
  };
}

export function resourceMetadata(profile: Profile): object[] {
  return profile === 'control'
    ? []
    : [
        {
          id: 'diamond',
          format: 'image/svg+xml',
          width: 16,
          height: 16,
          bytes: new TextEncoder().encode(SVG_ICON).length,
        },
        { id: 'pixel', format: 'image/png', width: 1, height: 1, bytes: atob(PNG_BASE64).length },
      ];
}
