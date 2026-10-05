import type { Point } from '#math/point.js';
import type { MapObjectDefinition } from './map-object-definition.js';

/** Shared point data for independent map objects and route-owned points. */
export interface MapPointDefinition extends MapObjectDefinition {
  readonly kind: 'point';
  readonly position: Point;
}
