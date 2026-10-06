import { AtlasError } from '#errors/atlas-error.js';
import { Point } from '#math/point.js';
import { createId } from '#objects/create-id.js';

import { validateObjectId } from './object-id.validator.js';
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

  validateObjectId(`${field}.id`, point.id);
  validatePoint(`${field}.position`, point.position);
}

/** Copy a validated definition and fill an omitted ID. */
export function resolveMapPoint(point: MapPointDefinition): WithId<MapPointDefinition> {
  return Object.freeze({
    id: point.id ?? createId(),
    kind: 'point',
    position: new Point(point.position.x, point.position.y),
  });
}
