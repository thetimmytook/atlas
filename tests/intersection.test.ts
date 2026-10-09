import { describe, expect, it } from 'vitest';

import { squaredDistanceToSegment } from '#math/distance.js';
import { Point3 } from '#math/point3.js';
import { clipPolyline, clipSegment, containsPosition } from '#spatial/intersection.js';

const FLOOR = { min: { z: 0 }, max: { z: 3 } };

describe('half-open spatial clipping', () => {
  it('uses zero for omitted z and includes min but excludes max on every limited axis', () => {
    expect(containsPosition(FLOOR, new Point3(5, 5))).toBe(true);
    expect(containsPosition(FLOOR, new Point3(5, 5, 3))).toBe(false);
    expect(containsPosition({ min: { z: -3 } }, new Point3(5, 5, -3))).toBe(true);
    expect(containsPosition({ max: { x: 5 } }, new Point3(5, 5))).toBe(false);
    expect(containsPosition({ min: { y: 5 } }, new Point3(5, 5))).toBe(true);
  });

  it('clips a segment with both endpoints outside and preserves direction and open ends', () => {
    const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 3 } };
    const forward = clipSegment(new Point3(-100, 50, -3), new Point3(200, 50, 6), bounds)!;
    expect(forward.start).toEqual(new Point3(0, 50, 0));
    expect(forward.end).toEqual(new Point3(100, 50, 3));
    expect(forward.startIncluded).toBe(true);
    expect(forward.endIncluded).toBe(false);
    const backward = clipSegment(new Point3(200, 50, 6), new Point3(-100, 50, -3), bounds)!;
    expect(backward.start).toEqual(forward.end);
    expect(backward.end).toEqual(forward.start);
    expect(backward.startIncluded).toBe(false);
    expect(backward.endIncluded).toBe(true);
  });

  it.each([
    [new Point3(0, 0, 3), new Point3(100, 0, 3), false],
    [new Point3(0, 0, 0), new Point3(100, 0, 0), true],
    [new Point3(0, 0, 1), new Point3(0, 0, 1), true],
    [new Point3(0, 0, -1), new Point3(0, 0, -1), false],
    [new Point3(0, 0, -1), new Point3(0, 0, 4), true],
    [new Point3(0, 0, -2), new Point3(100, 0, -1), false],
  ] as const)('handles parallel, repeated and vertical endpoints %j → %j', (a, b, exists) => {
    const segment = clipSegment(a, b, FLOOR);
    expect(Boolean(segment)).toBe(exists);

    if (segment) {
      [segment.start, segment.end].forEach(point => {
        expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true);
      });
    }
  });

  it('keeps excursions and an excluded shared vertex as separate fragments', () => {
    const fragments = clipPolyline(
      [new Point3(0, 0, 1), new Point3(100, 0, 5), new Point3(200, 0, 1)],
      FLOOR,
    );
    expect(fragments.map(fragment => fragment.points)).toEqual([
      [new Point3(0, 0, 1), new Point3(50, 0, 3)],
      [new Point3(150, 0, 3), new Point3(200, 0, 1)],
    ]);
    expect(
      clipPolyline([new Point3(0, 0, 1), new Point3(100, 0, 3), new Point3(200, 0, 1)], FLOOR),
    ).toHaveLength(2);
  });

  it('joins only consecutive eligible segments, retaining repeated vertices', () => {
    const points = [
      new Point3(0, 0, 1),
      new Point3(100, 0, 1),
      new Point3(100, 0, 1),
      new Point3(200, 0, 1),
    ];
    const fragments = clipPolyline(points, FLOOR);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]!.points).toEqual(points);
    expect(fragments[0]!.segments).toHaveLength(3);
    expect(clipPolyline([], FLOOR)).toEqual([]);
    expect(clipPolyline([points[0]!], FLOOR)[0]!.points).toEqual([points[0]]);
  });

  it('retains inclusive tangencies and rejects exclusive tangencies', () => {
    expect(
      clipSegment(new Point3(-1, 1, 0), new Point3(1, -1, 0), { min: { x: 0, y: 0 } })?.start,
    ).toEqual(new Point3(0, 0, 0));
    expect(
      clipSegment(new Point3(-1, 1, 0), new Point3(1, -1, 0), { max: { x: 0, y: 0 } }),
    ).toBeUndefined();
  });

  it('does not overflow derived coordinates for extreme finite endpoints', () => {
    const segment = clipSegment(
      new Point3(-Number.MAX_VALUE, 0, -3),
      new Point3(Number.MAX_VALUE, 0, 3),
      { min: { z: 0 }, max: { z: 1 } },
    )!;
    expect(
      [segment.start.x, segment.end.x, segment.start.z, segment.end.z].every(Number.isFinite),
    ).toBe(true);
    expect(
      squaredDistanceToSegment(
        new Point3(0, 1),
        new Point3(-Number.MAX_VALUE, 0),
        new Point3(Number.MAX_VALUE, 0),
      ),
    ).toBe(1);
    expect(squaredDistanceToSegment(new Point3(0, 1), new Point3(1, 1), new Point3(1, 1))).toBe(1);
  });
});
