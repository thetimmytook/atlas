import { AtlasError } from '#errors/atlas-error.js';
import { Point } from '#math/point.js';

import { validatePoint } from './point.validator.js';

import type { PointGeometry } from '#definitions/object-definition.js';

/** Validate the public geometry boundary and take an immutable copy. */
export function prepareGeometry(field: string, geometry: PointGeometry): PointGeometry {
  if (geometry?.kind !== 'point') {
    throw new AtlasError('Unsupported geometry kind.', {
      code: 'INVALID_GEOMETRY_KIND',
      details: { field, kind: geometry?.kind },
    });
  }

  validatePoint(`${field}.position`, geometry.position);

  return Object.freeze({
    kind: geometry.kind,
    position: new Point(geometry.position.x, geometry.position.y),
  });
}
