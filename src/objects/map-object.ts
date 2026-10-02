import { AtlasError } from '#errors/atlas-error.js';
import { prepareGeometry } from '#validators/geometry.validator.js';

import type { ObjectGeometry } from '#definitions/object-definition.js';

/** Runtime map object; changes notify its consumer without depending on a renderer. */
export class MapObject extends EventTarget {
  readonly #id: string;
  #geometry: ObjectGeometry;

  constructor(id: string, geometry: ObjectGeometry) {
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

  get geometry(): ObjectGeometry {
    return this.#geometry;
  }

  /** Replace coordinates within the primitive kind chosen at construction. */
  set geometry(value: ObjectGeometry) {
    const geometry = prepareGeometry('geometry', value);

    if (geometry.kind !== this.#geometry.kind) {
      throw new AtlasError('Object geometry kind cannot change.', {
        code: 'GEOMETRY_KIND_CHANGE',
        details: { id: this.#id, expected: this.#geometry.kind, received: geometry.kind },
      });
    }

    this.#geometry = geometry;
    this.dispatchEvent(new Event('change'));
  }
}
