import type { WithId } from './identity.js';
import type { MapObjectDefinition } from './map-object-definition.js';
import type { MapPointDefinition } from './map-point-definition.js';

/** A route is a polyline with identifiable points; it owns no line objects. */
export interface MapRouteDefinition extends MapObjectDefinition {
  readonly kind: 'route';
  readonly points: readonly MapPointDefinition[];
}

export interface ResolvedMapRouteDefinition extends WithId<MapRouteDefinition> {
  readonly points: readonly WithId<MapPointDefinition>[];
}
