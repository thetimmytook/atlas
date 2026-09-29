import { Point } from '../math/point.js';

import type { MapCoordinates } from './map-coordinates.js';
import type { Camera } from '../camera/camera.js';

const WHEEL_LINE_PIXELS = 16;
const WHEEL_ZOOM_SPEED = 0.002;

/** Browser input only; camera state and projection stay separate. */
export class CameraControls {
  readonly #surface: Element;
  readonly #camera: Camera;
  readonly #coordinates: MapCoordinates;
  readonly #pointers = new Map<number, Point>();
  #connection: AbortController | undefined;

  constructor(surface: Element, camera: Camera, coordinates: MapCoordinates) {
    this.#surface = surface;
    this.#camera = camera;
    this.#coordinates = coordinates;
  }

  connect(): void {
    if (this.#connection) {
      return;
    }

    this.#connection = new AbortController();
    const options = { signal: this.#connection.signal };
    this.#surface.addEventListener('pointerdown', this.#pointerDown, options);
    this.#surface.addEventListener('pointermove', this.#pointerMove, options);
    this.#surface.addEventListener('pointerup', this.#pointerEnd, options);
    this.#surface.addEventListener('pointercancel', this.#pointerEnd, options);
    this.#surface.addEventListener('lostpointercapture', this.#pointerEnd, options);
    this.#surface.addEventListener('wheel', this.#wheel, { ...options, passive: false });
  }

  disconnect(): void {
    this.#connection?.abort();
    this.#connection = undefined;

    for (const id of this.#pointers.keys()) {
      if (this.#surface.hasPointerCapture(id)) {
        this.#surface.releasePointerCapture(id);
      }
    }

    this.#pointers.clear();
  }

  readonly #pointerDown = (event: Event): void => {
    if (
      !(event instanceof PointerEvent) ||
      event.button !== 0 ||
      this.#pointers.size >= 2 ||
      !this.#coordinates.available
    ) {
      return;
    }

    this.#surface.setPointerCapture(event.pointerId);
    this.#pointers.set(event.pointerId, new Point(event.clientX, event.clientY));
    event.preventDefault();
  };

  readonly #pointerMove = (event: Event): void => {
    if (!(event instanceof PointerEvent) || !this.#pointers.has(event.pointerId)) {
      return;
    }

    if (!this.#coordinates.available || (event.pointerType === 'mouse' && !(event.buttons & 1))) {
      this.#pointerEnd(event);

      return;
    }

    const before = this.#gesture();
    this.#pointers.set(event.pointerId, new Point(event.clientX, event.clientY));
    const after = this.#gesture();

    if (before && after) {
      const factor =
        before.distance > 0 && after.distance > 0 ? after.distance / before.distance : 1;
      this.#moveAnchor(before.center, after.center, factor);
    }

    event.preventDefault();
  };

  readonly #pointerEnd = (event: Event): void => {
    if (!(event instanceof PointerEvent)) {
      return;
    }

    this.#pointers.delete(event.pointerId);

    if (this.#surface.hasPointerCapture(event.pointerId)) {
      this.#surface.releasePointerCapture(event.pointerId);
    }
  };

  readonly #wheel = (event: Event): void => {
    if (!(event instanceof WheelEvent) || !this.#coordinates.available || event.deltaY === 0) {
      return;
    }

    let unit = 1;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      unit = WHEEL_LINE_PIXELS;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      unit = this.#camera.viewport.height;
    }

    const delta = event.deltaY * unit;
    const factor = Math.exp(Math.max(-1, Math.min(1, -delta * WHEEL_ZOOM_SPEED)));
    const point = new Point(event.clientX, event.clientY);
    this.#moveAnchor(point, point, factor);
    event.preventDefault();
  };

  #moveAnchor(from: Point, to: Point, factor: number): void {
    const zoom = this.#camera.zoom * factor;

    if (!Number.isFinite(zoom) || zoom <= 0) {
      return;
    }

    const anchor = this.#coordinates.clientToMap(from);

    if (zoom !== this.#camera.zoom) {
      this.#camera.zoom = zoom;
    }

    const target = this.#coordinates.clientToMap(to);
    this.#camera.center = new Point(
      this.#camera.center.x + anchor.x - target.x,
      this.#camera.center.y + anchor.y - target.y,
    );
  }

  #gesture(): { center: Point; distance: number } | undefined {
    const [first, second] = this.#pointers.values();

    if (!first) {
      return undefined;
    }

    if (!second) {
      return { center: first, distance: 0 };
    }

    return {
      center: new Point((first.x + second.x) / 2, (first.y + second.y) / 2),
      distance: Math.hypot(second.x - first.x, second.y - first.y),
    };
  }
}
