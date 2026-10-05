import { AtlasError } from '#errors/atlas-error.js';
import { Size } from '#math/size.js';
import { resolveObjectId } from '#objects/create-id.js';
import { resolveMapPoint, validateMapPoint } from '#validators/map-point.validator.js';
import {
  resolveMapPoints,
  validateLinePoints,
  validateMapPoints,
} from '#validators/map-points.validator.js';
import { reserveObjectId } from '#validators/object-id.validator.js';
import { validateSize } from '#validators/size.validator.js';

import type { WithId } from './identity.js';
import type { MapLineDefinition, ResolvedMapLineDefinition } from './map-line-definition.js';
import type { MapPointDefinition } from './map-point-definition.js';
import type { MapRouteDefinition, ResolvedMapRouteDefinition } from './map-route-definition.js';

export type MapEntryDefinition = MapLineDefinition | MapPointDefinition | MapRouteDefinition;
export type ResolvedMapEntry =
  ResolvedMapLineDefinition | WithId<MapPointDefinition> | ResolvedMapRouteDefinition;

export interface BackgroundDescription {
  readonly source: string;
  readonly size: Size;
}

/** Serializable map data for the background and object prototype. */
export interface MapDefinition {
  readonly background: BackgroundDescription;
  readonly objects?: readonly MapEntryDefinition[];
}

export interface ResolvedMapDefinition extends MapDefinition {
  readonly objects: readonly ResolvedMapEntry[];
}

const objectKinds: readonly MapEntryDefinition['kind'][] = ['line', 'route', 'point'];

/** Validate and copy input before asynchronous preparation starts. */
export function resolveMapDefinition(definition: MapDefinition): ResolvedMapDefinition {
  const { background } = definition;

  if (typeof background?.source !== 'string' || !background.source.trim()) {
    throw new AtlasError('Background source must be a non-empty image URL.', {
      code: 'INVALID_BACKGROUND_SOURCE',
      details: { field: 'background.source', value: background?.source },
    });
  }

  validateSize('background.size', background.size, { positive: true });

  const ids = new Set<string>();
  const definitions = definition.objects ?? [];

  for (const [index, object] of definitions.entries()) {
    const field = `objects[${index}]`;
    const kind = object?.kind;

    if (!objectKinds.includes(kind)) {
      throw new AtlasError('Unsupported object kind.', {
        code: 'INVALID_OBJECT_KIND',
        details: { field: `${field}.kind`, kind },
      });
    }

    reserveObjectId(`${field}.id`, object.id, ids);

    if (object.kind === 'point') {
      validateMapPoint(field, object);
      continue;
    }

    if (object.kind === 'line') {
      validateLinePoints(`${field}.points`, object.points);
    } else {
      validateMapPoints(`${field}.points`, object.points);
    }

    for (const [pointIndex, point] of object.points.entries()) {
      reserveObjectId(`${field}.points[${pointIndex}].id`, point.id, ids);
    }
  }

  const objects = definitions.map((object): ResolvedMapEntry => {
    if (object.kind === 'point') {
      return resolveMapPoint(object, ids);
    }

    const id = resolveObjectId(object.id, ids);

    if (object.kind === 'route') {
      return Object.freeze({
        id,
        kind: 'route',
        points: resolveMapPoints(object.points, ids),
      });
    }

    return Object.freeze({
      id,
      kind: object.kind,
      points: resolveMapPoints(object.points, ids),
    });
  });

  return Object.freeze({
    background: Object.freeze({
      ...background,
      size: new Size(background.size.width, background.size.height),
    }),
    objects: Object.freeze(objects),
  });
}
