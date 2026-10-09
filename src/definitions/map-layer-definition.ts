import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { BackgroundDescription } from './map-definition.js';

/** Direct full appearances and optional automatic spatial intersections. */
export interface MapLayerDefinition {
  readonly id?: string;
  readonly stackIndex?: number;
  readonly objects?: readonly string[];
  readonly background?: BackgroundDescription;
  readonly intersectionBounds?: IntersectionBounds | undefined;
}

export interface ResolvedMapLayerDefinition extends MapLayerDefinition {
  readonly id: string;
  readonly stackIndex: number;
  readonly objects: readonly string[];
}
