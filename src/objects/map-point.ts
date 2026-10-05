import { Point } from '#math/point.js';
import { resolveMapPoint, validateMapPoint } from '#validators/map-point.validator.js';
import { reserveObjectId } from '#validators/object-id.validator.js';
import { validatePoint } from '#validators/point.validator.js';

import { MapObject } from './map-object.js';

import type { MapPointDefinition } from '#definitions/map-point-definition.js';

/** A point with the same identity and behavior independently or within a route. */
export class MapPoint extends MapObject {
  #position: Point;

  constructor(definition: MapPointDefinition) {
    validateMapPoint('point', definition);
    const ids = new Set<string>();
    reserveObjectId('point.id', definition.id, ids);
    const point = resolveMapPoint(definition, ids);
    super(point.id);
    this.#position = point.position;
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
    this.dispatchEvent(new Event('change'));
  }
}
