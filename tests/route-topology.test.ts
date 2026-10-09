import { afterEach, describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapRoute } from '#objects/map-route.js';
import type { SceneObject } from '#spatial/scene-geometry.js';

afterEach(() => vi.restoreAllMocks());

function point(id: string, x: number, y = 100, z = 1): MapPointDefinition {
  return { kind: 'point', id, position: { x, y, z } };
}

function definition(remove = false): MapDefinition {
  const unrelated = Array.from(
    { length: 80 },
    (_, index): NonNullable<MapDefinition['objects']>[number] => {
      const id = `other-${index}`;
      const x = 400 + index * 10;

      switch (index % 4) {
        case 0:
          return point(id, x);
        case 1:
          return { kind: 'line', id, points: [point(`${id}-a`, x), point(`${id}-b`, x + 5)] };
        case 2:
          return {
            kind: 'route',
            id,
            points: [point(`${id}-a`, x), point(`${id}-b`, x + 5, 110, 5)],
          };
        default:
          return {
            kind: 'polygon',
            id,
            baseZ: 1,
            height: 4,
            contour: [
              { x, y: 90 },
              { x: x + 5, y: 90 },
              { x, y: 95 },
            ],
          };
      }
    },
  );

  return {
    objects: [
      ...unrelated,
      {
        kind: 'route',
        id: 'route',
        points: [
          point('a', 20),
          point('b', 120, remove ? 160 : 100, remove ? 5 : 1),
          point('c', 220),
        ],
      },
    ],
    layers: [
      {
        id: 'direct',
        stackIndex: -1,
        objects: ['route'],
        intersectionBounds: { min: { z: 3 }, max: { z: 6 } },
      },
      { id: 'lower', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
      { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
    ],
  };
}

function createModel(remove = false): { model: MapModel; route: MapRoute; camera: Camera } {
  const model = new MapModel(resolveMapDefinition(definition(remove)));
  const route = model.objects.get('route') as MapRoute;
  const camera = new Camera();
  camera.resize(new Size(1600, 400));
  camera.center = new Point2(800, 200);

  return { model, route, camera };
}

function paths(entries: readonly SceneObject[], layer: string, route: MapRoute): number[][][] {
  return entries
    .filter(entry => entry.layer.id === layer && entry.object === route)
    .map(entry => {
      if (entry.geometry.kind !== 'polyline') {
        throw new Error('Expected route geometry.');
      }

      return entry.geometry.points.map(value => [value.x, value.y, value.z]);
    });
}

function watchGeometry(root: MapEntry): (() => void)[] {
  if (root.kind === 'polygon') {
    return (['contour', 'baseZ', 'height'] as const).map(key => {
      const spy = vi.spyOn(root, key, 'get');

      return () => expect(spy).not.toHaveBeenCalled();
    });
  }

  const points = root.kind === 'point' ? [root] : root.points;

  return points.map(vertex => {
    const spy = vi.spyOn(vertex, 'position', 'get');

    return () => expect(spy).not.toHaveBeenCalled();
  });
}

describe('route-owned topology among unrelated automatic roots', () => {
  it('tracks newly owned points even when topology leaves every automatic appearance empty', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [
          { kind: 'route', id: 'route', points: [point('a', 20, 100, 9), point('b', 220, 100, 9)] },
        ],
        layers: [{ id: 'floor', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } }],
      }),
    );
    const route = model.objects.get('route') as MapRoute;
    const camera = new Camera();
    camera.resize(new Size(400, 300));
    camera.center = new Point2(200, 150);
    const vertex = route.addPoint(point('new', 120, 180, 9));
    expect(model.geometry.objects).toEqual([]);
    expect(model.geometry.takeChanges().size).toBe(0);
    vertex.position = new Point3(120, 180, 1);
    expect(model.spatial.hitTest(vertex.position, camera)?.object).toBe(vertex);
    expect(paths(model.geometry.objects, 'floor', route)).toEqual([
      [
        [145, 160, 3],
        [120, 180, 1],
      ],
    ]);
    expect(model.geometry.takeChanges().size).toBeGreaterThan(0);
  });

  it.each(['add', 'insert', 'remove', 'replace'] as const)(
    'limits %s to route appearances and preserves geometry/picking',
    operation => {
      const { model, route, camera } = createModel(operation === 'remove');
      const before = model.geometry.objects;
      const survivors = route.points.filter(
        (_, index) => index !== 1 || operation === 'add' || operation === 'insert',
      );
      const unrelated = before.filter(entry => entry.object !== route && entry.route !== route);
      const checkUnread = Array.from(model.objects)
        .filter(root => root !== route)
        .flatMap(watchGeometry);
      const roots = vi.spyOn(model.objects, Symbol.iterator);
      model.geometry.takeChanges();
      let target = route.points[1]!;

      switch (operation) {
        case 'add':
          target = route.addPoint(point('d', 300, 160, 5));
          break;
        case 'insert':
          target = route.insertPoint(1, point('d', 70, 160, 5));
          break;
        case 'remove':
          expect(route.removePoint(target)).toBe(true);
          break;
        case 'replace':
          target = route.replacePoints(1, 2, [point('d', 120, 160, 5)])[0]!;
          break;
      }

      // No synchronization or clipping is performed by the mutation itself.
      checkUnread.forEach(check => check());
      const after = model.geometry.objects;
      const changes = model.geometry.takeChanges();
      checkUnread.forEach(check => check());
      expect(roots).not.toHaveBeenCalled();
      expect(changes.size).toBeGreaterThan(0);
      expect([...changes].every(entry => entry.object === route || entry.route === route)).toBe(
        true,
      );
      unrelated.forEach(entry => expect(after).toContain(entry));
      survivors.forEach(vertex => {
        expect(route.points).toContain(vertex);
        before
          .filter(entry => entry.object === vertex)
          .forEach(entry => expect(after).toContain(entry));
      });
      expect(after.find(entry => entry.object === route && entry.layer.id === 'direct')).toBe(
        before.find(entry => entry.object === route && entry.layer.id === 'direct'),
      );
      expect(after.find(entry => entry.object === route && entry.layer.id === 'lower')).toBe(
        before.find(entry => entry.object === route && entry.layer.id === 'lower'),
      );

      const a = [20, 100, 1];
      const b = [120, 100, 1];
      const c = [220, 100, 1];
      const expected = {
        add: {
          direct: [[a, b, c, [300, 160, 5]]],
          lower: [[a, b, c, [260, 130, 3]]],
          upper: [
            [
              [260, 130, 3],
              [300, 160, 5],
            ],
          ],
        },
        insert: {
          direct: [[a, [70, 160, 5], b, c]],
          lower: [
            [a, [45, 130, 3]],
            [[95, 130, 3], b, c],
          ],
          upper: [
            [
              [45, 130, 3],
              [70, 160, 5],
              [95, 130, 3],
            ],
          ],
        },
        remove: { direct: [[a, c]], lower: [[a, c]], upper: [] },
        replace: {
          direct: [[a, [120, 160, 5], c]],
          lower: [
            [a, [70, 130, 3]],
            [[170, 130, 3], c],
          ],
          upper: [
            [
              [70, 130, 3],
              [120, 160, 5],
              [170, 130, 3],
            ],
          ],
        },
      }[operation];

      for (const layer of ['direct', 'lower', 'upper'] as const) {
        expect(paths(after, layer, route)).toEqual(expected[layer]);
      }

      if (operation === 'remove') {
        expect(model.spatial.hitTest(new Point2(120, 160), camera)).toBeUndefined();
        expect(model.spatial.hitTest(new Point2(120, 100), camera)?.object).toBe(route);
      } else {
        const hit = model.spatial.hitTest(target.position, camera);
        expect(hit?.object).toBe(target);
        expect(hit?.route).toBe(route);
        expect(hit?.layer.id).toBe('upper');
      }

      expect(model.geometry.takeChanges().size).toBe(0);
    },
  );

  it('coalesces consecutive edits, releases removed points, and preserves independently attached points', () => {
    const { model, route, camera } = createModel();
    const removed = route.points[1]!;
    model.objects.add(removed);
    model.geometry.takeChanges();
    const transient = route.insertPoint(1, point('transient', 70, 160, 5));
    route.removePoint(transient);
    route.removePoint(removed);
    const [replacement] = route.replacePoints(1, 1, [point('replacement', 120, 160, 5)]);
    replacement!.position = new Point3(120, 180, 5);
    expect(model.spatial.hitTest(new Point2(120, 180), camera)?.object).toBe(replacement);
    expect(
      model.geometry.objects.some(
        entry => entry.route === route && (entry.object === removed || entry.object === transient),
      ),
    ).toBe(false);
    model.geometry.takeChanges();
    transient.position = new Point3(80, 180, 1);
    expect(model.geometry.takeChanges().size).toBe(0);
    removed.position = new Point3(350, 180, 1);
    const changes = [...model.geometry.takeChanges()];
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(entry => entry.object === removed && !entry.route)).toBe(true);
    expect(model.spatial.hitTest(removed.position, camera)?.object).toBe(removed);
    replacement!.position = new Point3(140, 180, 5);
    expect(model.spatial.hitTest(new Point2(140, 180), camera)?.object).toBe(replacement);
  });

  it('tracks new points before synchronous change handlers, including nested edits and shared maps', () => {
    const first = createModel();
    const second = createModel();
    second.model.objects.remove(second.route);
    second.model.objects.add(first.route);
    second.model.geometry.takeChanges();
    const hits: unknown[] = [];
    const listener = vi.fn(() => {
      const vertex = first.route.points[1]!;
      hits.push(first.model.spatial.hitTest(vertex.position, first.camera)?.object);
      hits.push(second.model.spatial.hitTest(vertex.position, second.camera)?.object);
      vertex.position = new Point3(70, 180, 5);
      hits.push(first.model.spatial.hitTest(vertex.position, first.camera)?.object);
      hits.push(second.model.spatial.hitTest(vertex.position, second.camera)?.object);
    });
    first.route.addEventListener('change', listener, { once: true });
    const vertex = first.route.insertPoint(1, point('new', 70, 160, 5));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(hits).toEqual([vertex, vertex, vertex, vertex]);

    // Synchronous picking must leave the display work pending for both maps.
    for (const model of [first.model, second.model]) {
      const changes = [...model.geometry.takeChanges()];
      expect(changes.some(entry => entry.object === vertex)).toBe(true);
      expect(changes.some(entry => entry.object === first.route)).toBe(true);
    }

    first.model.objects.remove(first.route);
    expect(first.model.spatial.hitTest(vertex.position, first.camera)).toBeUndefined();
    first.model.geometry.takeChanges();
    vertex.position = new Point3(70, 190, 5);
    first.route.addPoint(point('tail', 300, 190, 5));
    expect(first.model.geometry.takeChanges().size).toBe(0);
    expect(second.model.spatial.hitTest(vertex.position, second.camera)?.object).toBe(vertex);
    first.model.objects.add(first.route);
    expect(first.model.spatial.hitTest(vertex.position, first.camera)?.object).toBe(vertex);
    expect(paths(first.model.geometry.objects, 'direct', first.route)[0]).toHaveLength(5);
  });
});
