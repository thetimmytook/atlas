import { describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';
import { MapPoint } from '#objects/map-point.js';

import { pointDefinition, editableModel, selectAddedRoots } from './fixtures.js';

import type { MapRoute } from '#objects/map-route.js';

function camera(): Camera {
  const view = new Camera();
  view.resize(new Size(1000, 600));

  return view;
}

function createModel(): MapModel {
  const model = new MapModel(
    resolveMapDefinition({
      layers: [
        {
          id: 'content',
          objects: ['point'],
          background: { source: '/map.png', size: new Size(1000, 600) },
        },
      ],
      objects: [pointDefinition(0, 0, 'point')],
    }),
  );
  selectAddedRoots(model.objects, model.layers[0]!);

  return model;
}

describe('internal DOM-independent scene model', () => {
  it('creates an empty scene without DOM or renderer and keeps its collection stable', () => {
    expect(globalThis).not.toHaveProperty('HTMLElement');
    expect(globalThis).not.toHaveProperty('document');
    expect(globalThis).not.toHaveProperty('SVGElement');
    const model = new MapModel();
    const objects = model.objects;
    expect(model.definition).toBeUndefined();
    expect(model.geometry.objects).toEqual([]);
    expect(model.spatial.hitTest(new Point2(0, 0), camera())).toBeUndefined();
    const point = objects.add(pointDefinition(0));
    expect(model.objects).toBe(objects);
    expect(model.spatial.hitTest(new Point2(0, 0), camera())).toBeUndefined();
    expect(model.layers).toEqual([]);
    expect(objects.get(point.id)).toBe(point);
  });

  it('retains resolved input while querying current runtime state with each supplied camera', () => {
    const model = createModel();
    const point = model.objects.get('point') as MapPoint;
    const firstView = camera();
    const secondView = camera();
    secondView.zoom = 2;
    expect(model.spatial.hitTest(new Point2(10, 0), firstView)?.object).toBe(point);
    expect(model.spatial.hitTest(new Point2(10, 0), secondView)).toBeUndefined();
    point.position = new Point2(100, 100);
    expect(model.spatial.hitTest(new Point2(100, 100), firstView)?.object).toBe(point);
    expect(model.spatial.hitTest(new Point2(0, 0), firstView)).toBeUndefined();
    expect(model.definition?.objects[0]).toMatchObject({ position: { x: 0, y: 0 } });
  });

  it('observes root, owned-point and collection changes without changing runtime identity', () => {
    const model = createModel();
    model.layers[0]!.objectIds.add('route');
    const changed = vi.fn();
    model.addEventListener('change', changed);
    model.observeChanges();
    const point = model.objects.get('point') as MapPoint;
    point.position = new Point2(100, 100);
    expect(changed).toHaveBeenCalledOnce();
    const route = model.objects.add({
      id: 'route',
      kind: 'route',
      points: [pointDefinition(0), pointDefinition(200)],
    });
    expect(changed).toHaveBeenCalledTimes(2);
    route.points[0]!.position = new Point2(0, 100);
    route.insertPoint(1, pointDefinition(100, 100));
    expect(changed).toHaveBeenCalledTimes(4);
    expect(model.spatial.hitTest(new Point2(100, 100), camera())?.object).toBe(route.points[1]);
    model.objects.remove(point);
    expect(changed).toHaveBeenCalledTimes(5);
    point.position = new Point2(300, 100);
    expect(changed).toHaveBeenCalledTimes(5);
  });

  it('stops observation while objects remain functional and resumes current membership once', () => {
    const model = createModel();
    const changed = vi.fn();
    const point = model.objects.get('point') as MapPoint;
    const runtimeChanged = vi.fn();
    point.addEventListener('change', runtimeChanged);
    model.addEventListener('change', changed);
    model.observeChanges();
    model.unobserveChanges();
    model.unobserveChanges();
    point.position = new Point2(100, 100);
    const added = model.objects.add(pointDefinition(200, 100));
    expect(changed).not.toHaveBeenCalled();
    expect(runtimeChanged).toHaveBeenCalledOnce();
    expect(model.spatial.hitTest(new Point2(100, 100), camera())?.object).toBe(point);
    model.objects.remove(point);
    model.observeChanges();
    model.observeChanges();
    added.position = new Point2(250, 100);
    point.position = new Point2(150, 100);
    expect(changed).toHaveBeenCalledOnce();
    model.objects.add(added);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('keeps scene queries and surviving geometry views current during stopped observation', () => {
    const model = editableModel();
    const route = model.objects.add({
      kind: 'route',
      points: [pointDefinition(-200), pointDefinition(0), pointDefinition(200)],
    });
    const original = model.objects.add(pointDefinition(300, 100));
    const entries = model.geometry.objects;
    const path = entries[0]!;

    if (path.geometry.kind !== 'polyline') {
      throw new Error('Expected a route path fixture.');
    }

    const coordinates = path.geometry.points;
    model.observeChanges();
    model.unobserveChanges();
    route.points[0]!.position = new Point2(-200, 100);
    const [replacement] = route.replacePoints(1, 2, [pointDefinition(0, 100)]);
    model.objects.remove(original);
    const added = model.objects.add(pointDefinition(300, 200));
    const view = camera();
    expect(model.spatial.hitTest(new Point2(0, 100), view)?.object).toBe(replacement);
    expect(model.spatial.hitTest(new Point2(-100, 100), view)?.object).toBe(route);
    expect(model.spatial.hitTest(new Point2(0, 0), view)).toBeUndefined();
    expect(model.spatial.hitTest(new Point2(300, 100), view)).toBeUndefined();
    expect(model.spatial.hitTest(new Point2(300, 200), view)?.object).toBe(added);
    expect(model.geometry.objects[0]).toBe(path);
    expect(model.geometry.objects[1]).toBe(entries[1]);
    expect(path.geometry.points[0]).toBe(coordinates[0]);
    expect(path.geometry.points[2]).toBe(coordinates[2]);
    expect(coordinates[0]).toEqual(new Point3(-200, 100, 0));
    model.observeChanges();
    expect(model.spatial.hitTest(new Point2(0, 100), view)?.object).toBe(replacement);
  });

  it('does not subscribe to a root removed by an earlier addition handler', () => {
    const model = editableModel();
    const point = new MapPoint(pointDefinition(0));
    const subscribe = vi.spyOn(point, 'addEventListener');
    model.objects.addEventListener('add', () => {
      model.objects.remove(point);
    });
    const changed = vi.fn();
    model.addEventListener('change', changed);
    model.observeChanges();
    model.objects.add(point);
    expect(model.objects.size).toBe(0);
    expect(subscribe).not.toHaveBeenCalled();
    changed.mockClear();
    point.position = new Point2(100, 100);
    expect(changed).not.toHaveBeenCalled();
  });

  it.each(['before observation', 'after observation'] as const)(
    'preserves reattachment in a remove handler registered %s without duplicate changes',
    order => {
      const model = createModel();
      const point = model.objects.get('point') as MapPoint;

      const reattach = (): void => {
        model.objects.add(point);
      };

      if (order === 'before observation') {
        model.objects.addEventListener('remove', reattach);
      }

      model.observeChanges();

      if (order === 'after observation') {
        model.objects.addEventListener('remove', reattach);
      }

      const changed = vi.fn();
      model.addEventListener('change', changed);
      model.objects.remove(point);
      expect(model.objects.get(point.id)).toBe(point);
      changed.mockClear();
      model.observeChanges();
      model.objects.add(point);
      point.position = new Point2(100, 100);
      expect(changed).toHaveBeenCalledOnce();
      model.unobserveChanges();
      changed.mockClear();
      point.position = new Point2(200, 100);
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it('releases removed roots when an earlier removal handler stops observation', () => {
    const model = createModel();
    const point = model.objects.get('point') as MapPoint;
    model.objects.addEventListener('remove', () => {
      model.unobserveChanges();
    });
    model.observeChanges();
    const release = vi.spyOn(point, 'removeEventListener');
    const changed = vi.fn();
    model.addEventListener('change', changed);
    model.objects.remove(point);
    expect(release).toHaveBeenCalledWith('change', expect.any(Function));
    point.position = new Point2(100, 100);
    expect(changed).not.toHaveBeenCalled();
    model.observeChanges();
    model.objects.add(point);
    changed.mockClear();
    point.position = new Point2(200, 100);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('can stop and resume observation inside a removal handler after reattaching the root', () => {
    const model = createModel();
    const point = model.objects.get('point') as MapPoint;
    model.objects.addEventListener('remove', () => {
      model.unobserveChanges();
      model.objects.add(point);
      model.observeChanges();
    });
    model.observeChanges();
    model.objects.remove(point);
    const changed = vi.fn();
    model.addEventListener('change', changed);
    point.position = new Point2(100, 100);
    expect(changed).toHaveBeenCalledOnce();
    model.unobserveChanges();
    changed.mockClear();
    point.position = new Point2(200, 100);
    expect(changed).not.toHaveBeenCalled();
  });

  it('releases the model listener from an externally retained route without disposing it', () => {
    const model = editableModel();
    const route = model.objects.add({ kind: 'route', points: [pointDefinition(0)] });
    model.observeChanges();
    const release = vi.spyOn(route, 'removeEventListener');
    const changed = vi.fn();
    model.addEventListener('change', changed);
    model.unobserveChanges();
    expect(release).toHaveBeenCalledWith('change', expect.any(Function));
    route.points[0]!.position = new Point2(100, 100);
    route.addPoint(pointDefinition(200, 100));
    expect(changed).not.toHaveBeenCalled();
    expect(model.spatial.hitTest(new Point2(150, 100), camera())?.object).toBe(route);
  });

  it('keeps shared runtime instances and duplicate IDs with independent model observation', () => {
    const first = createModel();
    const second = editableModel();
    const point = first.objects.get('point') as MapPoint;
    const duplicate = second.objects.add(pointDefinition(200, 100, point.id));
    expect(second.objects.add(point)).toBe(point);
    expect(second.objects.get(point.id)).toBe(duplicate);
    const route = first.objects.add({ kind: 'route', points: [pointDefinition(300)] });
    expect(second.objects.add(route)).toBe(route);
    expect(second.objects.get(route.id) as MapRoute).toBe(route);
    first.observeChanges();
    second.observeChanges();
    const firstChanged = vi.fn();
    const secondChanged = vi.fn();
    first.addEventListener('change', firstChanged);
    second.addEventListener('change', secondChanged);
    first.unobserveChanges();
    point.position = new Point2(100, 100);
    route.points[0]!.position = new Point2(300, 100);
    expect(firstChanged).not.toHaveBeenCalled();
    expect(secondChanged).toHaveBeenCalledTimes(2);
    expect(first.spatial.hitTest(new Point2(300, 100), camera())?.object).toBe(route.points[0]);
    expect(second.spatial.hitTest(new Point2(300, 100), camera())?.object).toBe(route.points[0]);
  });
});
