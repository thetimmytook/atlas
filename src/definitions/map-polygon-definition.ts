import type { Point2 } from '#math/point2.js';
import type { WithId } from './identity.js';
import type { MapObjectDefinition } from './map-object-definition.js';

/** One horizontal contour, optionally extruded upwards; vertices have no object identity. */
export interface MapPolygonDefinition extends MapObjectDefinition {
  readonly kind: 'polygon';
  readonly contour: readonly Point2[];
  readonly baseZ?: number;
  readonly height?: number;
}

export interface ResolvedMapPolygonDefinition extends WithId<MapPolygonDefinition> {
  readonly baseZ: number;
  readonly height: number;
}
