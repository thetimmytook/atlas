import { describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Size } from '#math/size.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapPoint } from '#objects/map-point.js';
import { MapRoute } from '#objects/map-route.js';

import { pointDefinition } from './fixtures.js';

import type { MapEntryDefinition } from '#definitions/map-definition.js';

describe('root object membership', () => {
  it('copies definitions including owned points and leaves resolved load input unchanged by edits', () => {
    const input = { kind: 'point' as const, position: { x: 10, y: 20 } };
    const definition = {
      layers: [{ background: { source: '/map.png', size: { width: 500, height: 300 } } }],
      objects: [{ kind: 'route' as const, points: [input, input] }],
    };
    const resolved = resolveMapDefinition(definition);
    const first = new MapObjectCollection(resolved.objects);
    const second = new MapObjectCollection(resolved.objects);
    const firstRoute = Array.from(first)[0] as MapRoute;
    const secondRoute = Array.from(second)[0] as MapRoute;
    definition.layers[0]!.background.size.width = 999;
    input.position.x = 999;

    expect(resolved.layers[0]!.background!.size).toEqual(new Size(500, 300));
    expect(firstRoute.points[0]!.position).toEqual(new Point3(10, 20, 0));
    expect(firstRoute.id).toBe(secondRoute.id);
    expect(firstRoute).not.toBe(secondRoute);
    expect(firstRoute.points[0]).not.toBe(secondRoute.points[0]);
    expect(firstRoute.points[0]).not.toBe(firstRoute.points[1]);
    const id = firstRoute.points[0]!.id;
    firstRoute.points[0]!.position = new Point2(30, 40);
    expect(firstRoute.points[0]!.id).toBe(id);
    expect(secondRoute.points[0]!.position).toEqual(new Point3(10, 20, 0));
    expect(resolved.objects[0]?.kind).toBe('route');

    const resolvedRoute = resolved.objects[0];

    if (resolvedRoute?.kind !== 'route') {
      throw new Error('Expected a resolved route fixture.');
    }

    expect(resolvedRoute.points[0]!.position).toEqual(new Point3(10, 20, 0));
    expect(resolvedRoute.points[0]!.id).toBe(id);
  });

  it('copies dynamically added definitions and preserves retained iterator membership', () => {
    const objects = new MapObjectCollection();
    const original = objects.add(pointDefinition(0, 0, 'first'));
    const iterator = objects[Symbol.iterator]();
    const definition = { kind: 'point' as const, id: 'second', position: { x: 10, y: 20 } };
    const added = objects.add(definition);
    definition.position.x = 999;

    expect(added.position).toEqual(new Point3(10, 20, 0));
    expect(objects.size).toBe(2);
    expect(Array.from(iterator)).toHaveLength(1);
    expect(Array.from(objects)[0]).toBe(original);
    expect(Array.from(objects)[1]).toBe(added);
  });

  it('retains duplicate IDs in order and removes by exact reference', () => {
    const objects = new MapObjectCollection();
    const first = objects.add(pointDefinition(0, 0, 'same'));
    const second = objects.add(pointDefinition(100, 0, 'same'));
    const iterator = objects[Symbol.iterator]();
    const removed = vi.fn();
    objects.addEventListener('remove', removed);

    expect(objects.get('same')).toBe(first);
    expect(objects.remove(new MapPoint(pointDefinition(0, 0, 'same')))).toBe(false);
    expect(objects.size).toBe(2);
    expect(removed).not.toHaveBeenCalled();
    expect(objects.remove(first)).toBe(true);
    expect(objects.get('same')).toBe(second);
    expect(objects.size).toBe(1);
    expect(Array.from(iterator)[0]).toBe(first);
    expect(removed).toHaveBeenCalledOnce();
    expect(objects.remove(first)).toBe(false);
    expect(removed).toHaveBeenCalledOnce();

    const changed = vi.fn();
    first.addEventListener('change', changed);
    first.position = new Point2(50, 60);
    expect(first.id).toBe('same');
    expect(changed).toHaveBeenCalledOnce();
  });

  it('reattaches the same instance with current state and treats repeated attachment as a no-op', () => {
    const objects = new MapObjectCollection();
    const route = new MapRoute('route', [pointDefinition(0, 0, 'start')]);
    const first = route.points[0]!;
    objects.add(route);
    objects.remove(route);
    first.position = new Point2(10, 20);
    const appended = route.addPoint(pointDefinition(100, 0, 'end'));
    const added = vi.fn();
    objects.addEventListener('add', added);
    expect(objects.add(route)).toBe(route);
    expect(route.points[0]).toBe(first);
    expect(route.points[1]).toBe(appended);
    expect(objects.add(route)).toBe(route);
    expect(objects.size).toBe(1);
    expect(added).toHaveBeenCalledOnce();
  });

  it.each([
    pointDefinition(NaN),
    pointDefinition(0, 0, ''),
    { kind: 'line', points: [pointDefinition(0)] },
    { kind: 'line', points: [pointDefinition(0), pointDefinition(Infinity)] },
    { kind: 'route', points: [pointDefinition(0), pointDefinition(1, 0, ' ')] },
    { kind: 'route', points: Array(2) },
    { kind: 'unknown', position: { x: 0, y: 0 } },
  ] as readonly MapEntryDefinition[])(
    'rejects the complete input before adding a root: %j',
    definition => {
      const objects = new MapObjectCollection();
      const original = objects.add(pointDefinition(0, 0, 'original'));
      const added = vi.fn();
      objects.addEventListener('add', added);
      expect(() => objects.add(definition)).toThrow();
      expect(objects.size).toBe(1);
      expect(objects.get('original')).toBe(original);
      expect(Array.from(objects)[0]).toBe(original);
      expect(added).not.toHaveBeenCalled();
    },
  );
});
