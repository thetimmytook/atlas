/** Immutable coordinates; cameras and surface coordinates use only x/y. */
export class Point {
  readonly x: number;
  readonly y: number;
  readonly z?: number;

  constructor(x: number, y: number, z?: number) {
    this.x = x;
    this.y = y;

    if (z !== undefined) {
      this.z = z;
    }

    Object.freeze(this);
  }
}
