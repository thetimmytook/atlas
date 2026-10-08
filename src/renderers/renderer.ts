import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';

/** Prepared display content that can be applied after the load is accepted. */
export interface PreparedScene {
  show(): void;
}

export abstract class Renderer {
  // Provisional single-view contract; automatic clipped appearances will extend scene preparation.
  abstract prepare(geometry: SceneGeometry): Promise<PreparedScene>;
  abstract render(viewport: Size, bounds: Rect): void;
}
