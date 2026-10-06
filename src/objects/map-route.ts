import { validateMapPoints } from '#validators/map-points.validator.js';

import { MapObject } from './map-object.js';
import { createMapPoints, MapPoint } from './map-point.js';

import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapRouteDefinition } from '#definitions/map-route-definition.js';

/** A route owns a connected polyline and its identifiable points. */
export class MapRoute extends MapObject {
  #points: readonly MapPoint[];

  constructor(id: string, points: MapRouteDefinition['points']) {
    super(id);
    validateMapPoints('points', points);
    this.#points = createMapPoints(points);

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

  /** Append a copied definition; previously retained arrays keep their old membership. */
  addPoint(definition: MapPointDefinition): MapPoint {
    const point = new MapPoint(definition);
    point.addEventListener('change', this.#pointChange);
    this.#points = Object.freeze([...this.#points, point]);
    this.dispatchEvent(new Event('change'));

    return point;
  }

  readonly #pointChange = (): void => {
    this.dispatchEvent(new Event('change'));
  };
}
