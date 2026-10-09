import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { Point3 } from '#math/point3.js';
import type { ClippedSegment } from './intersection.js';

/** Internal live views of map-object coordinates for rendering and spatial queries. */
export interface PointGeometry {
  readonly kind: 'point';
  readonly position: Point3;
}

/** A straight segment in map coordinates. */
export interface LineGeometry {
  readonly kind: 'line';
  readonly start: Point3;
  readonly end: Point3;
  readonly segment?: ClippedSegment;
}

/** A connected chain; consecutive points define its straight segments. */
export interface PolylineGeometry {
  readonly kind: 'polyline';
  readonly points: readonly Point3[];
  readonly segments?: readonly ClippedSegment[];
}

/** Union of positive-area convex cells; internal decomposition has no object identity. */
export interface PolygonGeometry {
  readonly kind: 'polygon';
  readonly cells: readonly (readonly Point3[])[];
  readonly baseZ: number;
  readonly height: number;
  readonly bounds?: IntersectionBounds;
}

export type Geometry = PointGeometry | LineGeometry | PolylineGeometry | PolygonGeometry;
