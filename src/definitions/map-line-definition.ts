import type { WithId } from './identity.js';
import type { MapObjectDefinition } from './map-object-definition.js';
import type { MapPointDefinition } from './map-point-definition.js';

/** An independent straight line object. */
export interface MapLineDefinition extends MapObjectDefinition {
  readonly kind: 'line';
  readonly points: readonly [MapPointDefinition, MapPointDefinition];
}

export interface ResolvedMapLineDefinition extends WithId<MapLineDefinition> {
  readonly points: readonly [WithId<MapPointDefinition>, WithId<MapPointDefinition>];
}
