import { Point } from '#math/point.js';
import { invalidateScenes } from '#spatial/scene-invalidation.js';
import { validateMapPoint } from '#validators/map-point.validator.js';
import { validatePoint } from '#validators/point.validator.js';

import { MapObject } from './map-object.js';

import type { MapLineDefinition } from '#definitions/map-line-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

/** A point with the same identity and behavior independently or within a route. */
export class MapPoint extends MapObject {
  #position: Point;

  constructor(definition: MapPointDefinition) {
    validateMapPoint('point', definition);
    super(definition.id, 'point.id');
    this.#position = new Point(definition.position.x, definition.position.y);
  }

  override get kind(): 'point' {
    return 'point';
  }

  get position(): Point {
    return this.#position;
  }

  set position(value: Point) {
    validatePoint('position', value);
    this.#position = new Point(value.x, value.y);
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
