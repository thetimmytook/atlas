import { describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { Point } from '#math/point.js';
import { Size } from '#math/size.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { Spatial } from '#spatial/spatial.js';

import { pointDefinition, objectScene, editableModel } from './fixtures.js';

import type { MapEntry } from '#objects/map-object-collection.js';

describe('explicit scene invalidation', () => {
  it('reads and picks unchanged geometry without scanning root or route membership', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200)],
    });
    const scene = objectScene(objects);
    const entries = scene.objects;
    const path = entries[0]!.geometry;
    expect(path.kind).toBe('polyline');
    const spatial = new Spatial(scene);
    const camera = new Camera();
    camera.resize(new Size(1000, 600));
    const roots = vi.spyOn(objects, Symbol.iterator);
    const points = vi.spyOn(route, 'points', 'get');

    for (let index = 0; index < 20; index++) {
      expect(scene.objects).toBe(entries);
      expect(spatial.hitTest(new Point(100, 0), camera)?.object).toBe(route);
    }

    expect(roots).not.toHaveBeenCalled();
    expect(points).not.toHaveBeenCalled();
    roots.mockRestore();
    points.mockRestore();
  });

  it('keeps retained polyline/coordinate views live and updates membership once', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200)],
    });
    const scene = objectScene(objects);
    const original = scene.objects;
    const geometry = original[0]!.geometry;
    expect(geometry.kind).toBe('polyline');

    if (geometry.kind !== 'polyline') {
      throw new Error('Expected route geometry.');
    }

    const positions = geometry.points;
    route.points[0]!.position = new Point(10, 20);
    expect(scene.objects).toBe(original);
    expect(geometry.points).toBe(positions);
    expect(positions[0]).toMatchObject({ x: 10, y: 20 });
    const inserted = route.insertPoint(1, pointDefinition(100, 80));
    const nextPositions = geometry.points;
    expect(nextPositions).toHaveLength(3);
    expect(nextPositions[0]).toBe(positions[0]);
    expect(nextPositions[2]).toBe(positions[1]);
    expect(nextPositions[1]).toMatchObject(inserted.position);
    const nextEntries = scene.objects;
    expect(nextEntries[0]).toBe(original[0]);
    expect(nextEntries[1]).toBe(original[1]);
    expect(nextEntries[3]).toBe(original[2]);
    expect(scene.objects).toBe(nextEntries);
    expect(geometry.points).toBe(nextPositions);
  });

  it('invalidates before earlier synchronous handlers and preserves edits across unobserve', () => {
    const model = editableModel();
    const camera = new Camera();
    camera.resize(new Size(1000, 600));
    const route = model.objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200)],
    });
    let hit: object | undefined;
    route.addEventListener('change', () => {
      hit = model.spatial.hitTest(new Point(100, 100), camera)?.object;
    });
    model.observeChanges();
    model.unobserveChanges();
    const inserted = route.insertPoint(1, pointDefinition(100, 100));
    expect(hit).toBe(inserted);
    inserted.position = new Point(100, 150);
    expect(model.spatial.hitTest(new Point(100, 150), camera)?.object).toBe(inserted);
    model.objects.remove(route);
    expect(model.spatial.hitTest(new Point(100, 150), camera)).toBeUndefined();
    model.objects.add(route);
    expect(model.spatial.hitTest(new Point(100, 150), camera)?.object).toBe(inserted);
    model.observeChanges();
    expect(model.spatial.hitTest(new Point(100, 150), camera)?.object).toBe(inserted);
    model.unobserveChanges();
  });
});

describe('reattachment after synchronous membership reconciliation', () => {
  it.each(['point', 'line', 'route'] as const)(
    'queues current geometry for a returned %s without keeping detached tracking',
    kind => {
      const objects = new MapObjectCollection();
      const root = createReattachmentRoot(objects, kind);
      const scene = objectScene(objects);
      const spatial = new Spatial(scene);
      const camera = new Camera();
      camera.resize(new Size(320, 240));
      const original = scene.objects;
      scene.takeChanges();
      objects.remove(root);
      expect(spatial.hitTest(new Point(40, 30), camera)).toBeUndefined();
      const point = root.kind === 'point' ? root : root.points[0];
      point.position = new Point(90, 80);
      expect(scene.takeChanges().size).toBe(0);
      objects.add(root);
      expect(spatial.hitTest(new Point(90, 80), camera)?.object).toBe(
        root.kind === 'route' ? point : root,
      );
      const returned = scene.objects;
      expect(returned).toHaveLength(original.length);
      returned.forEach((entry, index) => expect(entry).toBe(original.at(index)));
      const changes = scene.takeChanges();
      expect(changes.has(original[0]!)).toBe(true);

      if (root.kind === 'route') {
        expect(changes.has(original[1]!)).toBe(true);
      }

      expect(scene.takeChanges().size).toBe(0);
      objects.remove(root);
      expect(scene.objects).toEqual([]);
      scene.takeChanges();
      point.position = new Point(100, 90);
      expect(scene.takeChanges().size).toBe(0);
    },
  );
});

it('keeps detached route edits out of surviving scene membership', () => {
  const objects = new MapObjectCollection();
  const route = objects.add({ kind: 'route', points: [pointDefinition(0), pointDefinition(200)] });
  objects.add(pointDefinition(100, 100));
  const scene = objectScene(objects);
  objects.remove(route);
  const survivors = scene.objects;
  scene.takeChanges();
  const roots = vi.spyOn(objects, Symbol.iterator);
  route.insertPoint(1, pointDefinition(100, 80));
  expect(scene.objects).toBe(survivors);
  expect(scene.takeChanges().size).toBe(0);
  expect(roots).not.toHaveBeenCalled();
  roots.mockRestore();
});

function createReattachmentRoot(
  objects: MapObjectCollection,
  kind: 'point' | 'line' | 'route',
): MapEntry {
  if (kind === 'point') {
    return objects.add(pointDefinition(40, 30));
  }

  const points = [pointDefinition(40, 30), pointDefinition(200, 60)] as const;

  if (kind === 'line') {
    return objects.add({ kind, points });
  }

  return objects.add({ kind, points });
}
