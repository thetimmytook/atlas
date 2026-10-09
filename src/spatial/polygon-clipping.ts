import { Point2 } from '#math/point2.js';
import { hasPolygonArea } from '#math/polygon.js';

import { boundaryParameter } from './intersection.js';

import type { IntersectionBounds } from '#math/intersection-bounds.js';

type Axis = 'x' | 'y';

// Indexed access is restricted to the closed x/y axis union, never external property names.
/* eslint-disable security/detect-object-injection */

/** Clip convex cells independently; their union can retain disconnected polygon regions. */
export function clipPolygonCells(
  cells: readonly (readonly Point2[])[],
  bounds: IntersectionBounds,
): readonly (readonly Point2[])[] {
  return Object.freeze(
    cells.reduce<(readonly Point2[])[]>((result, cell) => {
      let points = cell;

      for (const axis of ['x', 'y'] as const) {
        for (const [limit, lower] of [
          [bounds.min?.[axis], true],
          [bounds.max?.[axis], false],
        ] as const) {
          if (limit !== undefined) {
            points = clipCell(points, axis, limit, lower);
          }
        }
      }

      if (hasPolygonArea(points)) {
        result.push(Object.freeze(points));
      }

      return result;
    }, []),
  );
}

function clipCell(
  points: readonly Point2[],
  axis: Axis,
  limit: number,
  lower: boolean,
): readonly Point2[] {
  const result: Point2[] = [];
  const inside = (point: Point2): boolean => (lower ? point[axis] >= limit : point[axis] <= limit);

  const append = (point: Point2): void => {
    const last = result.at(-1);

    if (!last || last.x !== point.x || last.y !== point.y) {
      result.push(point);
    }
  };

  for (const [index, end] of points.entries()) {
    const start = points.at((index + points.length - 1) % points.length)!;

    if (inside(start) !== inside(end)) {
      append(intersection(start, end, axis, limit));
    }

    if (inside(end)) {
      append(end);
    }
  }

  if (result.length > 1 && result[0]!.x === result.at(-1)!.x && result[0]!.y === result.at(-1)!.y) {
    result.pop();
  }

  return result;
}

/** Canonical edge direction gives adjacent cells exactly the same cut coordinate. */
function intersection(a: Point2, b: Point2, axis: Axis, limit: number): Point2 {
  const [start, end] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
  const t = boundaryParameter(start[axis], end[axis], limit);
  const other = axis === 'x' ? 'y' : 'x';
  const coordinate = (1 - t) * start[other] + t * end[other];
  const value = Math.max(
    Math.min(start[other], end[other]),
    Math.min(Math.max(start[other], end[other]), coordinate),
  );

  return axis === 'x' ? new Point2(limit, value) : new Point2(value, limit);
}

/** The closed drawing coordinates reach max planes; fill membership remains half-open. */
export function containsPolygonXY(bounds: IntersectionBounds, point: Point2): boolean {
  return (
    (bounds.min?.x === undefined || point.x >= bounds.min.x) &&
    (bounds.max?.x === undefined || point.x < bounds.max.x) &&
    (bounds.min?.y === undefined || point.y >= bounds.min.y) &&
    (bounds.max?.y === undefined || point.y < bounds.max.y)
  );
}

/** Planes use point membership; volumes require a positive-length overlap. */
export function clipPolygonVerticalRange(
  baseZ: number,
  height: number,
  bounds: IntersectionBounds,
): { baseZ: number; height: number } | undefined {
  if (height === 0) {
    return (bounds.min?.z === undefined || baseZ >= bounds.min.z) &&
      (bounds.max?.z === undefined || baseZ < bounds.max.z)
      ? { baseZ, height }
      : undefined;
  }

  const bottom = Math.max(baseZ, bounds.min?.z ?? -Infinity);
  const top = Math.min(baseZ + height, bounds.max?.z ?? Infinity);

  return top > bottom ? { baseZ: bottom, height: top - bottom } : undefined;
}
