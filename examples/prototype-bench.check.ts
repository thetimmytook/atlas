import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { INITIAL_FLOORS, point } from './prototype-bench.scene.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { MapPolygon } from '#objects/map-polygon.js';
import type { MapRoute } from '#objects/map-route.js';

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function surface(map: MapElement): SVGSVGElement {
  const svg = map.shadowRoot?.querySelector('svg');
  assert(svg, 'Missing SVG surface.');

  return svg;
}

export function selectFloor(map: MapElement, building: number, floor: number): void {
  for (const layer of map.layers) {
    if (layer.id.startsWith(`b${building}-`)) {
      layer.visible = layer.id === `b${building}-f${floor}`;
    }
  }
}

export function initialFloors(map: MapElement): void {
  INITIAL_FLOORS.forEach((floor, building) => selectFloor(map, building, floor));
}

export function frame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export async function settle(): Promise<void> {
  await frame();
  await frame();
}

function shape(map: MapElement, layer: string, id: string): SVGElement {
  const element = surface(map).querySelector<SVGElement>(
    `[data-layer-id="${layer}"] [data-object-id="${id}"] > :first-child`,
  );
  assert(element, 'Expected appearance is missing.');

  return element;
}

/** Independent SVG-output oracle: parse emitted coordinates, never call runtime clipping. */
function coordinates(element: SVGElement, attribute: string): number[] {
  const text = element.getAttribute(attribute)?.replace(/[ML]/g, ' ').trim();

  return text ? text.split(/[\s,]+/).map(Number) : [];
}

function expectCoordinates(actual: readonly number[], expected: readonly number[]): void {
  assert(
    actual.length === expected.length &&
      actual.every((value, index) => Math.abs(value - expected[index]!) < 1e-8),
    'Analytic clipping coordinates differ.',
  );
}

function pathArea(element: SVGElement): number {
  const cells = element.getAttribute('d')!.split('Z').filter(Boolean);

  return cells.reduce((area, cell) => {
    const values = cell
      .replace(/[ML]/g, ' ')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    let twiceArea = 0;

    for (let index = 0; index < values.length; index += 2) {
      const next = (index + 2) % values.length;
      twiceArea += values[index]! * values[next + 1]! - values[next]! * values[index + 1]!;
    }

    return area + Math.abs(twiceArea) / 2;
  }, 0);
}

/** Every operation starts from a fresh loaded scene, including the remove case. */
export function mutation(map: MapElement, name: string): () => void {
  const route = map.objects.get('probe-route') as MapRoute;
  const polygon = map.objects.get('probe-polygon') as MapPolygon;
  const member = map.objects.get('probe-membership')!;

  switch (name) {
    case 'floor-switch':
      return () => selectFloor(map, 0, 1);

    case 'vertex-position':
      return () => {
        route.points[1]!.position = new Point3(120, 80, 10);
      };

    case 'route-add':
      return () => {
        route.addPoint(point('appended', 160, 100, 5));
      };

    case 'route-insert':
      return () => {
        route.insertPoint(1, point('inserted', 80, 100, 5));
      };

    case 'route-remove':
      return () => {
        route.removePoint(route.points[1]!);
      };

    case 'route-replacePoints':
      return () => {
        route.replacePoints(1, 2, [point('replacement', 110, 100, 5)]);
      };

    case 'polygon-vertex':
      return () => {
        polygon.setVertex(1, new Point2(110, 180));
      };

    case 'polygon-baseZ':
      return () => {
        polygon.baseZ = 12;
      };

    case 'polygon-height':
      return () => {
        polygon.height = 0;
      };

    case 'root-add':
      return () => {
        map.objects.add(point('new-root', 710, 480, 5));
      };

    case 'root-remove':
      return () => {
        map.objects.remove(member);
      };

    case 'layer-direct-add':
      return () => {
        map.layers.find(layer => layer.id === 'b0-f0')!.objectIds.add(route.id);
      };

    case 'layer-direct-remove':
      return () => {
        map.layers.find(layer => layer.id === 'b0-f0')!.objectIds.remove('probe-direct');
      };

    default:
      throw new Error('Unknown mutation.');
  }
}

export async function functionalChecks(map: MapElement): Promise<object> {
  const geometry = prepareSceneGeometry(map.objects, map.layers);
  const spatial = new Spatial(geometry);
  const route = map.objects.get('probe-route') as MapRoute;
  const originalPoints = route.points;
  const originalPositions = originalPoints.map(vertex => vertex.position);
  const original = JSON.stringify(originalPositions);
  const polygon = map.objects.get('probe-clip-polygon') as MapPolygon;
  const contour = polygon.contour;
  const checks: string[] = [];

  const hit = (x: number, y: number, id: string, layer: string): void => {
    const result = spatial.hitTest(new Point2(x, y), map.camera);
    const expected = map.objects.get(id) ?? route.points.find(vertex => vertex.id === id);
    assert(
      expected &&
        result?.object === expected &&
        result.layer === map.layers.find(entry => entry.id === layer),
      'Picking lost original object or layer.',
    );

    if (expected.kind === 'point' && route.points.includes(expected)) {
      assert(result.route === route, 'Owned vertex lost route context.');
    }
  };

  const miss = (x: number, y: number): void =>
    assert(
      spatial.hitTest(new Point2(x, y), map.camera) === undefined,
      'Unexpected pick in reserved gutter.',
    );

  // z(t) = -10 + 40t. Floor 0 owns t in [1/4, 1/2), hence x=80..100.
  expectCoordinates(coordinates(shape(map, 'b0-f0', route.id), 'points'), [80, 80, 100, 80]);
  expectCoordinates(
    ['x1', 'y1', 'x2', 'y2'].map(attribute =>
      Number(shape(map, 'b0-f0', 'probe-line').getAttribute(attribute)),
    ),
    [80, 155, 100, 155],
  );
  expectCoordinates(
    coordinates(shape(map, 'b0-f0', 'probe-direct'), 'points'),
    [50, 115, 150, 115],
  );
  assert(
    surface(map).querySelectorAll('[data-layer-id="b0-f0"] [data-object-id="probe-direct"]')
      .length === 1,
    'Direct and automatic content duplicated.',
  );
  assert(
    Math.abs(pathArea(shape(map, 'b0-f0', polygon.id)) - 800) < 1e-8,
    'Clipped rectangle area must be 40 by 20.',
  );
  hit(90, 80, route.id, 'b0-f0');
  miss(60, 80);
  hit(120, 115, 'probe-direct', 'b0-f0');
  hit(50, 320, polygon.id, 'b0-f0');
  miss(25, 320);
  checks.push(
    'analytic xyz route/line clipping, rectangle area, direct priority, original picking identity',
  );

  const other = surface(map).querySelector('[data-layer-id="b1-f1"]')!;
  const otherMarkup = other.outerHTML;
  selectFloor(map, 0, 1);
  hit(118, 80, route.id, 'b0-f1');
  hit(670, 80, 'probe-point', 'b1-f1');
  await settle();
  assert(
    other === surface(map).querySelector('[data-layer-id="b1-f1"]') &&
      other.outerHTML === otherMarkup,
    'Another building changed during floor selection.',
  );
  assert(
    route.points === originalPoints &&
      JSON.stringify(route.points.map(vertex => vertex.position)) === original &&
      route.points.every((vertex, index) => vertex.position === originalPositions[index]) &&
      polygon.contour === contour,
    'Clipping mutated source geometry or identity.',
  );
  checks.push('independent floor selection, source arrays/points/positions/contour preserved');

  selectFloor(map, 0, 2);
  hit(75, 260, 'probe-flat', 'b0-f2');
  await settle();
  assert(
    Math.abs(pathArea(shape(map, 'b0-f2', 'probe-flat')) - 600) < 1e-8,
    'Flat boundary polygon has wrong area.',
  );
  initialFloors(map);
  await settle();
  const group = shape(map, 'b0-f0', route.id).parentElement;
  mutation(map, 'vertex-position')();
  hit(110, 80, route.id, 'b0-f0');
  miss(80, 80);
  await settle();
  expectCoordinates(coordinates(shape(map, 'b0-f0', route.id), 'points'), [90, 80, 120, 80]);
  assert(
    shape(map, 'b0-f0', route.id).parentElement === group && route.points === originalPoints,
    'Position edit replaced surviving identities.',
  );
  route.points[1]!.position = originalPositions[1]!;
  await settle();
  checks.push('position: immediate picking, deferred SVG, surviving identity');

  // Independent expected paths and hit positions for each topology edit, then restore.
  const cases = [
    {
      name: 'route-add',
      xy: [160, 100],
      owner: 'appended',
      paths: [
        [80, 80, 100, 80],
        [156, 96, 160, 100],
      ],
    },
    {
      name: 'route-insert',
      xy: [80, 100],
      owner: 'inserted',
      paths: [[220 / 3, 280 / 3, 80, 100, 100, 80]],
    },
    { name: 'route-remove', xy: [90, 80], owner: route.id, paths: [[80, 80, 100, 80]] },
    {
      name: 'route-replacePoints',
      xy: [110, 100],
      owner: 'replacement',
      paths: [[280 / 3, 280 / 3, 110, 100, 116, 96]],
    },
  ];

  for (const test of cases) {
    const before = route.points;
    mutation(map, test.name)();
    hit(test.xy[0]!, test.xy[1]!, test.owner, 'b0-f0');
    await settle();
    const paths = Array.from(
      surface(map).querySelectorAll<SVGElement>(
        '[data-layer-id="b0-f0"] [data-object-id="probe-route"] > polyline',
      ),
    );
    assert(paths.length === test.paths.length, 'Route fragment count mismatch.');
    paths.forEach((path, index) =>
      expectCoordinates(coordinates(path, 'points'), test.paths[index]!),
    );
    assert(
      route.points[0] === originalPoints[0] &&
        route.points.at(-1 - (test.name === 'route-add' ? 1 : 0)) === before[2],
      'Surviving owned point identity changed.',
    );

    if (test.name === 'route-add') {
      route.removePoint(route.points.at(-1)!);
    } else if (test.name === 'route-insert') {
      route.removePoint(route.points[1]!);
    } else if (test.name === 'route-remove') {
      route.insertPoint(1, point('pr-1', 100, 80, 10));
    } else {
      route.replacePoints(1, 2, [point('pr-1', 100, 80, 10)]);
    }

    await settle();
  }

  checks.push(
    'add/insert/remove/replacePoints: analytic SVG fragments, immediate picking, surviving endpoints',
  );
  const editable = map.objects.get('probe-polygon') as MapPolygon;
  mutation(map, 'polygon-vertex')();
  hit(100, 182, editable.id, 'b0-f0');
  await settle();
  assert(
    Math.abs(pathArea(shape(map, 'b0-f0', editable.id)) - 1500) < 1e-8,
    'Edited trapezoid area mismatch.',
  );
  mutation(map, 'polygon-baseZ')();
  miss(70, 195);
  await settle();
  assert(
    !surface(map).querySelector('[data-layer-id="b0-f0"] [data-object-id="probe-polygon"]'),
    'Moved vertical volume remains displayed.',
  );
  selectFloor(map, 0, 1);
  hit(70, 195, editable.id, 'b0-f1');
  selectFloor(map, 0, 2);
  hit(70, 195, editable.id, 'b0-f2');
  editable.height = 0;
  miss(70, 195);
  await settle();
  assert(
    !surface(map).querySelector('[data-layer-id="b0-f2"] [data-object-id="probe-polygon"]'),
    'Flattened volume still appears on floor 2.',
  );
  selectFloor(map, 0, 1);
  hit(70, 195, editable.id, 'b0-f1');
  checks.push(
    'polygon contour/baseZ/height: analytic area, immediate pick eligibility, SVG membership',
  );

  const added = map.objects.add(point('new-root', 710, 480, 5));
  hit(710, 480, added.id, 'b3-f0');
  await settle();
  assert(
    shape(map, 'b3-f0', added.id).parentElement?.getAttribute('transform') === 'translate(710 480)',
    'Added root not at current position.',
  );
  map.objects.remove(added);
  await settle();
  const retained = map.objects.get('probe-membership')!;
  map.objects.remove(retained);
  miss(670, 480);
  await settle();
  assert(
    !surface(map).querySelector('[data-object-id="probe-membership"]'),
    'Removed root remains displayed.',
  );
  assert(map.objects.add(retained) === retained, 'Root reattachment lost identity.');
  hit(670, 480, retained.id, 'b3-f0');
  await settle();
  assert(
    surface(map).querySelector('[data-object-id="probe-membership"]'),
    'Attached root not displayed.',
  );
  initialFloors(map);
  await settle();
  mutation(map, 'layer-direct-add')();
  hit(122, 80, route.id, 'b0-f0');
  await settle();
  expectCoordinates(
    coordinates(shape(map, 'b0-f0', route.id), 'points'),
    [60, 80, 100, 80, 140, 80],
  );
  mutation(map, 'layer-direct-remove')();
  miss(55, 115);
  await settle();
  expectCoordinates(
    coordinates(shape(map, 'b0-f0', 'probe-direct'), 'points'),
    [75, 115, 100, 115],
  );
  checks.push(
    'root removal/reattachment and direct membership: live display/picking and exact source identity',
  );

  return {
    checks,
    passed: checks.length,
    oracle:
      'Literal segment endpoints from affine z equations; shoelace area of emitted SVG versus known rectangle/trapezoid areas; reserved-gutter hits. No runtime clipping in expected calculations.',
  };
}
