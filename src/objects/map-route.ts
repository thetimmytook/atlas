import { AtlasError } from '#errors/atlas-error.js';
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
    return this.insertPoint(this.#points.length, definition);
  }

  /** Insert a copied point before index; the array length appends it. */
  insertPoint(index: number, definition: MapPointDefinition): MapPoint {
    if (!Number.isInteger(index) || index < 0 || index > this.#points.length) {
      throw new AtlasError('Route point index must be an integer within insertion bounds.', {
        code: 'INVALID_ROUTE_POINT_INDEX',
        details: { field: 'index', index, minimum: 0, maximum: this.#points.length },
      });
    }

    const point = new MapPoint(definition);
    point.addEventListener('change', this.#pointChange);
    this.#points = Object.freeze([
      ...this.#points.slice(0, index),
      point,
      ...this.#points.slice(index),
    ]);
    this.dispatchEvent(new Event('change'));

    return point;
  }

  /** Remove this exact owned point; retained references remain functional. */
  removePoint(point: MapPoint): boolean {
    if (!this.#points.includes(point)) {
      return false;
    }

    this.#points = Object.freeze(this.#points.filter(entry => entry !== point));
    point.removeEventListener('change', this.#pointChange);
    this.dispatchEvent(new Event('change'));

    return true;
  }

  /** Replace [startIndex, endIndex) with copied points and return the new instances. */
  replacePoints(
    startIndex: number,
    endIndex: number,
    definitions: readonly MapPointDefinition[],
  ): readonly MapPoint[] {
    if (
      !Number.isInteger(startIndex) ||
      !Number.isInteger(endIndex) ||
      startIndex < 0 ||
      startIndex > endIndex ||
      endIndex > this.#points.length
    ) {
      throw new AtlasError('Route point range must use integers within replacement bounds.', {
        code: 'INVALID_ROUTE_POINT_RANGE',
        details: { startIndex, endIndex, minimum: 0, maximum: this.#points.length },
      });
    }

    validateMapPoints('definitions', definitions);
    const points = createMapPoints(definitions);

    if (startIndex === endIndex && points.length === 0) {
      return points;
    }

    const removed = this.#points.slice(startIndex, endIndex);
    this.#points = Object.freeze([
      ...this.#points.slice(0, startIndex),
      ...points,
      ...this.#points.slice(endIndex),
    ]);

    for (const point of removed) {
      point.removeEventListener('change', this.#pointChange);
    }

    for (const point of points) {
      point.addEventListener('change', this.#pointChange);
    }

    this.dispatchEvent(new Event('change'));

    return points;
  }

  readonly #pointChange = (): void => {
    this.dispatchEvent(new Event('change'));
  };
}
