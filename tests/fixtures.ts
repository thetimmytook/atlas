import type { MapPointDefinition } from '#definitions/map-point-definition.js';

export function pointDefinition(x: number, y = 0, id?: string): MapPointDefinition {
  return { kind: 'point', position: { x, y }, ...(id === undefined ? {} : { id }) };
}
