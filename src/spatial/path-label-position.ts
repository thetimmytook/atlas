import { Point2 } from '#math/point2.js';

import type { LineGeometry, PolylineGeometry } from './geometry.js';

/** Half the displayed XY length in source order, without joining separate fragments. */
export function pathLabelPosition(
  fragments: readonly (LineGeometry | PolylineGeometry)[],
): Point2 | undefined {
  const segments: { start: Point2; end: Point2; length: number }[] = [];
  let first: Point2 | undefined;
  let total = 0;

  for (const geometry of fragments) {
    const points = geometry.kind === 'line' ? [geometry.start, geometry.end] : geometry.points;
    first ??= points[0];

    for (let index = 1; index < points.length; index++) {
      const start = points.at(index - 1)!;
      const end = points.at(index)!;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      segments.push({ start, end, length });
      total += length;
    }
  }

  if (!first) {
    return undefined;
  }

  if (!Number.isFinite(total)) {
    // Use relative lengths only on overflow; retain tiny finite deltas on ordinary paths.
    const scale = segments.reduce(
      (maximum, { start, end }) =>
        Math.max(maximum, Math.abs(start.x), Math.abs(start.y), Math.abs(end.x), Math.abs(end.y)),
      1,
    );
    total = segments.reduce((sum, segment) => {
      segment.length = Math.hypot(
        segment.end.x / scale - segment.start.x / scale,
        segment.end.y / scale - segment.start.y / scale,
      );

      return sum + segment.length;
    }, 0);
  }

  if (total === 0) {
    return new Point2(first.x, first.y);
  }

  let remaining = total / 2;

  for (const { start, end, length } of segments) {
    if (length > 0 && remaining <= length) {
      const fraction = remaining / length;

      return new Point2(
        interpolateCoordinate(start.x, end.x, fraction),
        interpolateCoordinate(start.y, end.y, fraction),
      );
    }

    remaining -= length;
  }

  return undefined;
}

/** Avoid an overflowing endpoint difference and preserve exact source endpoints. */
function interpolateCoordinate(start: number, end: number, fraction: number): number {
  if (fraction === 0) {
    return start;
  }

  if (fraction === 1) {
    return end;
  }

  const difference = end - start;

  return Number.isFinite(difference)
    ? start + difference * fraction
    : (1 - fraction) * start + fraction * end;
}
