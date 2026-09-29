import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { MapObjects } from '#objects/map-objects.js';

/** Prepared display content that can be applied after the load is accepted. */
export interface PreparedScene {
  show(): void;
}

export abstract class AtlasRenderer {
  abstract prepare(background: BackgroundDescription, objects: MapObjects): Promise<PreparedScene>;
  abstract render(viewport: Size, bounds: Rect): void;
}
