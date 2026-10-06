import { AtlasError } from '#errors/atlas-error.js';

export function validateObjectId(field: string, id: string | undefined): void {
  if (id === undefined) {
    return;
  }

  if (typeof id !== 'string' || !id.trim()) {
    throw new AtlasError('Object ID must be non-empty.', {
      code: 'INVALID_OBJECT_ID',
      details: { field, id },
    });
  }
}
