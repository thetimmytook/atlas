import type { Point } from './point.js';

/** Squared distance to the nearest point on a segment, including its endpoints. */
export function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const px = point.x - start.x;
  const py = point.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : (px * dx + py * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const distanceX = px - t * dx;
  const distanceY = py - t * dy;

  return distanceX * distanceX + distanceY * distanceY;
}
