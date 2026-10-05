import { squaredDistanceToSegment } from '#math/distance.js';

import type { Camera } from '#camera/camera.js';
import type { Point } from '#math/point.js';
import type { Geometry } from './geometry.js';
import type { SceneGeometry, SceneObject, SceneSymbols } from './scene-geometry.js';

/** Spatial queries over scene geometry, independent of rendering and browser DOM. */
export class Spatial {
  readonly #geometry: SceneGeometry;

  constructor(geometry: SceneGeometry) {
    this.#geometry = geometry;
  }

  /** Flat-view picking, equivalent to a perpendicular ray with 2D composition order. */
  hitTest(point: Point, camera: Camera): SceneObject | undefined {
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
      const entry = this.#geometry.objects.at(index);

      if (!entry) {
        continue;
      }

      if (hitTestGeometry(point, entry.geometry, this.#geometry.symbols, zoom)) {
        return entry;
      }
    }

    return undefined;
  }
}

function hitTestGeometry(
  point: Point,
  geometry: Geometry,
  symbols: SceneSymbols,
  zoom: number,
): boolean {
  if (geometry.kind === 'point') {
    const { position } = geometry;
    const { radius, strokeWidth } = symbols.point;
    const dx = (point.x - position.x) * zoom;
    const dy = (point.y - position.y) * zoom;
    const outerRadius = radius + strokeWidth / 2;

    return dx * dx + dy * dy <= outerRadius * outerRadius;
  }

  const radius = symbols.line.strokeWidth / (2 * zoom);

  if (geometry.kind === 'line') {
    return squaredDistanceToSegment(point, geometry.start, geometry.end) <= radius * radius;
  }

  return geometry.points.some((end, index) => {
    const start = index > 0 ? geometry.points.at(index - 1) : undefined;

    return start !== undefined && squaredDistanceToSegment(point, start, end) <= radius * radius;
  });
}
