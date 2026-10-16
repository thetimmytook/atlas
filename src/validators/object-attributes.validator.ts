import { validateMaterialName } from './material.validator.js';
import { copyObjectData } from './object-data.validator.js';
import { validateObjectLabel } from './object-label.validator.js';

import type { MapObjectDefinition } from '#definitions/map-object-definition.js';

export function copyObjectAttributes(
  definition: MapObjectDefinition,
  field = 'object',
): Pick<MapObjectDefinition, 'data' | 'material' | 'label'> {
  const data = copyObjectData(definition.data, `${field}.data`);
  const label = definition.label;
  validateObjectLabel(label, `${field}.label`);

  if (definition.material !== undefined) {
    validateMaterialName(definition.material, `${field}.material`);
  }

  return Object.freeze({
    ...(data === undefined ? {} : { data }),
    ...(definition.material === undefined ? {} : { material: definition.material }),
    ...(label === undefined ? {} : { label }),
  });
}
