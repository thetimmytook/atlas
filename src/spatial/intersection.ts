/* eslint-disable security/detect-object-injection -- Coordinate keys come only from AXES; array indices are bounded by internal loops. */
import { Point } from '#math/point.js';

import type { IntersectionBounds } from '#math/intersection-bounds.js';

const AXES = ['x', 'y', 'z'] as const;

export interface ClippedSegment {
  readonly start: Point;
  readonly end: Point;
  readonly startIncluded: boolean;
  readonly endIncluded: boolean;
  readonly startsAtVertex: boolean;
  readonly endsAtVertex: boolean;
}

export interface ClippedFragment {
  readonly points: readonly Point[];
  readonly segments: readonly ClippedSegment[];
}

export function containsPosition(bounds: IntersectionBounds, point: Point): boolean {
  return AXES.every(axis => {
    const value = point[axis] ?? 0;
    const min = bounds.min?.[axis];
    const max = bounds.max?.[axis];

    return (min === undefined || value >= min) && (max === undefined || value < max);
  });
}

type Axis = (typeof AXES)[number];
type Planes = { x?: number; y?: number; z?: number };
interface ClipInterval {
  lower: number;
  upper: number;
  lowerIncluded: boolean;
  upperIncluded: boolean;
  lowerPlanes: Planes;
  upperPlanes: Planes;
}

/** Slab clipping of the source parameter interval, retaining open endpoint ownership. */
export function clipSegment(
  start: Point,
  end: Point,
  bounds: IntersectionBounds,
): ClippedSegment | undefined {
  const interval: ClipInterval = {
    lower: 0,
    upper: 1,
    lowerIncluded: true,
    upperIncluded: true,
    lowerPlanes: {},
    upperPlanes: {},
  };

  for (const axis of AXES) {
    if (!clipAxis(start[axis] ?? 0, end[axis] ?? 0, bounds, axis, interval)) {
      return undefined;
    }
  }

  return {
    start: positionAt(start, end, interval.lower, interval.lowerPlanes, bounds),
    end: positionAt(start, end, interval.upper, interval.upperPlanes, bounds),
    startIncluded: interval.lowerIncluded,
    endIncluded: interval.upperIncluded,
    startsAtVertex: interval.lower === 0,
    endsAtVertex: interval.upper === 1,
  };
}

function clipAxis(
  a: number,
  b: number,
  bounds: IntersectionBounds,
  axis: Axis,
  interval: ClipInterval,
): boolean {
  const min = bounds.min?.[axis];
  const max = bounds.max?.[axis];

  if ((min !== undefined && a < min && b < min) || (max !== undefined && a >= max && b >= max)) {
    return false;
  }

  if (a === b) {
    return true;
  }

  for (const [limit, inclusive, isLower] of [
    [min, true, b > a],
    [max, false, b < a],
  ] as const) {
    if (limit === undefined) {
      continue;
    }

    if (inclusive ? a >= limit && b >= limit : a < limit && b < limit) {
      continue;
    }

    restrictInterval(interval, boundaryParameter(a, b, limit), inclusive, isLower, axis, limit);
  }

  return (
    interval.lower < interval.upper ||
    (interval.lower === interval.upper && interval.lowerIncluded && interval.upperIncluded)
  );
}

function boundaryParameter(a: number, b: number, limit: number): number {
  const difference = b - a;
  const offset = limit - a;

  if (Number.isFinite(difference) && Number.isFinite(offset)) {
    return offset / difference;
  }

  // Scaling avoids overflow for finite endpoints of opposite extreme magnitude.
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(limit), 1);

  return (limit / scale - a / scale) / (b / scale - a / scale);
}

function restrictInterval(
  interval: ClipInterval,
  t: number,
  inclusive: boolean,
  isLower: boolean,
  axis: Axis,
  limit: number,
): void {
  if (isLower && t >= interval.lower) {
    const equal = t === interval.lower;
    interval.lowerIncluded = inclusive && (!equal || interval.lowerIncluded);
    interval.lowerPlanes = equal ? { ...interval.lowerPlanes, [axis]: limit } : { [axis]: limit };
    interval.lower = t;

    return;
  }

  if (!isLower && t <= interval.upper) {
    const equal = t === interval.upper;
    interval.upperIncluded = inclusive && (!equal || interval.upperIncluded);
    interval.upperPlanes = equal ? { ...interval.upperPlanes, [axis]: limit } : { [axis]: limit };
    interval.upper = t;
  }
}

function positionAt(
  start: Point,
  end: Point,
  t: number,
  planes: Partial<Point>,
  bounds: IntersectionBounds,
): Point {
  if (t === 0) {
    return start;
  }

  if (t === 1) {
    return end;
  }

  const coordinate = (axis: Axis): number => {
    if (planes[axis] !== undefined) {
      return planes[axis];
    }

    const value = (1 - t) * (start[axis] ?? 0) + t * (end[axis] ?? 0);

    // Exact plane coordinates avoid interpolation roundoff beyond the visual boundary.
    return Math.max(
      bounds.min?.[axis] ?? -Infinity,
      Math.min(bounds.max?.[axis] ?? Infinity, value),
    );
  };

  return new Point(coordinate('x'), coordinate('y'), coordinate('z'));
}

/** Join only consecutive eligible source segments, never an excursion outside the bounds. */
export function clipPolyline(
  points: readonly Point[],
  bounds: IntersectionBounds,
): readonly ClippedFragment[] {
  if (points.length === 1 && containsPosition(bounds, points[0]!)) {
    return [{ points, segments: [] }];
  }

  const fragments: { points: Point[]; segments: ClippedSegment[] }[] = [];
  let previous: ClippedSegment | undefined;

  for (let index = 1; index < points.length; index++) {
    const segment = clipSegment(points[index - 1]!, points[index]!, bounds);

    if (!segment) {
      previous = undefined;
      continue;
    }

    const last = fragments.at(-1);

    if (
      last &&
      previous?.endsAtVertex &&
      segment.startsAtVertex &&
      previous.endIncluded &&
      segment.startIncluded
    ) {
      last.points.push(segment.end);
      last.segments.push(segment);
    } else {
      fragments.push({ points: [segment.start, segment.end], segments: [segment] });
    }

    previous = segment;
  }

  return fragments;
}
