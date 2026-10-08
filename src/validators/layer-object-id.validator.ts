import { AtlasError } from '#errors/atlas-error.js';

export function validateLayerObjectId(id: string, field = 'objectId'): void {
  if (typeof id !== 'string' || !id.trim()) {
    throw new AtlasError('Layer object ID must be non-empty.', {
      code: 'INVALID_LAYER_OBJECT_ID',
      details: { field, id },
    });
  }
}
