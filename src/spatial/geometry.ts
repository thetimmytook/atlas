import type { Point } from '#math/point.js';
import type { ClippedSegment } from './intersection.js';

/** Internal live views of map-object coordinates for rendering and spatial queries. */
export interface PointGeometry {
  readonly kind: 'point';
  readonly position: Point;
}

/** A straight segment in map coordinates. */
export interface LineGeometry {
  readonly kind: 'line';
  readonly start: Point;
  readonly end: Point;
  readonly segment?: ClippedSegment;
}

/** A connected chain; consecutive points define its straight segments. */
export interface PolylineGeometry {
  readonly kind: 'polyline';
  readonly points: readonly Point[];
  readonly segments?: readonly ClippedSegment[];
}

export type Geometry = PointGeometry | LineGeometry | PolylineGeometry;
