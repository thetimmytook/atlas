import { AtlasError } from '#errors/atlas-error.js';
import { prepareGeometry } from '#validators/geometry.validator.js';

import type { PointGeometry } from '#definitions/object-definition.js';

/** Runtime map object; changes notify its consumer without depending on a renderer. */
export class AtlasObject extends EventTarget {
  readonly #id: string;
  #geometry: PointGeometry;

  constructor(id: string, geometry: PointGeometry) {
    super();

    if (typeof id !== 'string' || !id.trim()) {
      throw new AtlasError('Object ID must be non-empty.', {
        code: 'INVALID_OBJECT_ID',
        details: { id },
      });
    }

    this.#id = id;
    this.#geometry = prepareGeometry('geometry', geometry);
  }

  get id(): string {
    return this.#id;
  }

  get geometry(): PointGeometry {
    return this.#geometry;
  }

  set geometry(value: PointGeometry) {
    this.#geometry = prepareGeometry('geometry', value);
    this.dispatchEvent(new Event('change'));
  }
}
