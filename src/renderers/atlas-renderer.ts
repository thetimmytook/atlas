import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';

/** Prepared display content that can be applied after the load is accepted. */
export interface PreparedBackground {
  show(): void;
}

export abstract class AtlasRenderer {
  abstract prepareBackground(background: BackgroundDescription): Promise<PreparedBackground>;
  abstract render(viewport: Size, bounds: Rect): void;
}
