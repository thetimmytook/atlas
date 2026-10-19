import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import * as identity from '#objects/create-id.js';
import { MapModel } from '#objects/map-model.js';
import { MapPolygon } from '#objects/map-polygon.js';
import * as placement from '#spatial/polygon-label-position.js';

import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { PolygonGeometry } from '#spatial/geometry.js';

const RECTANGLE = [
  { x: 0, y: 0 },
  { x: 12, y: 0 },
  { x: 12, y: 6 },
  { x: 0, y: 6 },
];

function geometry(cells: readonly (readonly Point2[])[]): PolygonGeometry {
  return {
    kind: 'polygon',
    cells: cells.map(cell => cell.map(p => new Point3(p.x, p.y, 0))),
    baseZ: 0,
    height: 0,
  };
}

function model(contour = RECTANGLE, bounds?: IntersectionBounds): MapModel {
  return new MapModel(
    resolveMapDefinition({
      layers: [
        { id: 'content', ...(bounds ? { intersectionBounds: bounds } : { objects: ['polygon'] }) },
      ],
      materials: { style: { properties: { label: { color: '#123456' } } } },
      objects: [{ kind: 'polygon', id: 'polygon', contour, label: 'Zone', material: 'style' }],
    }),
  );
}

function positions(scene: MapModel): Point2[] {
  return scene.geometry.objects.reduce<Point2[]>((result, entry) => {
    const position = scene.geometry.labelPositionFor(entry);

    if (position && entry.object.kind === 'polygon') result.push(position);

    return result;
  }, []);
}

function expectPosition(actual: Point2 | undefined, x: number, y: number): void {
  expect(actual).toBeDefined();
  expect(actual!.x).toBeCloseTo(x, 10);
  expect(actual!.y).toBeCloseTo(y, 10);
}

afterEach(() => vi.restoreAllMocks());

describe('displayed polygon area label position', () => {
  it('uses the rectangle area centroid, including an internal cell boundary', () => {
    expectPosition(positions(model())[0], 6, 3);
  });

  it('uses an asymmetric trapezoid centroid rather than the vertex mean or bounds center', () => {
    // Bottom 12, top 6, height 6: area 54 and centroid (14/3, 8/3).
    const scene = model([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ]);
    expectPosition(positions(scene)[0], 14 / 3, 8 / 3);
  });

  it('weights existing cells by area, not cell count, vertex count or bounding box', () => {
    const cells = geometry([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 2 },
        { x: 2, y: 2 },
      ],
    ]);
    expectPosition(placement.polygonLabelPosition(cells), 4, 1);
  });

  it('falls back to the centroid of the first largest cell when the union centroid is outside', () => {
    // U: bottom area 12, arms area 4 each; centroid (3, 2.2) is in the gap.
    const cells = geometry([
      [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 0, y: 2 },
      ],
      [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 6 },
        { x: 0, y: 6 },
      ],
      [
        { x: 5, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
      ],
    ]);
    expectPosition(placement.polygonLabelPosition(cells), 3, 1);
    const equal = geometry([cells.cells[1]!, cells.cells[2]!]);
    expectPosition(placement.polygonLabelPosition(equal), 0.5, 4);
  });

  it('includes disconnected regions produced by clipping in the area-weighted centroid', () => {
    const scene = model(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 8, y: 8 },
        { x: 8, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 8 },
        { x: 0, y: 8 },
      ],
      { min: { y: 4 }, max: { y: 8 } },
    );

    // Visible rectangles: [0,6]×[4,8] and [8,10]×[4,8], areas 24 and 8.
    expectPosition(positions(scene)[0], 4.5, 6);
  });

  it('uses the largest existing triangle when a concave source centroid falls in its opening', () => {
    const scene = model([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 6 },
      { x: 0, y: 6 },
    ]);

    // Union centroid (3, 2.2) is outside; largest existing cell is [(0,0),(6,0),(5,2)].
    expectPosition(positions(scene)[0], 11 / 3, 2 / 3);
  });

  it('gives direct membership full-geometry priority over XY and Z bounds', () => {
    const scene = model(RECTANGLE, { min: { x: 8, z: 0 }, max: { z: 3 } });
    expectPosition(positions(scene)[0], 10, 3);
    scene.layers[0]!.objectIds.add('polygon');
    expectPosition(positions(scene)[0], 6, 3);
    const polygon = scene.objects.get('polygon') as MapPolygon;
    polygon.baseZ = 20;
    expectPosition(positions(scene)[0], 6, 3);
    scene.layers[0]!.objectIds.remove('polygon');
    expect(positions(scene)).toEqual([]);
    polygon.baseZ = -2;
    polygon.height = 4;
    expectPosition(positions(scene)[0], 10, 3);
  });

  it('has no attachment without positive area, including boundary-only clipping', () => {
    expect(placement.polygonLabelPosition(geometry([]))).toBeUndefined();
    expect(
      placement.polygonLabelPosition(
        geometry([
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
        ]),
      ),
    ).toBeUndefined();
    expect(positions(model(RECTANGLE, { min: { x: 12 } }))).toEqual([]);
    expect(positions(model(RECTANGLE, { min: { z: 1 } }))).toEqual([]);
  });

  it.each([false, true])(
    'preserves the centroid after translation and reversed winding: %s',
    reverse => {
      const contour = [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
      ];
      const translated = contour.map(p => ({ x: p.x + 2 ** 40, y: p.y - 2 ** 38 }));

      if (reverse) {
        translated.reverse();
      }

      expectPosition(positions(model(translated))[0], 2 ** 40 + 14 / 3, -(2 ** 38) + 8 / 3);
    },
  );

  it.each([2 ** 600, 2 ** -600, 16 * Number.MIN_VALUE])(
    'supports accepted huge and tiny polygon scales: %s',
    scale => {
      const scene = model(RECTANGLE.map(p => ({ x: p.x * scale, y: p.y * scale })));
      const position = positions(scene)[0]!;
      expect(position.x / scale).toBeCloseTo(6, 10);
      expect(position.y / scale).toBeCloseTo(3, 10);
    },
  );

  it('keeps tiny displacement beside a huge constant coordinate and extreme aspect ratios', () => {
    const contour = [
      { x: 1e308, y: 0 },
      { x: 1.1e308, y: 0 },
      { x: 1.1e308, y: 6e-200 },
      { x: 1e308, y: 6e-200 },
    ];
    const position = positions(model(contour))[0]!;
    expect(position.x / 1e308).toBeCloseTo(1.05, 10);
    expect(position.y / 1e-200).toBeCloseTo(3, 10);
  });

  it('keeps a finite centroid when coordinate differences and areas overflow', () => {
    const size = Number.MAX_VALUE;
    const scene = model([
      { x: -size, y: -size },
      { x: size, y: -size },
      { x: size, y: size },
      { x: -size, y: size },
    ]);
    const position = positions(scene)[0]!;
    expect(position.x / size).toBeCloseTo(0, 10);
    expect(position.y / size).toBeCloseTo(0, 10);
  });

  it('retains source geometry, runtime identity and snapshots without new points or IDs', () => {
    const input = structuredClone(RECTANGLE);
    const scene = model(input, { min: { x: 8 } });
    const polygon = scene.objects.get('polygon') as MapPolygon;
    const contour = polygon.contour;
    const snapshot = scene.definition;
    const createId = vi.spyOn(identity, 'createId');
    positions(scene);
    positions(scene);
    expect(createId).not.toHaveBeenCalled();
    expect(polygon.contour).toBe(contour);
    expect(polygon.contour).toEqual(RECTANGLE);
    expect(input).toEqual(RECTANGLE);
    expect(scene.objects.size).toBe(1);
    expect(scene.definition).toBe(snapshot);
  });

  it('invalidates only affected polygons, retaining attachments on text/color/unrelated membership edits', () => {
    const scene = model();
    const polygon = scene.objects.get('polygon') as MapPolygon;
    scene.objects.add({ kind: 'polygon', id: 'other', contour: RECTANGLE });
    scene.layers[0]!.objectIds.add('other');
    positions(scene);
    scene.geometry.takeChanges();
    const calculate = vi.spyOn(placement, 'polygonLabelPosition');
    polygon.setVertex(1, { x: 6, y: 0 });
    expectPosition(positions(scene)[0], 14 / 3, 10 / 3);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(
      [...scene.geometry.takeChanges().geometry].every(entry => entry.object === polygon),
    ).toBe(true);
    polygon.label = 'Edited';
    scene.materials.get('style')!.properties = { label: { color: '#654321' } };
    scene.objects.add({ kind: 'point', id: 'point', position: { x: 0, y: 0 } });
    scene.layers[0]!.objectIds.add('point');
    positions(scene);
    expect(calculate).toHaveBeenCalledTimes(1);
    polygon.setContour(RECTANGLE);
    expectPosition(positions(scene)[0], 6, 3);
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it('refreshes cached appearances after removal, detached edits and reattachment', () => {
    const scene = model(RECTANGLE, { min: { x: 8 } });
    const polygon = scene.objects.get('polygon') as MapPolygon;
    expectPosition(positions(scene)[0], 10, 3);
    scene.objects.remove(polygon);
    expect(positions(scene)).toEqual([]);
    polygon.setContour(RECTANGLE.map(p => ({ x: p.x + 20, y: p.y })));
    scene.objects.add(polygon);
    expectPosition(positions(scene)[0], 26, 3);
    scene.objects.remove(polygon);
    expect(positions(scene)).toEqual([]);
    polygon.setContour(RECTANGLE.map(p => ({ x: p.x - 20, y: p.y })));
    scene.objects.add(polygon);
    expect(positions(scene)).toEqual([]);
  });
});
