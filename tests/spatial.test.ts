import { describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { Point } from '#math/point.js';
import { Size } from '#math/size.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { pointDefinition } from './fixtures.js';

import type { SceneGeometry } from '#spatial/scene-geometry.js';

function createSpatial(objects: MapObjectCollection): {
  camera: Camera;
  scene: SceneGeometry;
  spatial: Spatial;
} {
  const camera = new Camera();
  camera.resize(new Size(1600, 1000));
  camera.center = new Point(300, 100);
  const scene = prepareSceneGeometry(objects);

  return { camera, scene, spatial: new Spatial(scene) };
}

describe('picking current state without rendering', () => {
  it('sees point and line endpoint edits synchronously and returns original runtime objects', () => {
    const objects = new MapObjectCollection();
    const point = objects.add(pointDefinition(0));
    const line = objects.add({
      kind: 'line',
      points: [pointDefinition(100), pointDefinition(300)],
    });
    const { camera, spatial } = createSpatial(objects);
    const changed = vi.fn(() => spatial.hitTest(new Point(0, 100), camera));
    point.addEventListener('change', changed);
    point.position = new Point(0, 100);

    expect(changed).toHaveReturnedWith(expect.objectContaining({ object: point }));
    expect(spatial.hitTest(new Point(0, 100), camera)?.object).toBe(point);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(200, 0), camera)?.object).toBe(line);
    line.points[0].position = new Point(100, 100);
    line.points[1].position = new Point(300, 100);
    expect(spatial.hitTest(new Point(200, 100), camera)?.object).toBe(line);
    expect(spatial.hitTest(new Point(200, 0), camera)).toBeUndefined();
  });

  it('sees root additions and removals inside membership handlers, including equal-size replacement', () => {
    const objects = new MapObjectCollection();
    const original = objects.add(pointDefinition(0, 0, 'same'));
    const { camera, spatial } = createSpatial(objects);
    const removed = vi.fn(() => spatial.hitTest(new Point(0, 0), camera));
    const added = vi.fn(() => spatial.hitTest(new Point(100, 0), camera));
    objects.addEventListener('remove', removed);
    objects.addEventListener('add', added);
    objects.remove(original);
    const replacement = objects.add(pointDefinition(100, 0, 'same'));

    expect(removed).toHaveReturnedWith(undefined);
    expect(added).toHaveReturnedWith(expect.objectContaining({ object: replacement }));
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(100, 0), camera)?.object).toBe(replacement);

    // Perform another remove/add pair with no intervening scene read.
    objects.removeEventListener('remove', removed);
    objects.removeEventListener('add', added);
    objects.remove(replacement);
    const latest = objects.add(pointDefinition(200, 0, 'same'));
    expect(spatial.hitTest(new Point(100, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(200, 0), camera)?.object).toBe(latest);
  });

  it('sees route insertion, removal, append and equal-length replacement before render', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200), pointDefinition(400)],
    });
    const { camera, spatial } = createSpatial(objects);
    const changed = vi.fn(() => spatial.hitTest(new Point(100, 100), camera));
    route.addEventListener('change', changed);
    const inserted = route.insertPoint(1, pointDefinition(100, 100));
    expect(changed).toHaveReturnedWith(expect.objectContaining({ object: inserted, route }));
    expect(spatial.hitTest(new Point(100, 100), camera)?.object).toBe(inserted);
    expect(spatial.hitTest(new Point(100, 100), camera)?.route).toBe(route);
    expect(spatial.hitTest(new Point(100, 0), camera)).toBeUndefined();

    route.removePoint(inserted);
    expect(spatial.hitTest(new Point(100, 100), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(100, 0), camera)?.object).toBe(route);
    const appended = route.addPoint(pointDefinition(600, 100));
    expect(spatial.hitTest(new Point(600, 100), camera)?.object).toBe(appended);
    expect(spatial.hitTest(new Point(500, 50), camera)?.object).toBe(route);
    const oldMiddle = route.points[1]!;
    const [replacement] = route.replacePoints(1, 2, [pointDefinition(200, 150)]);
    expect(spatial.hitTest(new Point(200, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(200, 150), camera)?.object).toBe(replacement);
    expect(spatial.hitTest(new Point(100, 75), camera)?.object).toBe(route);
    oldMiddle.position = new Point(700, 300);
    expect(spatial.hitTest(new Point(700, 300), camera)).toBeUndefined();
  });

  it('picks the live route path after position edits and preserves vertex owner context', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200)],
    });
    const { camera, spatial } = createSpatial(objects);
    const vertex = route.points[1]!;
    expect(spatial.hitTest(new Point(100, 0), camera)?.object).toBe(route);
    expect(spatial.hitTest(new Point(100, 0), camera)?.route).toBeUndefined();
    vertex.position = new Point(200, 100);
    expect(spatial.hitTest(new Point(100, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(100, 50), camera)?.object).toBe(route);
    expect(spatial.hitTest(new Point(200, 100), camera)?.object).toBe(vertex);
    expect(spatial.hitTest(new Point(200, 100), camera)?.route).toBe(route);
  });

  it('preserves surviving scene entries and live coordinate views through route edits', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200), pointDefinition(400)],
    });
    const { scene } = createSpatial(objects);
    const entries = scene.objects;
    const path = entries[0]!;

    if (path.geometry.kind !== 'polyline') {
      throw new Error('Expected polyline geometry for the route fixture.');
    }

    const positions = path.geometry.points;
    const start = route.points[0]!;
    start.position = new Point(10, 20);
    expect(scene.objects).toBe(entries);
    expect(path.geometry.points).toBe(positions);
    expect(positions[0]).toEqual(new Point(10, 20));
    route.insertPoint(1, pointDefinition(100, 100));
    expect(scene.objects[0]).toBe(path);
    expect(scene.objects[1]).toBe(entries[1]);
    expect(scene.objects[3]).toBe(entries[2]);
    expect(path.geometry.points[0]).toBe(positions[0]);
    expect(path.geometry.points[2]).toBe(positions[1]);
    route.replacePoints(1, 3, [pointDefinition(200, 200)]);
    expect(scene.objects[0]).toBe(path);
    expect(scene.objects[1]).toBe(entries[1]);
    expect(scene.objects[3]).toBe(entries[3]);
    expect(path.geometry.points[0]).toBe(positions[0]);
    expect(path.geometry.points[2]).toBe(positions[2]);
    start.position = new Point(30, 40);
    expect(positions[0]).toEqual(new Point(30, 40));
  });

  it('keeps separate owner context for the same point attached as a root and route vertex', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({ kind: 'route', points: [pointDefinition(0)] });
    const vertex = route.points[0]!;
    const { camera, spatial } = createSpatial(objects);
    const owned = spatial.hitTest(new Point(0, 0), camera);
    expect(owned?.object).toBe(vertex);
    expect(owned?.route).toBe(route);
    objects.add(vertex);
    const root = spatial.hitTest(new Point(0, 0), camera);
    expect(root?.object).toBe(vertex);
    expect(root?.route).toBeUndefined();
    expect(root).not.toBe(owned);
    objects.remove(vertex);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBe(owned);
    objects.add(vertex);
    route.removePoint(vertex);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBe(root);
    vertex.position = new Point(100, 100);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
    expect(spatial.hitTest(new Point(100, 100), camera)?.object).toBe(vertex);
    expect(spatial.hitTest(new Point(100, 100), camera)?.route).toBeUndefined();
  });

  it('uses reverse root composition order even when IDs are equal', () => {
    const objects = new MapObjectCollection();
    const first = objects.add(pointDefinition(0, 0, 'same'));
    const second = objects.add(pointDefinition(0, 0, 'same'));
    const { camera, spatial } = createSpatial(objects);
    expect(spatial.hitTest(new Point(0, 0), camera)?.object).toBe(second);
    objects.remove(second);
    expect(spatial.hitTest(new Point(0, 0), camera)?.object).toBe(first);
  });

  it('uses shared symbol dimensions in screen pixels at different zooms', () => {
    const objects = new MapObjectCollection();
    const point = objects.add(pointDefinition(0));
    const line = objects.add({
      kind: 'line',
      points: [pointDefinition(100), pointDefinition(300)],
    });
    const { camera, scene, spatial } = createSpatial(objects);
    const pointRadius = scene.symbols.point.radius + scene.symbols.point.strokeWidth / 2;
    const lineRadius = scene.symbols.line.strokeWidth / 2;

    for (const zoom of [0.5, 1, 2]) {
      camera.zoom = zoom;
      expect(spatial.hitTest(new Point(pointRadius / zoom, 0), camera)?.object).toBe(point);
      expect(spatial.hitTest(new Point((pointRadius + 1) / zoom, 0), camera)).toBeUndefined();
      expect(spatial.hitTest(new Point(200, lineRadius / zoom), camera)?.object).toBe(line);
      expect(spatial.hitTest(new Point(200, (lineRadius + 1) / zoom), camera)).toBeUndefined();
    }
  });

  it('returns no hit outside the viewport or for a zero-sized viewport', () => {
    const objects = new MapObjectCollection();
    objects.add(pointDefinition(0));
    const { camera, spatial } = createSpatial(objects);
    camera.center = new Point(100, 0);
    camera.resize(new Size(100, 100));
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
    camera.center = new Point(0, 0);
    camera.resize(new Size(0, 100));
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
  });

  it('allows empty routes and picks a single vertex without inventing a path', () => {
    const objects = new MapObjectCollection();
    const route = objects.add({ kind: 'route', points: [] });
    const { camera, spatial } = createSpatial(objects);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
    const vertex = route.addPoint(pointDefinition(0));
    expect(spatial.hitTest(new Point(0, 0), camera)?.object).toBe(vertex);
    expect(spatial.hitTest(new Point(50, 0), camera)).toBeUndefined();
    route.removePoint(vertex);
    expect(spatial.hitTest(new Point(0, 0), camera)).toBeUndefined();
  });
});
