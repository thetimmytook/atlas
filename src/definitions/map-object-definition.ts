import type { JsonObject } from './material-definition.js';

/** Serializable identity, application data and optional explicit material assignment. */
export interface MapObjectDefinition {
  readonly id?: string;
  readonly kind: string;
  readonly data?: JsonObject;
  readonly material?: string;
}
