import { AtlasError } from '#errors/atlas-error.js';

export function validateObjectId(field: string, id: string): void {
  if (typeof id === 'string' && id.trim()) {
    return;
  }

  throw new AtlasError('Object ID must be non-empty.', {
    code: 'INVALID_OBJECT_ID',
    details: { field, id },
  });
}

export function reserveObjectId(field: string, id: string | undefined, ids: Set<string>): void {
  if (id === undefined) {
    return;
  }

  validateObjectId(field, id);

  if (ids.has(id)) {
    throw new AtlasError('Object ID must be unique in the map.', {
      code: 'INVALID_OBJECT_ID',
      details: { field, id },
    });
  }

  ids.add(id);
}
