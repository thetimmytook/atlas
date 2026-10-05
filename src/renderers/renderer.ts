import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';

/** Prepared display content that can be applied after the load is accepted. */
export interface PreparedScene {
  show(): void;
}

export abstract class Renderer {
  abstract prepare(
    background: BackgroundDescription,
    geometry: SceneGeometry,
  ): Promise<PreparedScene>;
  abstract render(viewport: Size, bounds: Rect): void;
}
