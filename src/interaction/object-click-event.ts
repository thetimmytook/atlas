import type { Point2 } from '#math/point2.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapRoute } from '#objects/map-route.js';

export interface ObjectClickDetail {
  readonly object: MapEntry;
  readonly layer: MapLayer;
  readonly route?: MapRoute;
  readonly mapPoint: Point2;
  readonly clientPoint: Point2;
}

/** Application-facing click/tap; Atlas does not create selection state or UI. */
export class ObjectClickEvent extends CustomEvent<ObjectClickDetail> {
  constructor(
    object: MapEntry,
    mapPoint: Point2,
    clientPoint: Point2,
    layer: MapLayer,
    route?: MapRoute,
  ) {
    super('objectclick', {
      detail: Object.freeze({ object, layer, mapPoint, clientPoint, ...(route ? { route } : {}) }),
      bubbles: true,
      composed: true,
    });
  }
}
