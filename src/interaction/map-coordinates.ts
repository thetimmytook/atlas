import { AtlasError } from '#errors/atlas-error.js';
import { Point2 } from '#math/point2.js';
import { validatePoint } from '#validators/point.validator.js';

import type { Camera } from '#camera/camera.js';

/** Converts map coordinates to browser client coordinates for an axis-aligned viewport. */
export class MapCoordinates {
  readonly #surface: Element;
  readonly #camera: Camera;

  constructor(surface: Element, camera: Camera) {
    this.#surface = surface;
    this.#camera = camera;
  }

  get available(): boolean {
    const rect = this.#surface.getBoundingClientRect();

    return (
      this.#surface.isConnected &&
      rect.width > 0 &&
      rect.height > 0 &&
      this.#camera.viewport.width > 0 &&
      this.#camera.viewport.height > 0
    );
  }

  mapToClient(point: Point2): Point2 {
    validatePoint('point', point);
    const rect = this.#getRect();
    const { center, zoom, viewport } = this.#camera;

    return new Point2(
      rect.left + (((point.x - center.x) * zoom) / viewport.width + 0.5) * rect.width,
      rect.top + (((point.y - center.y) * zoom) / viewport.height + 0.5) * rect.height,
    );
  }

  clientToMap(point: Point2): Point2 {
    validatePoint('point', point);
    const rect = this.#getRect();
    const { center, zoom, viewport } = this.#camera;

    return new Point2(
      center.x + (((point.x - rect.left) / rect.width - 0.5) * viewport.width) / zoom,
      center.y + (((point.y - rect.top) / rect.height - 0.5) * viewport.height) / zoom,
    );
  }

  #getRect(): DOMRect {
    if (!this.available) {
      throw new AtlasError('Coordinate conversion requires a visible viewport.', {
        code: 'VIEWPORT_UNAVAILABLE',
      });
    }

    return this.#surface.getBoundingClientRect();
  }
}
