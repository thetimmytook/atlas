import { AtlasError } from '#errors/atlas-error.js';

export function validateObjectLabel(
  value: unknown,
  field = 'label',
): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== 'string' || /[\r\n]/.test(value))) {
    throw new AtlasError('Object label must be a single-line string or undefined.', {
      code: 'INVALID_OBJECT_LABEL',
      details: { field, actual: value },
    });
  }
}
