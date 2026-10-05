import { AtlasError } from '#errors/atlas-error.js';

import { resolveMapPoint, validateMapPoint } from './map-point.validator.js';

import type { WithId } from '#definitions/identity.js';
import type {
  MapLineDefinition,
  ResolvedMapLineDefinition,
} from '#definitions/map-line-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

export function validateMapPoints(field: string, points: readonly MapPointDefinition[]): void {
  if (!Array.isArray(points)) {
    throw new AtlasError('Object points must be an array.', {
      code: 'INVALID_OBJECT_POINTS',
      details: { field, value: points },
    });
  }

  const definitions: readonly MapPointDefinition[] = points;

  for (const [index, point] of definitions.entries()) {
    validateMapPoint(`${field}[${index}]`, point);
  }
}

export function validateLinePoints(field: string, points: MapLineDefinition['points']): void {
  validateMapPoints(field, points);

  if (points.length !== 2) {
    throw new AtlasError('Line must have exactly two points.', {
      code: 'INVALID_LINE_POINTS',
      details: { field, expected: 2, received: points.length },
    });
  }
}

/** Called after validation and reservation of all explicit object and point IDs. */
export function resolveMapPoints(
  points: MapLineDefinition['points'],
  ids: Set<string>,
): ResolvedMapLineDefinition['points'];
export function resolveMapPoints(
  points: readonly MapPointDefinition[],
  ids: Set<string>,
): readonly WithId<MapPointDefinition>[];

export function resolveMapPoints(
  points: readonly MapPointDefinition[],
  ids: Set<string>,
): readonly WithId<MapPointDefinition>[] {
  return Object.freeze(points.map(point => resolveMapPoint(point, ids)));
}
