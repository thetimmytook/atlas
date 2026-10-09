import type { Point2 } from '#math/point2.js';
import type { SurfaceInputDetail } from './camera-controls.js';

export type ClickTrigger = 'press' | 'release';

export interface MapSurfaceDetail extends SurfaceInputDetail {
  readonly mapPoint: Point2;
}

/** Pointer phases on the map surface, including its empty background. */
export class MapSurfaceEvent extends CustomEvent<MapSurfaceDetail> {
  constructor(type: ClickTrigger, mapPoint: Point2, input: SurfaceInputDetail) {
    super(type, {
      detail: Object.freeze({ ...input, mapPoint }),
      bubbles: true,
      composed: true,
    });
  }
}
