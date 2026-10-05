import { AtlasError } from '#errors/atlas-error.js';
import { Point } from '#math/point.js';
import { resolveObjectId } from '#objects/create-id.js';

import { validatePoint } from './point.validator.js';

import type { WithId } from '#definitions/identity.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

export function validateMapPoint(field: string, point: MapPointDefinition): void {
  if (point?.kind !== 'point') {
    throw new AtlasError('Point object is required.', {
      code: 'INVALID_OBJECT_KIND',
      details: { field: `${field}.kind`, kind: point?.kind },
    });
  }

  validatePoint(`${field}.position`, point.position);
}

/** Called after validation and reservation of all explicit object and point IDs. */
export function resolveMapPoint(
  point: MapPointDefinition,
  ids: Set<string>,
): WithId<MapPointDefinition> {
  return Object.freeze({
    id: resolveObjectId(point.id, ids),
    kind: 'point',
    position: new Point(point.position.x, point.position.y),
  });
}
