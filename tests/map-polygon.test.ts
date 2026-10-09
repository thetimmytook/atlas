import { describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { triangulatePolygon } from '#math/polygon.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapPolygon } from '#objects/map-polygon.js';

import type { MapPolygonDefinition } from '#definitions/map-polygon-definition.js';

const CONTOUR = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 70 },
  { x: 20, y: 70 },
];

function polygon(contour = CONTOUR): MapPolygonDefinition {
  return { kind: 'polygon', contour };
}

describe('polygon input and runtime coordinates', () => {
  it('rejects the collinear contour that previously acquired area after rescaling', () => {
    const contour = [new Point2(0, 0), new Point2(1, 33), new Point2(6, 198)];
    expect(() => new MapPolygon(polygon(contour))).toThrow(
      expect.objectContaining({ code: 'INVALID_POLYGON_CONTOUR' }),
    );
    expect(() => resolveMapDefinition({ objects: [polygon(contour)], layers: [] })).toThrow(
      expect.objectContaining({ code: 'INVALID_POLYGON_CONTOUR' }),
    );
  });

  it('copies/freezes plain and Point2 inputs, defaults height/base and generates only a root ID', () => {
    const first = { ...CONTOUR[0]! };
    const input = [first, ...CONTOUR.slice(1), new Point2(10, 40)];
    const object = new MapPolygon(polygon(input));
    first.x = 999;
    input.pop();
    expect(object.id).toEqual(expect.any(String));
    expect(object.kind).toBe('polygon');
    expect(object.baseZ).toBe(0);
    expect(object.height).toBe(0);
    expect(object.contour[0]).toEqual(new Point2(20, 20));
    expect(object.contour).toHaveLength(5);
    expect(Object.isFrozen(object.contour)).toBe(true);
    expect(
      object.contour.every(point => Object.isFrozen(point) && !('id' in point) && !('z' in point)),
    ).toBe(true);
    const resolved = resolveMapDefinition({ objects: [polygon()], layers: [] });
    expect(resolved.objects[0]).toMatchObject({ kind: 'polygon', baseZ: 0, height: 0 });
  });

  it.each(
    [
      [],
      [CONTOUR[0]],
      [CONTOUR[0], CONTOUR[1]],
      [...CONTOUR, CONTOUR[0]],
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: 0 },
        { x: 0, y: 10 },
      ],
      [[{ x: 0, y: 0 }]],
      [undefined, ...CONTOUR],
      new Array(4),
      null,
    ].map(contour => ({ contour })),
  )('rejects malformed, repeated, degenerate, crossing or touching contours %j', ({ contour }) => {
    expect(() => new MapPolygon(polygon(contour as typeof CONTOUR))).toThrow();
  });

  it.each([
    { x: 20, y: 20, z: 0 },
    { x: 20, y: 20, z: undefined },
    new Point3(20, 20),
    Object.assign(Object.create({ z: undefined }) as Point2, { x: 20, y: 20 }),
    { x: NaN, y: 20 },
    { x: 20, y: Infinity },
  ])('rejects height properties and nonfinite coordinates on every input boundary %j', vertex => {
    const object = new MapPolygon(polygon());
    const before = object.contour;
    const change = vi.fn();
    object.addEventListener('change', change);
    expect(() => new MapPolygon(polygon([vertex, ...CONTOUR.slice(1)]))).toThrow();
    expect(() => object.setVertex(0, vertex)).toThrow();
    expect(() => object.setContour([vertex, ...CONTOUR.slice(1)])).toThrow();
    expect(object.contour).toBe(before);
    expect(change).not.toHaveBeenCalled();
  });

  it('preserves winding, collinear source vertices, snapshots and unchanged coordinates', () => {
    const contour = [{ x: 20, y: 20 }, { x: 50, y: 20 }, ...CONTOUR.slice(1)].reverse();
    const object = new MapPolygon(polygon(contour));
    const before = object.contour;
    const change = vi.fn();
    object.addEventListener('change', change);
    object.setVertex(0, new Point2(10, 70));
    expect(before).toEqual(contour);
    expect(object.contour).not.toBe(before);
    expect(object.contour[1]).toBe(before[1]);
    expect(object.contour).toHaveLength(5);
    const replacement = CONTOUR.map(point => ({ ...point }));
    object.setContour(replacement);
    replacement[0]!.x = 999;
    expect(object.contour).toEqual(CONTOUR);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid indices and entire candidate shapes without mutation or notification', () => {
    const object = new MapPolygon(polygon());
    const contour = object.contour;
    const triangles = triangulatePolygon(contour);
    const change = vi.fn();
    object.addEventListener('change', change);

    for (const index of [-1, 4, 0.5, NaN, Infinity]) {
      expect(() => object.setVertex(index, new Point2(30, 30))).toThrow();
    }

    expect(() => object.setVertex(0, object.contour[1]!)).toThrow();
    expect(() => object.setContour([new Point2(0, 0)])).toThrow();
    expect(object.contour).toBe(contour);
    expect(triangulatePolygon(object.contour)).toBe(triangles);
    expect(change).not.toHaveBeenCalled();
  });

  it('supports copied additions, duplicate IDs and exact instance attachment/removal', () => {
    const objects = new MapObjectCollection();
    const first = objects.add({ ...polygon(), id: 'shared' });
    const second = objects.add({ ...polygon(), id: 'shared', baseZ: -2 });
    expect(first).toBeInstanceOf(MapPolygon);
    expect(objects.get('shared')).toBe(first);
    expect(objects.add(first)).toBe(first);
    expect(objects.size).toBe(2);
    expect(objects.remove(first)).toBe(true);
    first.setVertex(0, new Point2(10, 10));
    expect(objects.add(first)).toBe(first);
    expect([...objects]).toEqual([second, first]);
    const size = objects.size;
    expect(() => objects.add(polygon([]))).toThrow();
    expect(objects.size).toBe(size);
  });
  it('validates vertical state atomically and keeps triangulation when only height changes', () => {
    const object = new MapPolygon({ ...polygon(), baseZ: -2, height: 7 });
    const contour = object.contour;
    const triangles = triangulatePolygon(contour);
    const change = vi.fn();
    object.addEventListener('change', change);
    object.height = 9;
    object.baseZ = -3;
    expect(object.height).toBe(9);
    expect(object.baseZ).toBe(-3);
    expect(triangulatePolygon(object.contour)).toBe(triangles);
    expect(change).toHaveBeenCalledTimes(2);

    for (const height of [-1, NaN, Infinity, -Infinity]) {
      expect(() => {
        object.height = height;
      }).toThrow();
      expect(() => new MapPolygon({ ...polygon(), height })).toThrow();
    }

    for (const baseZ of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
      expect(() => {
        object.baseZ = baseZ;
      }).toThrow();
    }

    expect(
      () => new MapPolygon({ ...polygon(), baseZ: Number.MAX_VALUE, height: Number.MAX_VALUE }),
    ).toThrow();
    expect(() => new MapPolygon({ ...polygon(), baseZ: 1e20, height: 1 })).toThrow();
    expect(object.baseZ).toBe(-3);
    expect(object.height).toBe(9);
    expect(object.contour).toBe(contour);
    expect(change).toHaveBeenCalledTimes(2);
    object.height = 0;
    expect(object.height).toBe(0);
  });
});
