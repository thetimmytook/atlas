import { Camera } from '#camera/camera.js';
import { squaredDistanceToSegment } from '#math/distance.js';
import { Point } from '#math/point.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { HIT_POSITION, MISS_POSITION } from './stress.scene.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { Geometry } from '#spatial/geometry.js';
import type { StressScene } from './stress.scene.js';

interface ExpectedPoint {
  id: string;
  position: Point;
}
interface ExpectedObject {
  id: string;
  kind: MapEntryDefinition['kind'];
  points: ExpectedPoint[];
  routeId?: string;
}

// Temporary symbol contract of the prototype, independent of renderer/picking defaults.
const POINT_RADIUS = 11;
const POINT_STROKE = 2;
const LINE_STROKE = 4;
const PROBE_ZOOM = 10000;
const ROUTE_SCENARIO = 'route-update';

function assertMatch(condition: boolean, check: string, id?: string): void {
  if (!condition) {
    throw new Error('Post-operation scene mismatch.', { cause: { check, id } });
  }
}

function expectedObject(definition: MapEntryDefinition): ExpectedObject {
  const points = definition.kind === 'point' ? [definition] : definition.points;

  return {
    id: definition.id!,
    kind: definition.kind,
    points: points.map(point => ({
      id: point.id!,
      position: new Point(point.position.x, point.position.y),
    })),
  };
}

function primitives(roots: readonly ExpectedObject[]): ExpectedObject[] {
  return roots.reduce<ExpectedObject[]>((entries, root) => {
    entries.push(root);

    if (root.kind === 'route') {
      entries.push(
        ...root.points.map(point => ({
          id: point.id,
          kind: 'point' as const,
          points: [point],
          routeId: root.id,
        })),
      );
    }

    return entries;
  }, []);
}

/** Change the definition-derived oracle, without consulting the mutated runtime. */
function expectedMutation(
  scene: StressScene,
  scenario: string,
): {
  roots: ExpectedObject[];
  probes: Point[];
} {
  const roots = scene.definition.objects!.map(expectedObject);
  const amount = Number(scenario.split('-').at(1));
  let affected: ExpectedObject[];
  let after = roots;

  if (scenario.startsWith('position-')) {
    affected = roots.slice(0, scenario === 'position-single' ? 1 : 100);
  } else if (scenario === ROUTE_SCENARIO) {
    affected = roots.filter(root => root.kind === 'route').slice(0, 1);
  } else if (scenario.startsWith('add-')) {
    affected = scene.additions.slice(0, amount).map(expectedObject);
    after = roots.concat(affected);
  } else {
    affected = roots.slice(0, amount);
    after = roots.slice(amount);
  }

  // First affected root of every kind and the last root cover points, endpoints,
  // routes and both ends of a batch without hundreds of dense-scene queries.
  const selected = affected.filter(
    (root, index) =>
      index === affected.findIndex(candidate => candidate.kind === root.kind) ||
      index === affected.length - 1,
  );
  const probes = selected.flatMap(probePositions);

  for (const root of affected) {
    if (scenario.startsWith('position-')) {
      const point = root.points[0]!;
      point.position = new Point(point.position.x + 1, point.position.y + 1);
    } else if (scenario === ROUTE_SCENARIO) {
      root.points.splice(
        1,
        root.points.length - 2,
        { id: 'replacement-0', position: new Point(60, 65) },
        { id: 'replacement-1', position: new Point(62, 67) },
      );
    }
  }

  probes.push(...selected.flatMap(probePositions));

  return { roots: after, probes };
}

function probePositions(object: ExpectedObject): Point[] {
  const positions = object.points.map(point => point.position);

  return positions.concat(
    positions.slice(1).map((end, index) => {
      const start = positions.at(index)!;

      return new Point((start.x + end.x) / 2, (start.y + end.y) / 2);
    }),
  );
}

function checkRoots(map: MapElement, expected: readonly ExpectedObject[]): void {
  const roots = Array.from(map.objects);
  assertMatch(roots.length === expected.length, 'root count');

  expected.forEach((root, index) => {
    const actual = roots.at(index)!;
    assertMatch(actual.id === root.id && actual.kind === root.kind, 'root order/kind', root.id);
    const points = actual.kind === 'point' ? [actual] : actual.points;
    assertMatch(points.length === root.points.length, 'owned point count', root.id);
    root.points.forEach((point, pointIndex) => {
      const current = points.at(pointIndex)!;
      assertMatch(
        current.id === point.id &&
          current.position.x === point.position.x &&
          current.position.y === point.position.y,
        'point membership/position',
        point.id,
      );
    });
  });
}

function geometryPositions(geometry: Geometry): readonly Point[] {
  if (geometry.kind === 'point') {
    return [geometry.position];
  }

  return geometry.kind === 'line' ? [geometry.start, geometry.end] : geometry.points;
}

function checkGeometry(geometry: Geometry, expected: ExpectedObject): void {
  assertMatch(
    geometry.kind === (expected.kind === 'route' ? 'polyline' : expected.kind),
    'spatial geometry kind',
    expected.id,
  );
  const points = geometryPositions(geometry);
  assertMatch(points.length === expected.points.length, 'spatial geometry length', expected.id);
  expected.points.forEach((point, index) => {
    const actual = points.at(index)!;
    assertMatch(
      actual.x === point.position.x && actual.y === point.position.y,
      'spatial coordinates',
      expected.id,
    );
  });
}

function checkShape(group: Element, expected: ExpectedObject, scale: number): void {
  const shape = group.firstElementChild!;
  const positions = expected.points.map(point => point.position);
  const first = positions[0]!;

  if (expected.kind === 'point') {
    assertMatch(
      group.getAttribute('transform') === `translate(${first.x} ${first.y})`,
      'SVG point position',
      expected.id,
    );
    assertMatch(
      shape.localName === 'circle' &&
        shape.getAttribute('r') === String(POINT_RADIUS) &&
        shape.getAttribute('stroke-width') === String(POINT_STROKE) &&
        shape.getAttribute('transform') === `scale(${scale})`,
      'SVG point symbol',
      expected.id,
    );

    return;
  }

  assertMatch(
    shape.localName === (expected.kind === 'route' ? 'polyline' : 'line') &&
      shape.getAttribute('stroke-width') === String(LINE_STROKE) &&
      shape.getAttribute('vector-effect') === 'non-scaling-stroke',
    'SVG line symbol',
    expected.id,
  );

  if (expected.kind === 'route') {
    assertMatch(
      shape.getAttribute('points') === positions.map(point => `${point.x},${point.y}`).join(' '),
      'SVG route coordinates',
      expected.id,
    );

    return;
  }

  const last = positions[1]!;
  assertMatch(
    ['x1', 'y1', 'x2', 'y2'].every(
      (attribute, index) =>
        shape.getAttribute(attribute) === String([first.x, first.y, last.x, last.y].at(index)),
    ),
    'SVG line coordinates',
    expected.id,
  );
}

function checkSvg(map: MapElement, expected: readonly ExpectedObject[]): void {
  const svg = map.shadowRoot!.querySelector('svg')!;
  const children = Array.from(svg.querySelector('[data-layer-id]')!.children);
  assertMatch(
    children.length === expected.length + 1 && children[0]?.localName === 'image',
    'SVG composition',
  );
  assertMatch(
    svg.querySelectorAll('*').length === 2 * expected.length + 2 &&
      !svg.querySelector('[visibility="hidden"]'),
    'SVG node count/visibility',
  );
  const scale = map.camera.bounds.width / map.camera.viewport.width;

  expected.forEach((object, index) => {
    const group = children.at(index + 1)!;
    const kind = object.kind === 'route' ? 'polyline' : object.kind;
    assertMatch(
      group.localName === 'g' &&
        group.getAttribute('data-object-id') === object.id &&
        group.getAttribute('class') === `atlas-${kind}` &&
        group.childElementCount === 1,
      'SVG ordered primitives',
      object.id,
    );
    checkShape(group, object, scale);
  });
}

function covers(object: ExpectedObject, point: Point, zoom: number): boolean {
  if (object.kind === 'point') {
    const position = object.points[0]!.position;

    return (
      Math.hypot(point.x - position.x, point.y - position.y) * zoom <=
      POINT_RADIUS + POINT_STROKE / 2
    );
  }

  return object.points
    .slice(1)
    .some(
      (end, index) =>
        squaredDistanceToSegment(point, object.points.at(index)!.position, end.position) <=
        (LINE_STROKE / (2 * zoom)) ** 2,
    );
}

function checkPicking(
  spatial: Spatial,
  objects: readonly ExpectedObject[],
  point: Point,
  camera: Camera,
): void {
  const { center, viewport, zoom } = camera;
  const x = (point.x - center.x) * zoom;
  const y = (point.y - center.y) * zoom;
  const visible =
    x >= -viewport.width / 2 &&
    x < viewport.width / 2 &&
    y >= -viewport.height / 2 &&
    y < viewport.height / 2;
  const expected = visible ? objects.find(object => covers(object, point, zoom)) : undefined;
  const actual = spatial.hitTest(point, camera);
  assertMatch(
    actual?.object.id === expected?.id && actual?.route?.id === expected?.routeId,
    'picking identity/owner',
    expected?.id,
  );
}

/** Prepare before timing/reset; invoke after timing AND instrumentation counters are recorded. */
export function prepareMutationCheck(
  map: MapElement,
  scene: StressScene,
  scenario: string,
): (() => void) | undefined {
  if (
    !scenario.startsWith('position-') &&
    !scenario.startsWith('add-') &&
    !scenario.startsWith('remove-') &&
    scenario !== ROUTE_SCENARIO
  ) {
    return undefined;
  }

  const { roots, probes } = expectedMutation(scene, scenario);
  const expected = primitives(roots);
  const pickingOrder = expected.slice().reverse();

  // Retain the pre-operation spatial view so stale coordinate/membership caches fail.
  const geometry = prepareSceneGeometry(map.objects, map.layers);
  const spatial = new Spatial(geometry);
  const focus = new Camera();
  focus.resize(map.camera.viewport);
  focus.zoom = PROBE_ZOOM;

  return (): void => {
    checkRoots(map, roots);
    checkSvg(map, expected);
    const entries = geometry.objects;
    assertMatch(entries.length === expected.length, 'spatial composition');
    expected.forEach((object, index) => {
      const entry = entries.at(index)!;
      assertMatch(
        entry.object.id === object.id && entry.route?.id === object.routeId,
        'spatial order/owner',
        object.id,
      );
      checkGeometry(entry.geometry, object);
    });
    checkPicking(spatial, pickingOrder, HIT_POSITION, map.camera);
    checkPicking(spatial, pickingOrder, MISS_POSITION, map.camera);

    for (const point of probes) {
      checkPicking(spatial, pickingOrder, point, map.camera);

      // A diagnostic camera separates dense, overlapping symbols. It never changes
      // the displayed camera or the measured scene.
      focus.center = point;
      checkPicking(spatial, pickingOrder, point, focus);
    }
  };
}
