import { AtlasError } from '#errors/atlas-error.js';
import { Size } from '#math/size.js';
import { createId } from '#objects/create-id.js';
import { resolveIntersectionBounds } from '#validators/intersection-bounds.validator.js';
import { validateLayerObjectId } from '#validators/layer-object-id.validator.js';
import { resolveMapPoint, validateMapPoint } from '#validators/map-point.validator.js';
import {
  resolveMapPoints,
  validateLinePoints,
  validateMapPoints,
} from '#validators/map-points.validator.js';
import { validateNumber } from '#validators/number.validator.js';
import { validateObjectId } from '#validators/object-id.validator.js';
import { validateSize } from '#validators/size.validator.js';

import type { WithId } from './identity.js';
import type { MapLayerDefinition, ResolvedMapLayerDefinition } from './map-layer-definition.js';
import type { MapLineDefinition, ResolvedMapLineDefinition } from './map-line-definition.js';
import type { MapPointDefinition } from './map-point-definition.js';
import type { MapRouteDefinition, ResolvedMapRouteDefinition } from './map-route-definition.js';

export type MapEntryDefinition = MapLineDefinition | MapPointDefinition | MapRouteDefinition;
export type ResolvedMapEntry =
  ResolvedMapLineDefinition | WithId<MapPointDefinition> | ResolvedMapRouteDefinition;

/** Provisional URL/size input; replace with the agreed resource/background-placement contract. */
export interface BackgroundDescription {
  readonly source: string;
  readonly size: Size;
}

/** Serializable shared objects and explicit layers. No implicit layer is created. */
export interface MapDefinition {
  readonly layers: readonly MapLayerDefinition[];
  readonly objects?: readonly MapEntryDefinition[];
}

export interface ResolvedMapDefinition extends MapDefinition {
  readonly layers: readonly ResolvedMapLayerDefinition[];
  readonly objects: readonly ResolvedMapEntry[];
}

const objectKinds: readonly MapEntryDefinition['kind'][] = ['line', 'route', 'point'];

/** Validate and copy input before asynchronous preparation starts. */
export function resolveMapDefinition(definition: MapDefinition): ResolvedMapDefinition {
  if (!Array.isArray(definition?.layers)) {
    throw new AtlasError('Map layers must be an array.', {
      code: 'INVALID_MAP_LAYERS',
      details: { value: definition?.layers },
    });
  }

  if (Object.hasOwn(definition, 'background')) {
    throw new AtlasError('Background must belong to a layer.', {
      code: 'TOP_LEVEL_BACKGROUND_UNSUPPORTED',
    });
  }

  const definitions = definition.objects === undefined ? [] : definition.objects;

  if (!Array.isArray(definitions)) {
    throw new AtlasError('Map objects must be an array.', {
      code: 'INVALID_MAP_OBJECTS',
      details: { value: definitions },
    });
  }

  const objects = Array.from(definitions, (object: MapEntryDefinition, index) =>
    resolveMapEntry(object, `objects[${index}]`),
  );
  const rootIds = new Set(objects.map(object => object.id));
  const layerIds = new Set<string>();
  const layers = Array.from(definition.layers, (layer: MapLayerDefinition, index) => {
    const resolved = resolveMapLayer(layer, index, rootIds);

    if (layerIds.has(resolved.id)) {
      throw new AtlasError('Layer IDs must be unique.', {
        code: 'DUPLICATE_LAYER_ID',
        details: { layerId: resolved.id, index },
      });
    }

    layerIds.add(resolved.id);

    return resolved;
  });

  return Object.freeze({
    layers: Object.freeze(layers),
    objects: Object.freeze(objects),
  });
}

function resolveMapLayer(
  layer: MapLayerDefinition,
  index: number,
  rootIds: ReadonlySet<string>,
): ResolvedMapLayerDefinition {
  const field = `layers[${index}]`;

  if (!layer || typeof layer !== 'object') {
    throw new AtlasError('Invalid layer definition.', {
      code: 'INVALID_LAYER_DEFINITION',
      details: { field, value: layer },
    });
  }

  if (layer.id !== undefined && (typeof layer.id !== 'string' || !layer.id.trim())) {
    throw new AtlasError('Layer ID must be non-empty.', {
      code: 'INVALID_LAYER_ID',
      details: { field: `${field}.id`, id: layer.id },
    });
  }

  const id = layer.id ?? createId();
  const stackIndex = layer.stackIndex === undefined ? 0 : layer.stackIndex;
  validateNumber(`${field}.stackIndex`, stackIndex);
  const references = layer.objects === undefined ? [] : layer.objects;

  if (!Array.isArray(references)) {
    throw new AtlasError('Layer objects must be an array of IDs.', {
      code: 'INVALID_LAYER_OBJECTS',
      details: { field: `${field}.objects`, value: references },
    });
  }

  const objects = Array.from(references, (objectId: string, objectIndex) => {
    validateLayerObjectId(objectId, `${field}.objects[${objectIndex}]`);

    if (!rootIds.has(objectId)) {
      throw new AtlasError('Layer object reference must identify a root object.', {
        code: 'UNKNOWN_LAYER_OBJECT',
        details: { layerId: id, objectId, field: `${field}.objects[${objectIndex}]` },
      });
    }

    return objectId;
  });

  return Object.freeze({
    id,
    stackIndex,
    objects: Object.freeze([...new Set(objects)]),
    ...(layer.intersectionBounds === undefined
      ? {}
      : {
          intersectionBounds: resolveIntersectionBounds(
            layer.intersectionBounds,
            `${field}.intersectionBounds`,
          ),
        }),
    ...(layer.background === undefined
      ? {}
      : { background: resolveBackground(layer.background, `${field}.background`) }),
  });
}

function resolveBackground(
  background: BackgroundDescription,
  field: string,
): BackgroundDescription {
  if (typeof background?.source !== 'string' || !background.source.trim()) {
    throw new AtlasError('Background source must be a non-empty image URL.', {
      code: 'INVALID_BACKGROUND_SOURCE',
      details: { field: `${field}.source`, value: background?.source },
    });
  }

  validateSize(`${field}.size`, background.size, { positive: true });

  return Object.freeze({
    source: background.source,
    size: new Size(background.size.width, background.size.height),
  });
}

/** Shared validation and copying for map loading and runtime additions. */
export function resolveMapEntry(object: MapEntryDefinition, field = 'object'): ResolvedMapEntry {
  const kind = object?.kind;

  if (!objectKinds.includes(kind)) {
    throw new AtlasError('Unsupported object kind.', {
      code: 'INVALID_OBJECT_KIND',
      details: { field: `${field}.kind`, kind },
    });
  }

  validateObjectId(`${field}.id`, object.id);

  if (object.kind === 'point') {
    validateMapPoint(field, object);

    return resolveMapPoint(object);
  }

  if (object.kind === 'line') {
    validateLinePoints(`${field}.points`, object.points);
  } else {
    validateMapPoints(`${field}.points`, object.points);
  }

  const id = object.id ?? createId();

  if (object.kind === 'route') {
    return Object.freeze({
      id,
      kind: 'route',
      points: resolveMapPoints(object.points),
    });
  }

  return Object.freeze({
    id,
    kind: object.kind,
    points: resolveMapPoints(object.points),
  });
}
