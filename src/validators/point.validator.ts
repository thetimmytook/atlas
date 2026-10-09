import { validateNumber } from './number.validator.js';

import type { Point2 } from '#math/point2.js';
import type { Point3 } from '#math/point3.js';

export function validatePoint(
  field: string,
  value: Point2 | Point3,
  { spatial = false } = {},
): void {
  validateNumber(`${field}.x`, value?.x);
  validateNumber(`${field}.y`, value?.y);

  const z = spatial && 'z' in value ? value.z : undefined;

  if (z !== undefined) {
    validateNumber(`${field}.z`, z);
  }
}
