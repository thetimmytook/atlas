/** An immutable pair of dimensions. */
export class Size {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    Object.freeze(this);
  }
}
