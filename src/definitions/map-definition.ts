import { AtlasError } from '#errors/atlas-error.js';

export interface BackgroundDescription {
  readonly source: string;
  readonly width: number;
  readonly height: number;
}

/** Serializable map data for the first background prototype. */
export interface MapDefinition {
  readonly background: BackgroundDescription;
}

/** Validate and copy input before asynchronous preparation starts. */
export function prepareMapDefinition(definition: MapDefinition): MapDefinition {
  const { background } = definition;

  if (typeof background.source !== 'string' || !background.source.trim()) {
    throw new AtlasError('Background source must be a non-empty image URL.', {
      code: 'INVALID_BACKGROUND_SOURCE',
      details: { field: 'source', value: background.source },
    });
  }

  validateDimension('width', background.width);
  validateDimension('height', background.height);

  return Object.freeze({ background: Object.freeze({ ...background }) });
}

function validateDimension(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AtlasError('Background dimension must be a finite number greater than zero.', {
      code: 'INVALID_BACKGROUND_DIMENSION',
      details: { field, value },
    });
  }
}
