import type { Point } from '#math/point.js';

/** Geometric primitives understood by Atlas, independent of application meaning. */
export interface PointGeometry {
  readonly kind: 'point';
  readonly position: Point;
}

/** A straight segment in map coordinates. Endpoint names are a prototype contract. */
export interface LineGeometry {
  readonly kind: 'line';
  readonly start: Point;
  readonly end: Point;
}

export type ObjectGeometry = PointGeometry | LineGeometry;

export interface ObjectDefinition {
  readonly id?: string;
  readonly geometry: ObjectGeometry;
}
