import { AtlasError } from '#errors/atlas-error.js';
import { invalidateScenes } from '#spatial/scene-invalidation.js';
import {
  copyPolygonVertex,
  resolveMapPolygon,
  resolvePolygonContour,
  validatePolygonShape,
  validatePolygonVerticalState,
} from '#validators/map-polygon.validator.js';

import { MapObject } from './map-object.js';

import type { MapPolygonDefinition } from '#definitions/map-polygon-definition.js';
import type { Point2 } from '#math/point2.js';

/** A horizontal contour with coordinate vertices and a separately mutable vertical state. */
export class MapPolygon extends MapObject {
  #contour: readonly Point2[];
  #baseZ: number;
  #height: number;

  constructor(definition: MapPolygonDefinition) {
    const resolved = resolveMapPolygon(definition, 'polygon');
    super(resolved.id);
    this.#contour = resolved.contour;
    this.#baseZ = resolved.baseZ;
    this.#height = resolved.height;
  }

  override get kind(): 'polygon' {
    return 'polygon';
  }

  get contour(): readonly Point2[] {
    return this.#contour;
  }

  get baseZ(): number {
    return this.#baseZ;
  }

  set baseZ(value: number) {
    validatePolygonVerticalState(value, this.#height);

    if (value === this.#baseZ) {
      return;
    }

    this.#baseZ = value;
    this.#changed();
  }

  get height(): number {
    return this.#height;
  }

  set height(value: number) {
    validatePolygonVerticalState(this.#baseZ, value);

    if (value === this.#height) {
      return;
    }

    this.#height = value;
    this.#changed();
  }

  setVertex(index: number, position: Point2): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.#contour.length) {
      throw new AtlasError('Polygon vertex index must be an integer within contour bounds.', {
        code: 'INVALID_POLYGON_VERTEX_INDEX',
        details: { index, minimum: 0, maximum: this.#contour.length - 1 },
      });
    }

    const vertex = copyPolygonVertex(position, `contour[${index}]`);
    const contour = Object.freeze(
      this.#contour.map((point, current) => (current === index ? vertex : point)),
    );
    validatePolygonShape(contour, 'contour');
    this.#contour = contour;
    this.#changed();
  }

  setContour(value: readonly Point2[]): void {
    const contour = resolvePolygonContour(value, 'contour');
    this.#contour = contour;
    this.#changed();
  }

  #changed(): void {
    invalidateScenes(this);
    this.dispatchEvent(new Event('change'));
  }
}
