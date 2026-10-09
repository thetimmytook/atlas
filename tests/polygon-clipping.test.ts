import { describe, expect, it } from 'vitest';

import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { containsConvexPolygon, triangulatePolygon } from '#math/polygon.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';
import { clipPolygonCells, clipPolygonVerticalRange } from '#spatial/polygon-clipping.js';

import type { MapPolygonDefinition } from '#definitions/map-polygon-definition.js';
import type { PolygonGeometry } from '#spatial/geometry.js';

const U_CONTOUR = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 60, y: 80 },
  { x: 60, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 80 },
  { x: 20, y: 80 },
];
const RECTANGLE = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];

function camera(): Camera {
  const result = new Camera();
  result.resize(new Size(200, 200));
  result.center = new Point2(100, 100);

  return result;
}

function geometry(model: MapModel, index = 0): PolygonGeometry {
  const result = model.geometry.objects.at(index)!.geometry;

  if (result.kind !== 'polygon') {
    throw new Error('Expected polygon geometry.');
  }

  return result;
}

function polygon(contour = RECTANGLE): MapPolygonDefinition {
  return { id: 'polygon', kind: 'polygon', contour };
}

describe('polygon cells and shared appearances', () => {
  it.each([false, true])(
    'picks the collinear point on an allowed triangle edge: reversed=%s',
    reversed => {
      const contour = [new Point2(0, 0), new Point2(7, 77), new Point2(-11, 1)];

      if (reversed) {
        contour.reverse();
      }

      const model = new MapModel(
        resolveMapDefinition({
          objects: [polygon(contour)],
          layers: [{ id: 'floor', intersectionBounds: { min: { x: -11 }, max: { x: 7 } } }],
        }),
      );
      const root = model.objects.get('polygon');
      const point = new Point2(1, 11);
      expect(model.spatial.hitTest(point, camera())?.object).toBe(root);
      expect(model.spatial.hitTest(point, camera())?.layer).toBe(model.layers[0]);
      expect(model.spatial.hitTest(new Point2(1, 11 + 1e-12), camera())?.object).toBe(root);
      expect(model.spatial.hitTest(new Point2(1, 11 - 1e-12), camera())).toBeUndefined();
      model.layers[0]!.objectIds.add('polygon');
      expect(model.spatial.hitTest(point, camera())?.object).toBe(root);
    },
  );

  it.each([false, true])(
    'keeps disjoint clipped U regions without a bridge in either winding: reversed=%s',
    reversed => {
      const contour = reversed ? [...U_CONTOUR].reverse() : U_CONTOUR;
      const model = new MapModel(
        resolveMapDefinition({
          objects: [polygon(contour)],
          layers: [{ id: 'floor', intersectionBounds: { min: { y: 50 }, max: { y: 70 } } }],
        }),
      );
      const root = model.objects.get('polygon')!;
      expect(model.geometry.objects).toHaveLength(1);
      expect(model.layers[0]!.objects).toEqual([]);
      expect(model.spatial.hitTest(new Point2(30, 60), camera())?.object).toBe(root);
      expect(model.spatial.hitTest(new Point2(70, 60), camera())?.object).toBe(root);
      expect(model.spatial.hitTest(new Point2(50, 60), camera())).toBeUndefined();
      expect(
        geometry(model).cells.every(cell => cell.every(point => point.z === 0 && !('id' in point))),
      ).toBe(true);
      expect(root.kind === 'polygon' && root.contour).toEqual(contour);
    },
  );

  it('includes fill and allowed boundaries but excludes max and never enlarges the hit area', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [polygon()],
        layers: [
          { id: 'floor', intersectionBounds: { min: { x: 30, y: 30 }, max: { x: 70, y: 70 } } },
        ],
      }),
    );

    for (const point of [new Point2(30, 30), new Point2(30, 50), new Point2(69.999, 50)]) {
      expect(model.spatial.hitTest(point, camera())?.object.id).toBe('polygon');
    }

    for (const point of [new Point2(29.999, 50), new Point2(70, 50), new Point2(50, 70)]) {
      expect(model.spatial.hitTest(point, camera())).toBeUndefined();
    }

    model.layers[0]!.objectIds.add('polygon');
    expect(model.geometry.objects).toHaveLength(1);
    expect(model.spatial.hitTest(new Point2(80, 50), camera())?.object.id).toBe('polygon');
    expect(model.spatial.hitTest(new Point2(80.001, 50), camera())).toBeUndefined();
  });

  it('drops degenerate cells beside valid cells and drops an entirely degenerate result', () => {
    const first = [new Point2(20, 20), new Point2(40, 20), new Point2(40, 40)];
    const second = [new Point2(40, 20), new Point2(60, 20), new Point2(60, 40)];
    expect(clipPolygonCells([first, second], { min: { x: 40 } })).toEqual([second]);
    expect(clipPolygonCells([first], { min: { x: 40 } })).toEqual([]);
    const model = new MapModel(
      resolveMapDefinition({
        objects: [polygon()],
        layers: [{ intersectionBounds: { min: { x: 80 } } }],
      }),
    );
    expect(model.geometry.objects).toEqual([]);
    expect(model.spatial.hitTest(new Point2(80, 50), camera())).toBeUndefined();
  });

  it('updates before notification and preserves unaffected views while contours and base heights change', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [polygon(), { ...polygon(), id: 'other' }],
        layers: [{ id: 'floor', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } }],
      }),
    );
    const root = model.objects.get('polygon')!;

    if (root.kind !== 'polygon') {
      throw new Error('Expected polygon.');
    }

    const entry = model.geometry.objects[0]!;
    const other = model.geometry.objects[1]!;
    const otherCells = geometry(model, 1).cells;
    model.geometry.takeChanges();
    let changeCalled = false;
    root.addEventListener(
      'change',
      () => {
        changeCalled = true;
        expect(model.spatial.hasHit(entry, new Point2(25, 25), camera())).toBe(false);
      },
      { once: true },
    );
    root.setContour([
      { x: 40, y: 40 },
      { x: 80, y: 40 },
      { x: 80, y: 80 },
      { x: 40, y: 80 },
    ]);
    expect(changeCalled).toBe(true);
    expect(model.geometry.objects[0]).toBe(entry);
    expect(model.geometry.objects[1]).toBe(other);
    expect(geometry(model, 1).cells).toBe(otherCells);
    expect(model.geometry.takeChanges()).toEqual(new Set([entry]));
    root.baseZ = 3;
    expect(model.geometry.objects).toEqual([other]);
    model.layers[0]!.visible = false;
    root.baseZ = 1;
    expect(model.spatial.hitTest(new Point2(50, 50), camera())).toBeUndefined();
    model.layers[0]!.visible = true;
    expect(model.geometry.objects[0]).toBe(entry);
    expect(geometry(model).cells[0]![0]).toBeInstanceOf(Point3);
    expect(geometry(model).cells[0]![0]!.z).toBe(1);
    model.objects.remove(root);
    expect(model.geometry.objects).toEqual([other]);
    root.baseZ = 2;
    model.objects.add(root);
    expect(model.geometry.objects.at(-1)!.object).toBe(root);
    expect(geometry(model, 1).cells[0]![0]!.z).toBe(2);
  });

  it('caches triangulation and agrees with an independent ray-crossing oracle over concave interiors', () => {
    const triangles = triangulatePolygon(U_CONTOUR);
    expect(triangulatePolygon(U_CONTOUR)).toBe(triangles);

    for (let x = 15.5; x < 90; x += 3) {
      for (let y = 15.5; y < 90; y += 3) {
        const point = new Point2(x, y);
        const crossings = U_CONTOUR.reduce((count, a, index) => {
          const b = U_CONTOUR.at((index + 1) % U_CONTOUR.length)!;

          return (
            count + Number(a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
          );
        }, 0);
        expect(triangles.some(triangle => containsConvexPolygon(triangle, point))).toBe(
          crossings % 2 === 1,
        );
      }
    }
  });
  it('intersects volumes by positive z overlap and assigns planes to exactly one adjacent floor', () => {
    const floors = [
      { id: 'lower', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
      { id: 'upper', intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
      { id: 'above', intersectionBounds: { min: { z: 6 } } },
    ];
    const model = new MapModel(
      resolveMapDefinition({ objects: [{ ...polygon(), baseZ: 1, height: 4 }], layers: floors }),
    );
    const root = model.objects.get('polygon')!;

    if (root.kind !== 'polygon') throw new Error('Expected polygon.');

    const [lower, upper] = model.geometry.objects;
    expect(model.geometry.objects).toHaveLength(2);
    expect(geometry(model)).toMatchObject({ baseZ: 1, height: 2 });
    expect(geometry(model, 1)).toMatchObject({ baseZ: 3, height: 2 });
    expect(geometry(model, 1).cells.every(cell => cell.every(point => point.z === 3))).toBe(true);
    expect(model.geometry.objects.every(entry => entry.object === root)).toBe(true);
    expect(model.layers.every(layer => layer.objects.length === 0)).toBe(true);
    const lowerCells = geometry(model).cells;
    const upperCells = geometry(model, 1).cells;
    const triangles = triangulatePolygon(root.contour);
    root.height = 5;
    expect(model.geometry.objects).toEqual([lower, upper]);
    expect(geometry(model).cells).toBe(lowerCells);
    expect(geometry(model, 1).cells).toBe(upperCells);
    expect(geometry(model, 1).height).toBe(3);
    expect(triangulatePolygon(root.contour)).toBe(triangles);
    root.baseZ = 3;
    root.height = 0;
    expect(model.geometry.objects).toEqual([upper]);
    expect(geometry(model)).toMatchObject({ baseZ: 3, height: 0 });
    model.layers[0]!.objectIds.add(root.id);
    expect(model.geometry.objects).toHaveLength(2);
    expect(geometry(model)).toMatchObject({ baseZ: 3, height: 0 });
    expect(model.layers[0]!.objects).toEqual([root]);
    expect(clipPolygonVerticalRange(-2, 2, floors[0]!.intersectionBounds)).toBeUndefined();
    expect(clipPolygonVerticalRange(1, 4, { max: { z: 3 } })).toEqual({ baseZ: 1, height: 2 });
    expect(clipPolygonVerticalRange(1, 4, { min: { z: 3 } })).toEqual({ baseZ: 3, height: 2 });
    expect(clipPolygonVerticalRange(-2, 0, {})).toEqual({ baseZ: -2, height: 0 });
  });

  it('invalidates z membership before change listeners and keeps unrelated entries intact', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [
          { ...polygon(), baseZ: 3, height: 0 },
          { ...polygon(), id: 'other' },
        ],
        layers: [{ id: 'floor', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } }],
      }),
    );
    const root = model.objects.get('polygon')!;

    if (root.kind !== 'polygon') throw new Error('Expected polygon.');

    const other = model.geometry.objects[0]!;
    root.baseZ = -1;
    root.addEventListener(
      'change',
      () => expect(model.spatial.hitTest(new Point2(50, 50), camera())?.object).toBe(root),
      { once: true },
    );
    model.objects.remove(other.object);
    root.height = 2;
    const appearance = model.geometry.objects[0]!;
    expect(model.spatial.hasHit(appearance, new Point2(50, 50), camera())).toBe(true);
    root.height = 1;
    expect(model.spatial.hasHit(appearance, new Point2(50, 50), camera())).toBe(false);
    expect(model.geometry.objects).toEqual([]);
    model.objects.add(other.object);
    expect(model.geometry.objects[0]).toBe(other);
  });

  it('triangulates varied simple concave contours without losing or overlapping area', () => {
    let seed = 42;

    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

      return seed / 2 ** 32;
    };

    const area = (points: readonly Point2[]): number =>
      Math.abs(
        points.reduce((sum, a, index) => {
          const b = points.at((index + 1) % points.length)!;

          return sum + a.x * b.y - a.y * b.x;
        }, 0),
      ) / 2;

    for (let sample = 0; sample < 50; sample++) {
      const contour = Array.from({ length: 20 }, (_, index) => {
        const angle = (index * Math.PI) / 10;
        const radius = 10 + random() * 90;

        return new Point2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
      const triangles = triangulatePolygon(contour);
      expect(triangles.reduce((sum, triangle) => sum + area(triangle), 0)).toBeCloseTo(
        area(contour),
        8,
      );
      expect(triangles).toHaveLength(contour.length - 2);
    }
  });
  it.each([1e-200, 1, 1e200, 1e308])(
    'keeps positive cells and finite cuts at coordinate scale %s',
    scale => {
      const contour = [
        { x: -scale, y: -scale },
        { x: scale, y: -scale },
        { x: scale, y: scale },
        { x: -scale, y: scale },
      ];
      const model = new MapModel(
        resolveMapDefinition({
          objects: [polygon(contour)],
          layers: [
            {
              intersectionBounds: {
                min: { x: -scale / 2, y: -scale / 2 },
                max: { x: scale / 2, y: scale / 2 },
              },
            },
          ],
        }),
      );
      expect(model.geometry.objects).toHaveLength(1);
      const cells = geometry(model).cells;
      expect(
        cells.every(cell =>
          cell.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
        ),
      ).toBe(true);
      expect(model.spatial.hitTest(new Point2(0, 0), camera())?.object.id).toBe('polygon');
      expect(model.spatial.hitTest(new Point2(scale / 2, 0), camera())).toBeUndefined();
    },
  );
});
