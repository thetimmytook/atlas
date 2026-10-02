import { AtlasError } from '#errors/atlas-error.js';
import { Point } from '#math/point.js';

import { validatePoint } from './point.validator.js';

import type { ObjectGeometry } from '#definitions/object-definition.js';

/** Validate the public geometry boundary and take an immutable copy. */
export function prepareGeometry(field: string, geometry: ObjectGeometry): ObjectGeometry {
  const kind = geometry?.kind;

  if (geometry?.kind === 'point') {
    validatePoint(`${field}.position`, geometry.position);

    return Object.freeze({
      kind: geometry.kind,
      position: new Point(geometry.position.x, geometry.position.y),
    });
  }

  if (geometry?.kind === 'line') {
    validatePoint(`${field}.start`, geometry.start);
    validatePoint(`${field}.end`, geometry.end);

    return Object.freeze({
      kind: geometry.kind,
      start: new Point(geometry.start.x, geometry.start.y),
      end: new Point(geometry.end.x, geometry.end.y),
    });
  }

  throw new AtlasError('Unsupported geometry kind.', {
    code: 'INVALID_GEOMETRY_KIND',
    details: { field, kind },
  });
}
