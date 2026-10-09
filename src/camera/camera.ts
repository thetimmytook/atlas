import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';
import { validateNumber } from '#validators/number.validator.js';
import { validatePoint } from '#validators/point.validator.js';
import { validateSize } from '#validators/size.validator.js';

/** A 2D camera; zoom is CSS pixels per map unit. */
export class Camera extends EventTarget {
  #center: Point2 = new Point2(0, 0);
  #zoom = 1;
  #viewport: Size = new Size(0, 0);
  #pendingFit: Rect | undefined;

  get center(): Point2 {
    return this.#center;
  }

  set center(value: Point2) {
    validatePoint('center', value);
    this.#center = new Point2(value.x, value.y);
    this.#pendingFit = undefined;
    this.#notify();
  }

  get zoom(): number {
    return this.#zoom;
  }

  set zoom(value: number) {
    validateNumber('zoom', value, { positive: true });
    this.#zoom = value;
    this.#pendingFit = undefined;
    this.#notify();
  }

  get viewport(): Size {
    return this.#viewport;
  }

  get bounds(): Rect {
    const width = this.#viewport.width / this.#zoom;
    const height = this.#viewport.height / this.#zoom;

    return new Rect(this.#center.x - width / 2, this.#center.y - height / 2, width, height);
  }

  resize(size: Size): void {
    validateSize('viewport', size);
    const { width, height } = size;

    this.#viewport = new Size(width, height);

    if (this.#pendingFit && width > 0 && height > 0) {
      this.fit(this.#pendingFit);
    } else {
      this.#notify();
    }
  }

  fit(bounds: Rect): void {
    validatePoint('bounds', bounds);
    validateSize('bounds', bounds, { positive: true });
    this.#center = new Point2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    if (this.#viewport.width > 0 && this.#viewport.height > 0) {
      this.#zoom = Math.min(
        this.#viewport.width / bounds.width,
        this.#viewport.height / bounds.height,
      );
      this.#pendingFit = undefined;
    } else {
      this.#pendingFit = new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    this.#notify();
  }

  #notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
