import { afterEach, describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';
import { MapPoint } from '#objects/map-point.js';
import * as intersection from '#spatial/intersection.js';

import type { MapDefinition, MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { MapRoute } from '#objects/map-route.js';
import type { SceneObject } from '#spatial/scene-geometry.js';

const EXPECTED_LINE = 'Expected line.';
const FLOOR = { min: { z: 0 }, max: { z: 3 } };

function vertex(x: number, y: number, z: number, id?: string): MapPointDefinition {
  return { kind: 'point', ...(id === undefined ? {} : { id }), position: new Point3(x, y, z) };
}

function camera(): Camera {
  const result = new Camera();
  result.resize(new Size(320, 240));
  result.center = new Point2(160, 120);

  return result;
}

function model(
  objects: readonly MapEntryDefinition[],
  bounds: IntersectionBounds = FLOOR,
): MapModel {
  return new MapModel(
    resolveMapDefinition({ objects, layers: [{ id: 'floor', intersectionBounds: bounds }] }),
  );
}

function pathPoints(entry: SceneObject): readonly Point2[] {
  if (entry.geometry.kind !== 'polyline') {
    throw new Error('Expected polyline.');
  }

  return entry.geometry.points;
}

afterEach(() => vi.restoreAllMocks());

describe('automatic appearances', () => {
  it('considers all roots, including direct content of other layers, without changing layer.objects', () => {
    const scene = new MapModel(
      resolveMapDefinition({
        objects: [vertex(40, 30, 1, 'shared')],
        layers: [
          { id: 'direct', objects: ['shared'] },
          { id: 'auto', intersectionBounds: FLOOR },
          { id: 'off' },
        ],
      }),
    );
    const root = scene.objects.get('shared')!;
    expect(scene.geometry.objects.map(entry => entry.layer.id)).toEqual(['direct', 'auto']);
    expect(scene.geometry.objects.every(entry => entry.object === root)).toBe(true);
    expect(scene.layers[1]!.objects).toEqual([]);
    expect([...scene.layers[1]!.objectIds]).toEqual([]);
    expect(scene.layers[1]!.intersectionBounds).toBe(
      scene.definition!.layers[1]!.intersectionBounds,
    );
    expect(Reflect.set(scene.layers[1]!, 'intersectionBounds', FLOOR)).toBe(false);
  });

  it('assigns a shared-boundary marker only to the upper floor and updates before RAF', () => {
    const scene = new MapModel(
      resolveMapDefinition({
        objects: [vertex(80, 60, 3, 'marker')],
        layers: [
          { id: 'lower', intersectionBounds: FLOOR },
          { id: 'upper', intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
        ],
      }),
    );
    const point = scene.objects.get('marker') as MapPoint;
    expect(scene.geometry.objects.map(entry => entry.layer.id)).toEqual(['upper']);
    expect(scene.spatial.hitTest(point.position, camera())?.layer.id).toBe('upper');
    point.position = new Point3(80, 60, -1);
    expect(scene.spatial.hitTest(point.position, camera())).toBeUndefined();
    point.position = new Point2(80, 60);
    expect(scene.spatial.hitTest(point.position, camera())?.layer.id).toBe('lower');
  });

  it.each([
    [{ min: { x: 50 }, max: { x: 150 } }, new Point3(50, 100, -2), new Point3(150, 100, 2)],
    [{ min: { z: -1 }, max: { z: 1 } }, new Point3(75, 100, -1), new Point3(125, 100, 1)],
    [
      { min: { x: 50, z: -1 }, max: { y: 110, z: 1 } },
      new Point3(75, 100, -1),
      new Point3(125, 100, 1),
    ],
  ] as const)('shares exact line cuts with queries for bounds %j', (bounds, start, end) => {
    const scene = model(
      [{ id: 'line', kind: 'line', points: [vertex(0, 100, -4), vertex(200, 100, 4)] }],
      bounds,
    );
    const geometry = scene.geometry.objects[0]!.geometry;
    expect(geometry.kind).toBe('line');

    if (geometry.kind !== 'line') {
      throw new Error(EXPECTED_LINE);
    }

    expect(geometry.start).toEqual(start);
    expect(geometry.end).toEqual(end);
    expect(scene.spatial.hitTest(new Point2(100, 100), camera())?.object).toBe(
      scene.objects.get('line'),
    );
    expect(scene.spatial.hitTest(new Point2(10, 100), camera())).toBeUndefined();
  });

  it('keeps separate path fragments, original vertices and identities without points at cuts', () => {
    const scene = model([
      {
        id: 'route',
        kind: 'route',
        points: [vertex(20, 100, 1, 'a'), vertex(120, 100, 5, 'b'), vertex(220, 100, 1, 'c')],
      },
    ]);
    const route = scene.objects.get('route') as MapRoute;
    const points = route.points;
    const entries = scene.geometry.objects;
    expect(entries.map(entry => entry.object.id)).toEqual(['route', 'route', 'a', 'c']);
    expect(pathPoints(entries[0]!)).toEqual([new Point3(20, 100, 1), new Point3(70, 100, 3)]);
    expect(pathPoints(entries[1]!)).toEqual([new Point3(170, 100, 3), new Point3(220, 100, 1)]);
    expect(scene.objects.size).toBe(1);
    expect(route.points).toBe(points);
    expect(route.points).toHaveLength(3);
    expect(scene.spatial.hitTest(new Point2(120, 100), camera())).toBeUndefined();
    expect(scene.spatial.hitTest(new Point2(70, 100), camera())?.object).toBe(route);
    expect(scene.spatial.hitTest(new Point2(20, 100), camera())).toMatchObject({
      object: points[0],
      route,
      layer: scene.layers[0],
    });
    expect(scene.spatial.hitTest(new Point2(120, 100), camera())).toBeUndefined();
  });

  it('preserves root order and separate instances with duplicate IDs, and direct selection wins', () => {
    const scene = model([
      vertex(80, 60, 1, 'same'),
      vertex(80, 60, 9, 'same'),
      vertex(80, 60, 1, 'last'),
    ]);
    const roots = [...scene.objects];
    expect(scene.geometry.objects.map(entry => entry.object)).toEqual([roots[0], roots[2]]);
    scene.layers[0]!.objectIds.add('same');
    expect(scene.geometry.objects.map(entry => entry.object)).toEqual(roots);
    expect(scene.layers[0]!.objects).toEqual(roots.slice(0, 2));
    expect(scene.spatial.hitTest(new Point2(80, 60), camera())?.object).toBe(roots[2]);
    scene.layers[0]!.objectIds.remove('same');
    expect(scene.geometry.objects.map(entry => entry.object)).toEqual([roots[0], roots[2]]);
    expect(scene.objects.get('same')).toBe(roots[0]);
  });

  it('displays a directly selected route whole with no additional auto fragments or symbols', () => {
    const scene = model([
      {
        id: 'route',
        kind: 'route',
        points: [vertex(20, 100, 1, 'a'), vertex(120, 100, 5, 'b'), vertex(220, 100, 1, 'c')],
      },
    ]);
    scene.layers[0]!.objectIds.add('route');
    const clipping = vi.spyOn(intersection, 'clipPolyline');
    const entries = scene.geometry.objects;
    expect(entries.map(entry => entry.object.id)).toEqual(['route', 'a', 'b', 'c']);
    expect(pathPoints(entries[0]!)).toHaveLength(3);
    expect(clipping).not.toHaveBeenCalled();
    expect(scene.spatial.hitTest(new Point2(120, 100), camera())?.object.id).toBe('b');
  });

  it('limits clipping to the affected root and preserves entries/views when composition stays the same', () => {
    const scene = model([
      {
        id: 'route',
        kind: 'route',
        points: [vertex(20, 100, 1, 'a'), vertex(120, 100, 5, 'b'), vertex(220, 100, 1, 'c')],
      },
      { id: 'other', kind: 'route', points: [vertex(20, 180, 1), vertex(200, 180, 1)] },
    ]);
    const route = scene.objects.get('route') as MapRoute;
    const entries = scene.geometry.objects;
    const geometry = entries[0]!.geometry;
    const positions = pathPoints(entries[0]!);
    scene.geometry.takeChanges();
    const clipping = vi.spyOn(intersection, 'clipPolyline');
    const roots = vi.spyOn(scene.objects, Symbol.iterator);
    route.points[1]!.position = new Point3(120, 100, 9);
    expect(scene.geometry.objects).toBe(entries);
    expect(entries[0]!.geometry).toBe(geometry);
    expect(pathPoints(entries[0]!)).toBe(positions);
    expect(positions[1]!.x).toBe(45);
    expect(clipping).toHaveBeenCalledTimes(1);
    expect(roots).not.toHaveBeenCalled();
    expect([...scene.geometry.takeChanges()].map(entry => entry.object.id)).toEqual([
      'route',
      'route',
    ]);
    const view = camera();

    for (let i = 0; i < 10; i++) {
      view.center = new Point2(160 + i, 120);
      scene.layers[0]!.visible = i % 2 === 0;
      scene.spatial.hitTest(new Point2(45, 100), view);
    }

    expect(clipping).toHaveBeenCalledTimes(1);
    expect(scene.geometry.takeChanges().size).toBe(0);
  });

  it('tracks initially excluded and hidden geometry and resumes after remove/query/edit/reattach', () => {
    const scene = model([
      { id: 'route', kind: 'route', points: [vertex(20, 100, 8), vertex(220, 100, 8)] },
    ]);
    const route = scene.objects.get('route') as MapRoute;
    expect(scene.geometry.objects).toEqual([]);
    scene.layers[0]!.visible = false;
    scene.unobserveChanges();
    route.points[0]!.position = new Point3(20, 100, 1);
    expect(scene.geometry.objects).toHaveLength(2);
    const entries = scene.geometry.objects;
    expect(scene.spatial.hitTest(new Point2(50, 100), camera())).toBeUndefined();
    scene.layers[0]!.visible = true;
    expect(scene.spatial.hitTest(new Point2(50, 100), camera())?.object).toBe(route);
    scene.geometry.takeChanges();
    scene.objects.remove(route);
    expect(scene.spatial.hitTest(new Point2(50, 100), camera())).toBeUndefined();
    route.points[0]!.position = new Point3(20, 100, 2);
    expect(scene.geometry.takeChanges().size).toBe(0);
    scene.objects.add(route);
    expect(scene.geometry.objects[0]).toBe(entries[0]);
    expect(scene.spatial.hitTest(new Point2(40, 100), camera())?.object).toBe(route);
    expect(scene.geometry.takeChanges().has(entries[0]!)).toBe(true);
  });

  it('revalidates a captured fragment when its eligible geometry changes, without repicking underneath', () => {
    const scene = model([
      { id: 'line', kind: 'line', points: [vertex(20, 100, 1), vertex(220, 100, 5)] },
    ]);
    const view = camera();
    const hit = scene.spatial.hitTest(new Point2(80, 100), view)!;
    const line = scene.objects.get('line')!;

    if (line.kind !== 'line') {
      throw new Error(EXPECTED_LINE);
    }

    line.points[1].position = new Point3(220, 100, 21);
    expect(scene.spatial.hasHit(hit, new Point2(80, 100), view)).toBe(false);
    expect(scene.geometry.objects[0]).toBe(hit);
  });
});

describe('screen stroke hits at half-open boundaries', () => {
  it('allows hits near min/max whenever an eligible interior position is within the stroke radius', () => {
    const scene = model(
      [{ id: 'line', kind: 'line', points: [vertex(0, 100, 0), vertex(200, 100, 0)] }],
      { min: { x: 50 }, max: { x: 150 } },
    );
    const view = camera();

    for (const x of [48, 49, 50, 150, 151]) {
      expect(scene.spatial.hitTest(new Point2(x, 100), view)?.object.id).toBe('line');
    }

    expect(scene.spatial.hitTest(new Point2(152, 100), view)).toBeUndefined();
    expect(scene.spatial.hitTest(new Point2(47.9, 100), view)).toBeUndefined();
    expect(scene.spatial.hitTest(new Point2(150, 101.9), view)?.object.id).toBe('line');
    expect(scene.spatial.hitTest(new Point2(150, 102), view)).toBeUndefined();
    expect(scene.spatial.hitTest(new Point2(50, 102), view)?.object.id).toBe('line');
    view.zoom = 2;
    expect(scene.spatial.hitTest(new Point2(150.5, 100), view)?.object.id).toBe('line');
    expect(scene.spatial.hitTest(new Point2(151, 100), view)).toBeUndefined();
  });

  it('uses composition for overlapping floor stroke regions, including a vertical transition', () => {
    const data: MapDefinition = {
      objects: [{ id: 'line', kind: 'line', points: [vertex(20, 100, 0), vertex(220, 100, 6)] }],
      layers: [
        { id: 'lower', intersectionBounds: FLOOR },
        { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
      ],
    };
    const scene = new MapModel(resolveMapDefinition(data));
    const view = camera();
    expect(scene.spatial.hitTest(new Point2(120, 100), view)?.layer.id).toBe('upper');
    expect(scene.spatial.hitTest(new Point2(119, 100), view)?.layer.id).toBe('upper');
    scene.layers[1]!.visible = false;
    expect(scene.spatial.hitTest(new Point2(120, 100), view)?.layer.id).toBe('lower');
    scene.layers[1]!.visible = true;
    const line = scene.objects.get('line')!;

    if (line.kind !== 'line') {
      throw new Error(EXPECTED_LINE);
    }

    line.points[1].position = new Point3(20, 100, 6);
    expect(scene.spatial.hitTest(new Point2(20, 102), view)?.layer.id).toBe('upper');
    scene.layers[1]!.visible = false;
    expect(scene.spatial.hitTest(new Point2(20, 102), view)?.layer.id).toBe('lower');
  });
});
