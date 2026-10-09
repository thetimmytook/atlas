import type { Point } from './point.js';

/** Squared distance to the nearest point on a segment, including its endpoints. */
export function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const px = point.x - start.x;
  const py = point.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : (px * dx + py * dy) / lengthSquared;

  if (!Number.isFinite(projection)) {
    return scaledDistanceToSegment(point, start, end);
  }

  const t = Math.max(0, Math.min(1, projection));
  const distanceX = px - t * dx;
  const distanceY = py - t * dy;

  return distanceX * distanceX + distanceY * distanceY;
}

/** Avoid overflow in intermediate differences/products for extreme finite coordinates. */
function scaledDistanceToSegment(point: Point, start: Point, end: Point): number {
  const scale = Math.max(
    Math.abs(point.x),
    Math.abs(point.y),
    Math.abs(start.x),
    Math.abs(start.y),
    Math.abs(end.x),
    Math.abs(end.y),
    1,
  );
  const dx = end.x / scale - start.x / scale;
  const dy = end.y / scale - start.y / scale;
  const px = point.x / scale - start.x / scale;
  const py = point.y / scale - start.y / scale;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : (px * dx + py * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const distanceX = point.x - ((1 - t) * start.x + t * end.x);
  const distanceY = point.y - ((1 - t) * start.y + t * end.y);

  return distanceX * distanceX + distanceY * distanceY;
}
