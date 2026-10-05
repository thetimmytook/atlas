import type { Point } from '#math/point.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapRoute } from '#objects/map-route.js';

export interface ObjectClickDetail {
  readonly object: MapEntry;
  readonly route?: MapRoute;
  readonly mapPoint: Point;
  readonly clientPoint: Point;
}

/** Application-facing click/tap; Atlas does not create selection state or UI. */
export class ObjectClickEvent extends CustomEvent<ObjectClickDetail> {
  constructor(object: MapEntry, mapPoint: Point, clientPoint: Point, route?: MapRoute) {
    super('objectclick', {
      detail: Object.freeze({ object, mapPoint, clientPoint, ...(route ? { route } : {}) }),
      bubbles: true,
      composed: true,
    });
  }
}
