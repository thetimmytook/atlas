import { describe, expect, it, vi } from 'vitest';

import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { MapPoint } from '#objects/map-point.js';
import { MapRoute } from '#objects/map-route.js';

import { pointDefinition } from './fixtures.js';

import type { MapPointDefinition } from '#definitions/map-point-definition.js';

function createRoute(): MapRoute {
  return new MapRoute('route', [
    pointDefinition(0, 0, 'a'),
    pointDefinition(100, 0, 'b'),
    pointDefinition(200, 0, 'c'),
    pointDefinition(300, 0, 'd'),
  ]);
}

describe('route membership and surviving identity', () => {
  it('appends a copied point and keeps retained arrays and surviving points live', () => {
    const route = createRoute();
    const before = route.points;
    const definition = { kind: 'point' as const, position: { x: 400, y: 0 } };
    const changed = vi.fn(() => route.points);
    route.addEventListener('change', changed);
    const appended = route.addPoint(definition);
    definition.position.x = 999;

    expect(route.points).not.toBe(before);
    expect(Object.isFrozen(route.points)).toBe(true);
    expect(before).toHaveLength(4);
    before.forEach((point, index) => {
      expect(route.points.at(index)).toBe(point);
      expect(point.id).toBe(['a', 'b', 'c', 'd'].at(index));
    });
    expect(route.points[4]).toBe(appended);
    expect(appended.position).toEqual(new Point3(400, 0, 0));
    expect(appended.id.length).toBeGreaterThan(0);
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveReturnedWith(route.points);

    before[0]!.position = new Point2(5, 6);
    appended.position = new Point2(405, 6);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it.each([0, 2, 4])('inserts before index %i without replacing survivors', index => {
    const route = createRoute();
    const before = route.points;
    const changed = vi.fn();
    route.addEventListener('change', changed);
    const inserted = route.insertPoint(index, pointDefinition(50, 60, 'new'));

    expect(route.points.map(point => point.id)).toEqual([
      ...before.slice(0, index).map(point => point.id),
      'new',
      ...before.slice(index).map(point => point.id),
    ]);
    before.forEach((point, oldIndex) => {
      expect(route.points.at(oldIndex < index ? oldIndex : oldIndex + 1)).toBe(point);
    });
    expect(route.points.at(index)).toBe(inserted);
    expect(changed).toHaveBeenCalledOnce();
    inserted.position = new Point2(70, 80);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1, 3])(
    'removes the exact point at index %i and releases its owner notification',
    index => {
      const route = createRoute();
      const before = route.points;
      const removed = before.at(index)!;
      const changed = vi.fn();
      const pointChanged = vi.fn();
      route.addEventListener('change', changed);
      removed.addEventListener('change', pointChanged);

      expect(route.removePoint(removed)).toBe(true);
      expect(route.points.map(point => point.id)).toEqual(
        before.filter(point => point !== removed).map(point => point.id),
      );
      route.points.forEach((point, newIndex) => {
        expect(point).toBe(before.at(newIndex < index ? newIndex : newIndex + 1));
      });
      expect(before.at(index)).toBe(removed);
      expect(changed).toHaveBeenCalledOnce();

      removed.position = new Point2(900, 900);
      expect(removed.id).toBe(before.at(index)!.id);
      expect(pointChanged).toHaveBeenCalledOnce();
      expect(changed).toHaveBeenCalledOnce();
      route.points[0]!.position = new Point2(10, 10);
      expect(changed).toHaveBeenCalledTimes(2);
    },
  );

  it('does not remove a different instance with the same ID', () => {
    const route = createRoute();
    const before = route.points;
    const changed = vi.fn();
    route.addEventListener('change', changed);

    expect(route.removePoint(new MapPoint(pointDefinition(0, 0, 'a')))).toBe(false);
    expect(route.points).toBe(before);
    expect(changed).not.toHaveBeenCalled();
  });

  it('replaces a half-open range, copying definitions and preserving outside points and IDs', () => {
    const route = createRoute();
    const before = route.points;
    const definition = { kind: 'point' as const, id: 'b', position: { x: 50, y: 100 } };
    const changed = vi.fn(() => route.points);
    const removedChanged = vi.fn();
    route.addEventListener('change', changed);
    before[1]!.addEventListener('change', removedChanged);
    const replacements = route.replacePoints(1, 3, [definition, pointDefinition(200, 100)]);
    definition.position.x = 999;

    expect(route.points[0]).toBe(before[0]);
    expect(route.points[3]).toBe(before[3]);
    expect(route.points[0]!.id).toBe('a');
    expect(route.points[3]!.id).toBe('d');
    expect(route.points[1]).toBe(replacements[0]);
    expect(route.points[2]).toBe(replacements[1]);
    expect(replacements[0]).not.toBe(before[1]);
    expect(replacements[0]!.id).toBe('b');
    expect(replacements[0]!.position).toEqual(new Point3(50, 100, 0));
    expect(replacements[1]!.id.length).toBeGreaterThan(0);
    expect(Object.isFrozen(replacements)).toBe(true);
    expect(Object.isFrozen(route.points)).toBe(true);
    expect(before.map(point => point.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveReturnedWith(route.points);

    before[1]!.position = new Point2(1000, 1000);
    before[2]!.position = new Point2(2000, 2000);
    expect(removedChanged).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    before[0]!.position = new Point2(10, 20);
    replacements[0]!.position = new Point2(60, 100);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it.each([
    { start: 0, end: 0, ids: ['new', 'a', 'b', 'c', 'd'] },
    { start: 4, end: 4, ids: ['a', 'b', 'c', 'd', 'new'] },
    { start: 1, end: 3, ids: ['a', 'new', 'd'] },
    { start: 0, end: 4, ids: ['new'] },
  ])('uses range [$start, $end) with resulting order $ids', ({ start, end, ids }) => {
    const route = createRoute();
    route.replacePoints(start, end, [pointDefinition(50, 60, 'new')]);
    expect(route.points.map(point => point.id)).toEqual(ids);
  });

  it('deletes a range with an empty list and permits clearing or editing an empty route', () => {
    const route = createRoute();
    const before = route.points;
    expect(route.replacePoints(1, 3, [])).toHaveLength(0);
    expect(route.points[0]).toBe(before[0]);
    expect(route.points[1]).toBe(before[3]);
    route.replacePoints(0, 2, []);
    expect(route.points).toHaveLength(0);
    const first = route.insertPoint(0, pointDefinition(10));
    expect(route.removePoint(first)).toBe(true);
    expect(route.points).toHaveLength(0);
    const inserted = route.replacePoints(0, 0, [pointDefinition(20)]);
    expect(route.points[0]).toBe(inserted[0]);
  });

  it('preserves the point array and emits no event for an empty replacement of an empty range', () => {
    const route = createRoute();
    const before = route.points;
    const changed = vi.fn();
    route.addEventListener('change', changed);
    const replacements = route.replacePoints(2, 2, []);
    expect(replacements).toHaveLength(0);
    expect(Object.isFrozen(replacements)).toBe(true);
    expect(route.points).toBe(before);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('atomic rejection of route edits', () => {
  it.each([-1, 5, 0.5, NaN, Infinity])(
    'rejects insertion index %s without changing state',
    index => {
      const route = createRoute();
      const before = route.points;
      const changed = vi.fn();
      route.addEventListener('change', changed);
      expect(() => route.insertPoint(index, pointDefinition(0))).toThrow(
        expect.objectContaining({ code: 'INVALID_ROUTE_POINT_INDEX' }),
      );
      expect(route.points).toBe(before);
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it.each([
    [-1, 2],
    [2, 1],
    [0, 5],
    [0.5, 2],
    [0, 2.5],
    [NaN, 2],
    [0, Infinity],
  ])('rejects replacement range [%s, %s) without changing state', (start, end) => {
    const route = createRoute();
    const before = route.points;
    const changed = vi.fn();
    route.addEventListener('change', changed);
    expect(() => route.replacePoints(start, end, [pointDefinition(0)])).toThrow(
      expect.objectContaining({ code: 'INVALID_ROUTE_POINT_RANGE' }),
    );
    expect(route.points).toBe(before);
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([
    pointDefinition(NaN),
    pointDefinition(0, Infinity),
    pointDefinition(0, 0, ' '),
    { kind: 'line', position: { x: 0, y: 0 } } as unknown as MapPointDefinition,
  ])('rejects an invalid append or insertion without notifying: %j', definition => {
    const route = createRoute();
    const before = route.points;
    const changed = vi.fn();
    route.addEventListener('change', changed);
    expect(() => route.addPoint(definition)).toThrow();
    expect(() => route.insertPoint(1, definition)).toThrow();
    expect(route.points).toBe(before);
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([
    { definitions: [pointDefinition(50), pointDefinition(NaN)] },
    { definitions: [pointDefinition(50), pointDefinition(60, 0, '')] },
    { definitions: [pointDefinition(50), undefined] as unknown as readonly MapPointDefinition[] },
    { definitions: Array<MapPointDefinition>(2) },
    { definitions: null as unknown as readonly MapPointDefinition[] },
  ])(
    'validates the entire replacement input before changing membership or subscriptions: %j',
    ({ definitions }) => {
      const route = createRoute();
      const before = route.points;
      const changed = vi.fn();
      route.addEventListener('change', changed);
      expect(() => route.replacePoints(1, 3, definitions)).toThrow();
      expect(route.points).toBe(before);
      expect(before.map(point => point.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(changed).not.toHaveBeenCalled();

      before[1]!.position = new Point2(101, 10);
      before[2]!.position = new Point2(201, 10);
      expect(changed).toHaveBeenCalledTimes(2);
    },
  );
});
