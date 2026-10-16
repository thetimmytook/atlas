import { AtlasError } from './atlas-error.js';

import type { AtlasErrorOptions } from './atlas-error.js';

export type AtlasMaterialErrorCode =
  | 'MATERIAL_CONFIGURATION_LOCKED'
  | 'INVALID_MATERIAL_CONFIGURATION'
  | 'DUPLICATE_PROPERTY_REGISTRATION'
  | 'INVALID_OBJECT_DATA'
  | 'INVALID_MATERIAL_DEFINITION'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_MATERIAL_PARENT'
  | 'MATERIAL_INHERITANCE_CYCLE'
  | 'INVALID_MATERIAL_RULE'
  | 'MATERIAL_PROPERTY_READ_FAILED'
  | 'INVALID_SELECTION_PROPERTY_VALUE'
  | 'UNKNOWN_MATERIAL_PROPERTY'
  | 'INVALID_MATERIAL_PROPERTY'
  | 'INCOMPATIBLE_MATERIAL_PROPERTY'
  | 'UNKNOWN_IMAGE_RESOURCE'
  | 'INVALID_IMAGE_RESOURCE'
  | 'IMAGE_RESOURCE_LOAD_FAILED';

export interface AtlasMaterialErrorOptions extends Omit<AtlasErrorOptions, 'code'> {
  readonly code: AtlasMaterialErrorCode;
}

const MESSAGES: Readonly<Record<AtlasMaterialErrorCode, string>> = Object.freeze({
  MATERIAL_CONFIGURATION_LOCKED: 'Material configuration is locked.',
  INVALID_MATERIAL_CONFIGURATION: 'Invalid material configuration.',
  DUPLICATE_PROPERTY_REGISTRATION: 'Property name is already registered.',
  INVALID_OBJECT_DATA: 'Invalid object data.',
  INVALID_MATERIAL_DEFINITION: 'Invalid material definition.',
  UNKNOWN_MATERIAL: 'Unknown material reference.',
  UNKNOWN_MATERIAL_PARENT: 'Unknown material parent.',
  MATERIAL_INHERITANCE_CYCLE: 'Material inheritance contains a cycle.',
  INVALID_MATERIAL_RULE: 'Invalid material rule.',
  MATERIAL_PROPERTY_READ_FAILED: 'Unable to read selection property.',
  INVALID_SELECTION_PROPERTY_VALUE: 'Invalid selection property value.',
  UNKNOWN_MATERIAL_PROPERTY: 'Unknown material property.',
  INVALID_MATERIAL_PROPERTY: 'Invalid material property value.',
  INCOMPATIBLE_MATERIAL_PROPERTY: 'Material property is incompatible with object kind.',
  UNKNOWN_IMAGE_RESOURCE: 'Unknown image resource reference.',
  INVALID_IMAGE_RESOURCE: 'Invalid image resource.',
  IMAGE_RESOURCE_LOAD_FAILED: 'Unable to prepare image resource.',
});

export class AtlasMaterialError extends AtlasError {
  override readonly code: AtlasMaterialErrorCode;

  constructor(options: AtlasMaterialErrorOptions) {
    super(MESSAGES[options.code], options);
    this.name = 'AtlasMaterialError';
    this.code = options.code;
  }
}
