import type { Point } from '#math/point.js';

/** Geometric primitives understood by Atlas, independent of application meaning. */
export interface PointGeometry {
  readonly kind: 'point';
  readonly position: Point;
}

export interface ObjectDefinition {
  readonly id?: string;
  readonly geometry: PointGeometry;
}
