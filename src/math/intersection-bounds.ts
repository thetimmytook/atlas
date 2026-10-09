import type { Point } from './point.js';

/** Axis-aligned half-open limits; omitted coordinates are unbounded. */
export interface IntersectionBounds {
  readonly min?: Partial<Point>;
  readonly max?: Partial<Point>;
}
