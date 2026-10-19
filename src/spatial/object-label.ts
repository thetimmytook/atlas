import type { Rect } from '#math/rect.js';
import type { SceneObject } from './scene-geometry.js';

/** Browser-measured visual data in CSS pixels relative to the attachment position. */
export interface ObjectLabel {
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
export interface ObjectLabelView {
  readonly revision: number;
  refresh(): void;
  forEntry(entry: SceneObject): ObjectLabel | undefined;
}
