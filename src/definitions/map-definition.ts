import { AtlasError } from '#errors/atlas-error.js';
import { AtlasId } from '#objects/atlas-id.js';
import { prepareGeometry } from '#validators/geometry.validator.js';

import type { ObjectDefinition } from './object-definition.js';

export interface BackgroundDescription {
  readonly source: string;
  readonly width: number;
  readonly height: number;
}

/** Serializable map data for the background and object prototype. */
export interface MapDefinition {
  readonly background: BackgroundDescription;
  readonly objects?: readonly ObjectDefinition[];
}

export interface NormalizedMapDefinition extends MapDefinition {
  readonly objects: readonly (ObjectDefinition & { readonly id: string })[];
}

/** Validate and copy input before asynchronous preparation starts. */
export function normalizeMapDefinition(definition: MapDefinition): NormalizedMapDefinition {
  const { background } = definition;

  if (typeof background.source !== 'string' || !background.source.trim()) {
    throw new AtlasError('Background source must be a non-empty image URL.', {
      code: 'INVALID_BACKGROUND_SOURCE',
      details: { field: 'source', value: background.source },
    });
  }

  validateDimension('width', background.width);
  validateDimension('height', background.height);

  const ids = new Set<string>();
  const definitions = definition.objects ?? [];

  for (const [index, object] of definitions.entries()) {
    if (object.id === undefined) {
      continue;
    }

    if (typeof object.id !== 'string' || !object.id.trim() || ids.has(object.id)) {
      throw new AtlasError('Object ID must be non-empty and unique in the map.', {
        code: 'INVALID_OBJECT_ID',
        details: { index, id: object.id },
      });
    }

    ids.add(object.id);
  }

  const objects = definitions.map((object, index) => {
    let id = object.id;

    if (id === undefined) {
      do {
        id = AtlasId();
      } while (ids.has(id));

      ids.add(id);
    }

    return Object.freeze({
      id,
      geometry: prepareGeometry(`objects[${index}].geometry`, object.geometry),
    });
  });

  return Object.freeze({
    background: Object.freeze({ ...background }),
    objects: Object.freeze(objects),
  });
}

function validateDimension(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AtlasError('Background dimension must be a finite number greater than zero.', {
      code: 'INVALID_BACKGROUND_DIMENSION',
      details: { field, value },
    });
  }
}
