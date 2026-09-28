import { AtlasRenderer } from '../atlas-renderer.js';

import { prepareImage } from './svg-renderer.utils.js';

import type { BackgroundDescription } from '../../definitions/map-definition.js';
import type { Rect } from '../../math/rect.js';
import type { Size } from '../../math/size.js';
import type { PreparedBackground } from '../atlas-renderer.js';

export class SvgRenderer extends AtlasRenderer {
  readonly #surface: SVGSVGElement;

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepareBackground(background: BackgroundDescription): Promise<PreparedBackground> {
    const image = await prepareImage(background);

    return { show: () => this.#surface.replaceChildren(image) };
  }

  override render(viewport: Size, bounds: Rect): void {
    this.#surface.setAttribute('width', String(viewport.width));
    this.#surface.setAttribute('height', String(viewport.height));

    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    this.#surface.setAttribute(
      'viewBox',
      `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
    );
  }
}
