import { validateLinePoints } from '#validators/map-points.validator.js';

import { MapObject } from './map-object.js';
import { createMapPoints } from './map-point.js';

import type { MapLineDefinition } from '#definitions/map-line-definition.js';
import type { MapPoint } from './map-point.js';

/** An independent straight line derived from its two owned points. */
export class MapLine extends MapObject {
  readonly #points: readonly [MapPoint, MapPoint];

  constructor(id: string, points: MapLineDefinition['points']) {
    super(id);
    validateLinePoints('points', points);
    this.#points = createMapPoints(points);

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
