import { AtlasError } from '#errors/atlas-error.js';
import { Point3 } from '#math/point3.js';
import { createId } from '#objects/create-id.js';

import { copyObjectAttributes } from './object-attributes.validator.js';
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
  validatePoint(`${field}.position`, point.position, { spatial: true });
  validatePointPickable(point.pickable, `${field}.pickable`);
}

export function validatePointPickable(
  value: unknown,
  field = 'pickable',
): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new AtlasError('Point pickable must be a boolean or undefined.', {
      code: 'INVALID_POINT_PICKABLE',
      details: { field, actual: value },
    });
  }
}

/** Copy a validated definition and fill an omitted ID. */
export function resolveMapPoint(point: MapPointDefinition): WithId<MapPointDefinition> {
  return Object.freeze({
    id: point.id ?? createId(),
    kind: 'point',
    ...copyObjectAttributes(point, 'point'),
    ...(point.pickable === undefined ? {} : { pickable: point.pickable }),
    position: new Point3(
      point.position.x,
      point.position.y,
      'z' in point.position ? point.position.z : undefined,
    ),
  });
}
