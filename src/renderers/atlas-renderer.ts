import type { BackgroundDescription } from '../definitions/map-definition.js';

/** Prepared display content that can be applied after the load is accepted. */
export interface PreparedBackground {
  show(): void;
}

export abstract class AtlasRenderer {
  abstract prepareBackground(background: BackgroundDescription): Promise<PreparedBackground>;
  abstract resize(width: number, height: number): void;
}
