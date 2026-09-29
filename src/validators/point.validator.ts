import { validateNumber } from './number.validator.js';

import type { Point } from '#math/point.js';

export function validatePoint(field: string, value: Point): void {
  validateNumber(`${field}.x`, value.x);
  validateNumber(`${field}.y`, value.y);
}
