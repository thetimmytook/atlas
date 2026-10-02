import type { Point } from '#math/point.js';
import type { SurfaceInputDetail } from './camera-controls.js';

export type ClickTrigger = 'press' | 'release';

export interface MapSurfaceDetail extends SurfaceInputDetail {
  readonly mapPoint: Point;
}

/** Pointer phases on the map surface, including its empty background. */
export class MapSurfaceEvent extends CustomEvent<MapSurfaceDetail> {
  constructor(type: ClickTrigger, mapPoint: Point, input: SurfaceInputDetail) {
    super(type, {
      detail: Object.freeze({ ...input, mapPoint }),
      bubbles: true,
      composed: true,
    });
  }
}
