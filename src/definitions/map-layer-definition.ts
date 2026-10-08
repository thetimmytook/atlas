import type { BackgroundDescription } from './map-definition.js';

/** Direct full appearances; automatic intersections remain a later step. */
export interface MapLayerDefinition {
  readonly id?: string;
  readonly stackIndex?: number;
  readonly objects?: readonly string[];
  readonly background?: BackgroundDescription;
}

export interface ResolvedMapLayerDefinition extends MapLayerDefinition {
  readonly id: string;
  readonly stackIndex: number;
  readonly objects: readonly string[];
}
