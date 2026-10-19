import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import * as identity from '#objects/create-id.js';
import { MapModel } from '#objects/map-model.js';
import * as placement from '#spatial/path-label-position.js';

import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { IntersectionBounds } from '#math/intersection-bounds.js';

const EXPECTED_ROUTE = 'Expected route.';

function point(x: number, y = 100, z = 0): MapPointDefinition {
  return { kind: 'point', position: { x, y, z } };
}

function model(object: MapEntryDefinition, bounds?: IntersectionBounds): MapModel {
  return new MapModel(
    resolveMapDefinition({
      layers: [
        { id: 'content', ...(bounds ? { intersectionBounds: bounds } : { objects: ['path'] }) },
      ],
      objects: [{ ...object, id: 'path' }],
    }),
  );
}

function positions(scene: MapModel): readonly Point2[] {
  return scene.geometry.objects.reduce<Point2[]>((result, entry) => {
    if (entry.object.kind !== 'line' && entry.object.kind !== 'route') {
      return result;
    }

    const position = scene.geometry.labelPositionFor(entry);

    if (position) {
      result.push(position);
    }

    return result;
  }, []);
}

afterEach(() => vi.restoreAllMocks());

describe('displayed path label positions', () => {
  it('uses the midpoint of a full line, independent of z', () => {
    const scene = model({ kind: 'line', points: [point(20, 30, -100), point(180, 90, 900)] });
    expect(positions(scene)).toEqual([new Point2(100, 60)]);
  });

  it.each([
    [{ kind: 'line', points: [point(-1e308), point(1e308)] }, new Point2(0, 100)],
    [{ kind: 'route', points: [point(-1e308), point(0), point(1e308)] }, new Point2(0, 100)],
    [{ kind: 'line', points: [point(-1e308, -1e308), point(1e308, 1e308)] }, new Point2(0, 0)],
    [{ kind: 'line', points: [point(-8e307, -8e307), point(8e307, 8e307)] }, new Point2(0, 0)],
    [
      { kind: 'route', points: [point(-1e308, 0), point(1e308, 0), point(1e308, 1e308)] },
      new Point2(5e307, 0),
    ],
    [
      {
        kind: 'route',
        points: [point(0, 0), point(1e308, 0), point(1e308, 1e308), point(0, 1e308)],
      },
      new Point2(1e308, 5e307),
    ],
  ] satisfies readonly (readonly [MapEntryDefinition, Point2])[])(
    'keeps a finite anchor when segment or total lengths overflow: %j',
    (definition, expected) => {
      expect(positions(model(definition))).toEqual([expected]);
    },
  );

  it('preserves the first exact fragment endpoint when normalized lengths reach half', () => {
    expect(
      placement.pathLabelPosition([
        { kind: 'line', start: new Point3(1e308, 100, 0), end: new Point3(1, 100, 0) },
        { kind: 'line', start: new Point3(-1, 200, 0), end: new Point3(-1e308, 200, 0) },
      ]),
    ).toEqual(new Point2(1, 100));
  });

  it('retains a tiny finite displacement beside a large constant coordinate', () => {
    const scene = model({ kind: 'line', points: [point(1e308, 0), point(1e308, 1e-200)] });
    expect(positions(scene)).toEqual([new Point2(1e308, 5e-201)]);
  });

  it('clears a cached label attachment when an empty direct route is reattached', () => {
    const scene = model({ kind: 'route', points: [point(20), point(100)] });
    const route = scene.objects.get('path')!;

    if (route.kind !== 'route') {
      throw new Error(EXPECTED_ROUTE);
    }

    expect(positions(scene)).toEqual([new Point2(60, 100)]);
    scene.objects.remove(route);
    expect(scene.geometry.objects).toEqual([]);
    route.replacePoints(0, route.points.length, []);
    scene.objects.add(route);
    expect(positions(scene)).toEqual([]);
  });

  it('keeps one attachment when a cached single fragment is reattached as two fragments', () => {
    const scene = model(
      { kind: 'route', points: [point(20, 100, 1), point(100, 100, 1)] },
      { min: { z: 0 }, max: { z: 3 } },
    );
    const route = scene.objects.get('path')!;

    if (route.kind !== 'route') {
      throw new Error(EXPECTED_ROUTE);
    }

    expect(positions(scene)).toEqual([new Point2(60, 100)]);
    scene.objects.remove(route);
    expect(scene.geometry.objects).toEqual([]);
    route.replacePoints(0, route.points.length, [
      point(20, 100, 1),
      point(120, 100, 5),
      point(260, 100, 1),
    ]);
    scene.objects.add(route);
    expect(positions(scene)).toEqual([new Point2(200, 100)]);
  });

  it('uses the midpoint of the clipped segment and gives direct membership priority', () => {
    const scene = model(
      { kind: 'line', points: [point(0), point(200)] },
      { min: { x: 20 }, max: { x: 100 } },
    );
    expect(positions(scene)).toEqual([new Point2(60, 100)]);
    scene.layers[0]!.objectIds.add('path');
    expect(positions(scene)).toEqual([new Point2(100, 100)]);
    scene.layers[0]!.objectIds.remove('path');
    expect(positions(scene)).toEqual([new Point2(60, 100)]);
  });

  it('weights unequal segments by projected length rather than vertices, bounds or XYZ', () => {
    const scene = model({
      kind: 'route',
      points: [point(20, 20), point(40, 20, 1000), point(40, 100, 1000)],
    });
    expect(positions(scene)).toEqual([new Point2(40, 50)]);
  });

  it('sums separate visible fragments without including the hidden gap', () => {
    const scene = model(
      {
        kind: 'route',
        points: [point(20, 100, 1), point(120, 100, 5), point(260, 100, 1)],
      },
      { min: { z: 0 }, max: { z: 3 } },
    );

    // Visible lengths are 50 and 70. Half of 120 is 10 into the second fragment.
    expect(positions(scene)).toEqual([new Point2(200, 100)]);
    const entries = scene.geometry.objects.filter(entry => entry.object.kind === 'route');
    expect(entries).toHaveLength(2);
    expect(scene.geometry.labelPositionFor(entries[0]!)).toBeUndefined();
    expect(scene.geometry.labelPositionFor(entries[1]!)).toEqual(new Point2(200, 100));
  });

  it.each([
    [[point(20, 100, 1), point(120, 100, 5), point(220, 100, 1)], 70],
    [[point(220, 100, 1), point(120, 100, 5), point(20, 100, 1)], 170],
  ] as const)('chooses the first fragment end at an exact halfway boundary: %j', (points, x) => {
    const scene = model({ kind: 'route', points }, { min: { z: 0 }, max: { z: 3 } });
    expect(positions(scene)).toEqual([new Point2(x, 100)]);
  });

  it('ignores vertical transitions when there is positive XY length', () => {
    const scene = model({
      kind: 'route',
      points: [point(20, 30, -500), point(20, 30, 500), point(100, 30, 500)],
    });
    expect(positions(scene)).toEqual([new Point2(60, 30)]);
  });

  it.each(['line', 'route'] as const)(
    'uses the first displayed position for zero XY length: %s',
    kind => {
      const points = [point(20, 30, -5), point(20, 30, 5)] as const;
      const scene = model({ kind, points }, { min: { z: 0 }, max: { z: 3 } });
      expect(positions(scene)).toEqual([new Point2(20, 30)]);
    },
  );

  it('supports empty and single-point routes, including clipping exclusion', () => {
    expect(positions(model({ kind: 'route', points: [] }))).toEqual([]);
    expect(positions(model({ kind: 'route', points: [point(35, 75)] }))).toEqual([
      new Point2(35, 75),
    ]);
    expect(positions(model({ kind: 'route', points: [point(35, 75)] }, { min: { z: 1 } }))).toEqual(
      [],
    );
    expect(
      positions(model({ kind: 'line', points: [point(0), point(10)] }, { min: { x: 20 } })),
    ).toEqual([]);
    expect(placement.pathLabelPosition([])).toBeUndefined();
  });

  it('keeps source arrays, positions, IDs and immutable snapshots, without creating runtime points', () => {
    const input = {
      kind: 'route' as const,
      points: [point(20, 100, 1), point(120, 100, 5), point(220, 100, 1)],
    };
    const original = structuredClone(input);
    const scene = model(input, { min: { z: 0 }, max: { z: 3 } });
    const route = scene.objects.get('path')!;

    if (route.kind !== 'route') {
      throw new Error(EXPECTED_ROUTE);
    }

    const points = route.points;
    const values = points.map(point => point.position);
    const ids = points.map(point => point.id);
    const snapshot = scene.definition;
    const createId = vi.spyOn(identity, 'createId');

    for (let index = 0; index < 3; index++) {
      expect(positions(scene)).toEqual([new Point2(70, 100)]);
    }

    expect(createId).not.toHaveBeenCalled();
    expect(route.points).toBe(points);
    expect(points.map(point => point.position)).toEqual(values);
    expect(points.map(point => point.id)).toEqual(ids);
    expect(scene.objects.size).toBe(1);
    expect(scene.definition).toBe(snapshot);
    expect(input).toEqual(original);
  });

  it('recomputes only the affected path before paint and preserves pending display changes', () => {
    const scene = model({ kind: 'route', points: [point(20), point(100)] });
    const route = scene.objects.get('path')!;

    if (route.kind !== 'route') {
      throw new Error(EXPECTED_ROUTE);
    }

    scene.objects.add({ kind: 'route', id: 'other', points: [point(10), point(30)] });
    scene.layers[0]!.objectIds.add('other');
    positions(scene);
    scene.geometry.takeChanges();
    const calculate = vi.spyOn(placement, 'pathLabelPosition');
    route.points[1]!.position = new Point3(180, 100, 0);
    expect(positions(scene)).toEqual([new Point2(100, 100), new Point2(20, 100)]);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(
      [...scene.geometry.takeChanges().geometry].every(
        entry =>
          entry.object === route ||
          (entry.object.kind === 'point' && route.points.includes(entry.object)),
      ),
    ).toBe(true);
    route.label = 'New text';
    positions(scene);
    expect(calculate).toHaveBeenCalledTimes(1);
  });
  it('reuses unrelated path attachments during membership reconciliation, including simultaneous position edits', () => {
    const scene = model({ kind: 'route', points: [point(20), point(100)] });
    const route = scene.objects.get('path')!;

    if (route.kind !== 'route') {
      throw new Error(EXPECTED_ROUTE);
    }

    scene.objects.add({ kind: 'route', id: 'other', points: [point(10), point(30)] });
    scene.layers[0]!.objectIds.add('other');
    positions(scene);
    const calculate = vi.spyOn(placement, 'pathLabelPosition');
    scene.layers[0]!.objectIds.remove('other');
    expect(positions(scene)).toEqual([new Point2(60, 100)]);
    expect(calculate).toHaveBeenCalledTimes(1);
    calculate.mockClear();
    route.points[1]!.position = new Point3(180, 100, 0);
    scene.layers[0]!.objectIds.add('other');
    expect(positions(scene)).toEqual([new Point2(100, 100), new Point2(20, 100)]);
    expect(calculate).toHaveBeenCalledTimes(2);
    calculate.mockClear();
    scene.objects.add({ kind: 'point', id: 'new', position: { x: 0, y: 0 } });
    scene.layers[0]!.objectIds.add('new');
    positions(scene);
    expect(calculate).not.toHaveBeenCalled();
  });
});
