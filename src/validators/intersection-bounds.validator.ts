/* eslint-disable security/detect-object-injection -- Coordinate keys use the fixed x/y/z allowlist and min/max sides. */
import { AtlasError } from '#errors/atlas-error.js';

import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { Point3 } from '#math/point3.js';

const AXES = ['x', 'y', 'z'] as const;

/** Validate and deeply copy before any asynchronous load preparation. */
export function resolveIntersectionBounds(
  value: IntersectionBounds,
  field: string,
): IntersectionBounds {
  const fail = (path: string, invalid: unknown): never => {
    throw new AtlasError('Invalid intersection bounds.', {
      code: 'INVALID_INTERSECTION_BOUNDS',
      details: { field: path, value: invalid },
    });
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(field, value);
  }

  let count = 0;

  const copy = (side: 'min' | 'max'): Partial<Point3> | undefined => {
    const limit = value[side];

    if (limit === undefined) {
      return undefined;
    }

    if (!limit || typeof limit !== 'object' || Array.isArray(limit)) {
      fail(`${field}.${side}`, limit);
    }

    const result: { x?: number; y?: number; z?: number } = {};

    for (const axis of AXES) {
      const coordinate = limit[axis];

      if (coordinate === undefined) {
        continue;
      }

      if (!Number.isFinite(coordinate)) {
        fail(`${field}.${side}.${axis}`, coordinate);
      }

      result[axis] = coordinate;
      count++;
    }

    return Object.freeze(result);
  };

  const min = copy('min');
  const max = copy('max');

  if (count === 0) {
    fail(field, value);
  }

  for (const axis of AXES) {
    const lower = min?.[axis];
    const upper = max?.[axis];

    if (lower !== undefined && upper !== undefined && lower >= upper) {
      fail(`${field}.${axis}`, { min: lower, max: upper });
    }
  }

  return Object.freeze({ ...(min ? { min } : {}), ...(max ? { max } : {}) });
}
