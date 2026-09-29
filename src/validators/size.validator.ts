import { AtlasError } from '#errors/atlas-error.js';

import { validateNumber } from './number.validator.js';

import type { Size } from '#math/size.js';
import type { NumberValidationOptions } from './number.validator.js';

export function validateSize(
  field: string,
  value: Size,
  options: NumberValidationOptions = {},
): void {
  validateNumber(`${field}.width`, value.width, options);
  validateNumber(`${field}.height`, value.height, options);

  if (value.width < 0 || value.height < 0) {
    throw new AtlasError('Dimensions must be non-negative.', {
      code: 'INVALID_SIZE',
      details: { field, width: value.width, height: value.height },
    });
  }
}
