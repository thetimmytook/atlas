import { resolveMapPoints, validateMapPoints } from '#validators/map-points.validator.js';
import { reserveObjectId } from '#validators/object-id.validator.js';

import { MapObject } from './map-object.js';
import { MapPoint } from './map-point.js';

import type { MapRouteDefinition } from '#definitions/map-route-definition.js';

/** A route owns a connected polyline and its identifiable points. */
export class MapRoute extends MapObject {
  readonly #points: readonly MapPoint[];

  constructor(id: string, points: MapRouteDefinition['points']) {
    super(id);
    validateMapPoints('points', points);
    const ids = new Set([id]);

    for (const [index, point] of points.entries()) {
      reserveObjectId(`points[${index}].id`, point.id, ids);
    }

    const resolved = resolveMapPoints(points, ids);
    this.#points = Object.freeze(resolved.map(point => new MapPoint(point)));

    for (const point of this.#points) {
      point.addEventListener('change', this.#pointChange);
    }
  }

  override get kind(): 'route' {
    return 'route';
  }

  get points(): readonly MapPoint[] {
    return this.#points;
  }

  readonly #pointChange = (): void => {
    this.dispatchEvent(new Event('change'));
  };
}
