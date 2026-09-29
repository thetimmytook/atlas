import { AtlasError } from '#errors/atlas-error.js';

export interface NumberValidationOptions {
  readonly positive?: boolean;
}

export function validateNumber(
  field: string,
  value: number,
  { positive = false }: NumberValidationOptions = {},
): void {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    throw new AtlasError('Invalid numeric value.', {
      code: 'INVALID_NUMBER',
      details: { field, value, expected: positive ? 'finite positive number' : 'finite number' },
    });
  }
}
