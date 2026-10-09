import type { Point3 } from './point3.js';

/** Axis-aligned half-open limits; omitted coordinates are unbounded. */
export interface IntersectionBounds {
  readonly min?: Partial<Point3>;
  readonly max?: Partial<Point3>;
}
