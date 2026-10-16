import { validateMaterialName } from './material.validator.js';
import { copyObjectData } from './object-data.validator.js';

import type { MapObjectDefinition } from '#definitions/map-object-definition.js';

export function copyObjectAttributes(
  definition: MapObjectDefinition,
  field = 'object',
): Pick<MapObjectDefinition, 'data' | 'material'> {
  const data = copyObjectData(definition.data, `${field}.data`);

  if (definition.material !== undefined) {
    validateMaterialName(definition.material, `${field}.material`);
  }

  return Object.freeze({
    ...(data === undefined ? {} : { data }),
    ...(definition.material === undefined ? {} : { material: definition.material }),
  });
}
