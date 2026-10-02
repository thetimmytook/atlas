import type { Point } from '#math/point.js';
import type { AtlasObject } from '#objects/atlas-object.js';

export interface ObjectClickDetail {
  readonly object: AtlasObject;
  readonly mapPoint: Point;
  readonly clientPoint: Point;
}

/** Application-facing click/tap; Atlas does not create selection state or UI. */
export class ObjectClickEvent extends CustomEvent<ObjectClickDetail> {
  constructor(object: AtlasObject, mapPoint: Point, clientPoint: Point) {
    super('objectclick', {
      detail: Object.freeze({ object, mapPoint, clientPoint }),
      bubbles: true,
      composed: true,
    });
  }
}
