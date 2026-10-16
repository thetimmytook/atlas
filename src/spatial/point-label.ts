import type { Rect } from '#math/rect.js';
import type { SceneObject } from './scene-geometry.js';

/** Browser-measured visual data in CSS pixels relative to the point coordinate. */
export interface PointLabel {
  readonly text: string;
  readonly color: string;
  readonly family: string;
  readonly size: number;
  readonly weight: 'normal' | 'bold';
  readonly bounds: Rect;
  readonly x: number;
  readonly y: number;
}

/** Internal single-view bridge. Spatial consumes only neutral measured rectangles. */
export interface PointLabelView {
  readonly revision: number;
  refresh(): void;
  forEntry(entry: SceneObject): PointLabel | undefined;
}
