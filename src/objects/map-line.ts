import { resolveMapPoints, validateLinePoints } from '#validators/map-points.validator.js';
import { reserveObjectId } from '#validators/object-id.validator.js';

import { MapObject } from './map-object.js';
import { MapPoint } from './map-point.js';

import type { MapLineDefinition } from '#definitions/map-line-definition.js';

/** An independent straight line derived from its two owned points. */
export class MapLine extends MapObject {
  readonly #points: readonly [MapPoint, MapPoint];

  constructor(id: string, points: MapLineDefinition['points']) {
    super(id);
    validateLinePoints('points', points);
    const ids = new Set([id]);

    for (const [index, point] of points.entries()) {
      reserveObjectId(`points[${index}].id`, point.id, ids);
    }

    const [start, end] = resolveMapPoints(points, ids);
    this.#points = Object.freeze([new MapPoint(start), new MapPoint(end)]);

    for (const point of this.#points) {
      point.addEventListener('change', this.#pointChange);
    }
  }

  override get kind(): 'line' {
    return 'line';
  }

  get points(): readonly [MapPoint, MapPoint] {
    return this.#points;
  }

  readonly #pointChange = (): void => {
    this.dispatchEvent(new Event('change'));
  };
}
