import { describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { AtlasError } from '#errors/atlas-error.js';
import { Point } from '#math/point.js';
import { MapLine } from '#objects/map-line.js';
import { MapPoint } from '#objects/map-point.js';
import { MapRoute } from '#objects/map-route.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

function point(z?: number): MapPointDefinition {
  return { kind: 'point', position: new Point(10, 20, z) };
}

describe('object position z', () => {
  it('keeps ordinary Point two dimensional and normalizes copied runtime positions and snapshots', () => {
    expect(new Point(10, 20).z).toBeUndefined();
    const position = { x: 10, y: 20, z: -5 };
    const input = { kind: 'point' as const, position };
    const resolved = resolveMapDefinition({ layers: [], objects: [input, point()] });
    const runtime = new MapPoint(input);
    position.z = 999;
    expect(runtime.position.z).toBe(-5);
    expect(resolved.objects[0]).toMatchObject({ position: { z: -5 } });
    expect(resolved.objects[1]).toMatchObject({ position: { z: 0 } });
    expect(Object.isFrozen(runtime.position)).toBe(true);
    expect(Object.isFrozen((resolved.objects[0] as MapPointDefinition).position)).toBe(true);
    runtime.position = new Point(30, 40);
    expect(runtime.position).toEqual(new Point(30, 40, 0));
  });

  it('retains copied z through line ownership and every route point operation', () => {
    const route = new MapRoute('route', [point(-1)]);
    const line = new MapLine('line', [point(-2), point(4)]);
    expect(line.points.map(vertex => vertex.position.z)).toEqual([-2, 4]);
    const added = route.addPoint(point(5));
    const inserted = route.insertPoint(1, point(3));
    const [replacement] = route.replacePoints(1, 2, [point(-6)]);
    expect(route.points.map(vertex => vertex.position.z)).toEqual([-1, -6, 5]);
    expect(added.position.z).toBe(5);
    expect(inserted.position.z).toBe(3);
    const changed = vi.fn(() => replacement!.position.z);
    route.addEventListener('change', changed);
    const value = { x: 50, y: 60, z: 8 };
    replacement!.position = value;
    value.z = 90;
    expect(changed).toHaveReturnedWith(8);
    expect(replacement!.position.z).toBe(8);
  });

  it.each([NaN, Infinity, -Infinity, null, '3'].map(z => ({ z })))(
    'rejects invalid z atomically: %j',
    ({ z }: { z: unknown }) => {
      const invalid = {
        kind: 'point',
        position: { x: 1, y: 2, z },
      } as unknown as MapPointDefinition;
      expect(() => new MapPoint(invalid)).toThrow(
        expect.objectContaining({
          code: 'INVALID_NUMBER',
          details: { field: 'point.position.z', value: z, expected: 'finite number' },
        }),
      );
      expect(() => resolveMapDefinition({ layers: [], objects: [invalid] })).toThrow();
      const route = new MapRoute('route', [point(1)]);
      const previous = route.points;
      const changed = vi.fn();
      route.addEventListener('change', changed);
      expect(() => route.addPoint(invalid)).toThrow();
      expect(() => route.insertPoint(0, invalid)).toThrow();
      expect(() => route.replacePoints(0, 1, [invalid])).toThrow();
      expect(() => {
        route.points[0]!.position = invalid.position;
      }).toThrow();
      expect(route.points).toBe(previous);
      expect(route.points[0]!.position.z).toBe(1);
      expect(changed).not.toHaveBeenCalled();
    },
  );
});

describe('intersection bounds load contract', () => {
  it.each(
    [
      {},
      { min: {} },
      { max: {} },
      { min: { z: undefined } },
      null,
      [],
      { min: null },
      { max: [] },
      { min: { z: NaN } },
      { max: { y: Infinity } },
      { min: { x: 2 }, max: { x: 2 } },
      { min: { z: 3 }, max: { z: 0 } },
      { min: { z: '0' } },
    ].map(bounds => ({ bounds })),
  )(
    'rejects invalid bounds with a stable error and context: %j',
    ({ bounds }: { bounds: unknown }) => {
      const error = rejectedBounds(bounds);
      expect(error.code).toBe('INVALID_INTERSECTION_BOUNDS');
      expect(error.details?.field).toEqual(expect.stringContaining('layers[0].intersectionBounds'));
    },
  );

  it('copies/freeze bounds deeply and accepts one-sided limits and undefined', () => {
    const bounds = { min: { z: -3 }, max: { x: 100 } };
    const resolved = resolveMapDefinition({
      layers: [{ intersectionBounds: bounds }, { intersectionBounds: undefined }],
    });
    bounds.min.z = 99;
    expect(resolved.layers[0]!.intersectionBounds).toEqual({ min: { z: -3 }, max: { x: 100 } });
    expect(Object.isFrozen(resolved.layers[0]!.intersectionBounds)).toBe(true);
    expect(Object.isFrozen(resolved.layers[0]!.intersectionBounds!.min)).toBe(true);
    expect(Object.isFrozen(resolved.layers[0]!.intersectionBounds!.max)).toBe(true);
    expect(resolved.layers[1]!.intersectionBounds).toBeUndefined();
  });
});

function rejectedBounds(bounds: unknown): AtlasError {
  try {
    resolveMapDefinition({ layers: [{ intersectionBounds: bounds }] } as unknown as MapDefinition);
  } catch (error) {
    expect(error).toBeInstanceOf(AtlasError);

    return error as AtlasError;
  }

  throw new Error('Expected invalid bounds to fail.');
}
