import { Point3 } from '#math/point3.js';
import { invalidateScenes } from '#spatial/scene-invalidation.js';
import { validateMapPoint } from '#validators/map-point.validator.js';
import { validatePoint } from '#validators/point.validator.js';

import { MapObject } from './map-object.js';

import type { MapLineDefinition } from '#definitions/map-line-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { Point2 } from '#math/point2.js';

/** A point with the same identity and behavior independently or within a route. */
export class MapPoint extends MapObject {
  #position: Point3;

  constructor(definition: MapPointDefinition) {
    validateMapPoint('point', definition);
    super(definition.id, 'point.id');
    this.#position = new Point3(
      definition.position.x,
      definition.position.y,
      'z' in definition.position ? definition.position.z : undefined,
    );
  }

  override get kind(): 'point' {
    return 'point';
  }

  get position(): Point3 {
    return this.#position;
  }

  set position(value: Point2 | Point3) {
    validatePoint('position', value, { spatial: true });
    this.#position = new Point3(value.x, value.y, 'z' in value ? value.z : undefined);
    invalidateScenes(this);
    this.dispatchEvent(new Event('change'));
  }
}

/** Copy owned points, generating IDs only where the definitions omit them. */
export function createMapPoints(points: MapLineDefinition['points']): readonly [MapPoint, MapPoint];
export function createMapPoints(points: readonly MapPointDefinition[]): readonly MapPoint[];

export function createMapPoints(points: readonly MapPointDefinition[]): readonly MapPoint[] {
  return Object.freeze(points.map(point => new MapPoint(point)));
}
