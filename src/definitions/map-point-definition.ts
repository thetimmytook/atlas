import type { Point2 } from '#math/point2.js';
import type { Point3 } from '#math/point3.js';
import type { MapObjectDefinition } from './map-object-definition.js';

/** Shared point data for independent map objects and route-owned points. */
export interface MapPointDefinition extends MapObjectDefinition {
  readonly kind: 'point';
  readonly position: Point2 | Point3;

  /**
   * Picking override, independent of the point's symbol and geometry.
   * true includes the point in picking; false skips it without hiding its symbol.
   * Omitted/undefined uses the context default: standalone on, route-owned off.
   */
  readonly pickable?: boolean;
}
