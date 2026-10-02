import { squaredDistanceToSegment } from '#math/distance.js';

import type { Camera } from '#camera/camera.js';
import type { Point } from '#math/point.js';
import type { AtlasObject } from '#objects/atlas-object.js';
import type { SceneGeometry } from './scene-geometry.js';

/** Spatial queries over scene geometry, independent of rendering and browser DOM. */
export class Spatial {
  readonly #geometry: SceneGeometry;

  constructor(geometry: SceneGeometry) {
    this.#geometry = geometry;
  }

  /** Flat-view picking, equivalent to a perpendicular ray with 2D composition order. */
  hitTest(point: Point, camera: Camera): AtlasObject | undefined {
    const { center, zoom, viewport } = camera;
    const x = (point.x - center.x) * zoom;
    const y = (point.y - center.y) * zoom;

    if (
      viewport.width <= 0 ||
      viewport.height <= 0 ||
      x < -viewport.width / 2 ||
      x >= viewport.width / 2 ||
      y < -viewport.height / 2 ||
      y >= viewport.height / 2
    ) {
      return undefined;
    }

    // Reverse composition order avoids scanning objects behind the first hit.
    for (let index = this.#geometry.objects.length - 1; index >= 0; index--) {
      const object = this.#geometry.objects.at(index);

      if (!object) {
        continue;
      }

      const { geometry } = object;

      if (geometry.kind === 'line') {
        const radius = this.#geometry.symbols.line.strokeWidth / (2 * zoom);

        if (squaredDistanceToSegment(point, geometry.start, geometry.end) <= radius * radius) {
          return object;
        }

        continue;
      }

      const { position } = geometry;
      const { radius, strokeWidth } = this.#geometry.symbols.point;
      const dx = (point.x - position.x) * zoom;
      const dy = (point.y - position.y) * zoom;
      const outerRadius = radius + strokeWidth / 2;

      if (dx * dx + dy * dy <= outerRadius * outerRadius) {
        return object;
      }
    }

    return undefined;
  }
}
