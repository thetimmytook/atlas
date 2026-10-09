import { Point2 } from '#math/point2.js';

import type { Camera } from '#camera/camera.js';
import type { MapCoordinates } from './map-coordinates.js';

export interface SurfaceInputDetail {
  readonly clientPoint: Point2;

  /** Present on release: whether this release can trigger an object click/tap. */
  readonly isClick?: boolean;
}

const WHEEL_LINE_PIXELS = 16;
const WHEEL_ZOOM_SPEED = 0.002;

// Temporary gesture threshold in client CSS pixels; replace with input configuration.
const DRAG_THRESHOLD = 5;

/** Browser input only; camera state and projection stay separate. */
export class CameraControls extends EventTarget {
  readonly #surface: Element;
  readonly #camera: Camera;
  readonly #coordinates: MapCoordinates;
  readonly #pointers = new Map<number, Point2>();
  #connection: AbortController | undefined;
  #press: { pointerId: number; origin: Point2 } | undefined;
  #gestureHandled = false;

  constructor(surface: Element, camera: Camera, coordinates: MapCoordinates) {
    super();
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
    this.#press = undefined;
    this.#gestureHandled = false;
  }

  cancelClick(): void {
    this.#press = undefined;
  }

  consumeGesture(): void {
    this.#gestureHandled = true;
    this.#press = undefined;
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
    const point = new Point2(event.clientX, event.clientY);
    this.#pointers.set(event.pointerId, point);
    this.#press =
      !this.#gestureHandled && this.#pointers.size === 1
        ? { pointerId: event.pointerId, origin: point }
        : undefined;

    this.dispatchEvent(
      new CustomEvent<SurfaceInputDetail>('press', {
        detail: { clientPoint: point },
      }),
    );

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

    if (this.#gestureHandled) {
      event.preventDefault();

      return;
    }

    if (this.#press) {
      const distance = Math.hypot(
        event.clientX - this.#press.origin.x,
        event.clientY - this.#press.origin.y,
      );

      if (distance <= DRAG_THRESHOLD) {
        return;
      }

      this.#press = undefined;
    }

    const before = this.#gesture();
    this.#pointers.set(event.pointerId, new Point2(event.clientX, event.clientY));
    const after = this.#gesture();

    if (before && after) {
      const factor =
        before.distance > 0 && after.distance > 0 ? after.distance / before.distance : 1;
      this.#moveAnchor(before.center, after.center, factor);
    }

    event.preventDefault();
  };

  readonly #pointerEnd = (event: Event): void => {
    if (!(event instanceof PointerEvent) || !this.#pointers.has(event.pointerId)) {
      return;
    }

    const press = this.#press;
    this.#press = undefined;
    this.#pointers.delete(event.pointerId);

    if (this.#pointers.size === 0) {
      this.#gestureHandled = false;
    }

    if (this.#surface.hasPointerCapture(event.pointerId)) {
      this.#surface.releasePointerCapture(event.pointerId);
    }

    if (event.type !== 'pointerup' || event.button !== 0 || !this.#coordinates.available) {
      return;
    }

    const isClick =
      press?.pointerId === event.pointerId &&
      Math.hypot(event.clientX - press.origin.x, event.clientY - press.origin.y) <= DRAG_THRESHOLD;
    this.dispatchEvent(
      new CustomEvent<SurfaceInputDetail>('release', {
        detail: {
          clientPoint: new Point2(event.clientX, event.clientY),
          isClick,
        },
      }),
    );
  };

  readonly #wheel = (event: Event): void => {
    if (!(event instanceof WheelEvent) || !this.#coordinates.available || event.deltaY === 0) {
      return;
    }

    if (this.#gestureHandled) {
      event.preventDefault();

      return;
    }

    this.#press = undefined;
    let unit = 1;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      unit = WHEEL_LINE_PIXELS;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      unit = this.#camera.viewport.height;
    }

    const delta = event.deltaY * unit;
    const factor = Math.exp(Math.max(-1, Math.min(1, -delta * WHEEL_ZOOM_SPEED)));
    const point = new Point2(event.clientX, event.clientY);
    this.#moveAnchor(point, point, factor);
    event.preventDefault();
  };

  #moveAnchor(from: Point2, to: Point2, factor: number): void {
    const zoom = this.#camera.zoom * factor;

    if (!Number.isFinite(zoom) || zoom <= 0) {
      return;
    }

    const anchor = this.#coordinates.clientToMap(from);

    if (zoom !== this.#camera.zoom) {
      this.#camera.zoom = zoom;
    }

    const target = this.#coordinates.clientToMap(to);
    this.#camera.center = new Point2(
      this.#camera.center.x + anchor.x - target.x,
      this.#camera.center.y + anchor.y - target.y,
    );
  }

  #gesture(): { center: Point2; distance: number } | undefined {
    const [first, second] = this.#pointers.values();

    if (!first) {
      return undefined;
    }

    if (!second) {
      return { center: first, distance: 0 };
    }

    return {
      center: new Point2((first.x + second.x) / 2, (first.y + second.y) / 2),
      distance: Math.hypot(second.x - first.x, second.y - first.y),
    };
  }
}
