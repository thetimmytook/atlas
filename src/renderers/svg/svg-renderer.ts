import { AtlasRenderer } from '../atlas-renderer.js';

import { prepareImage } from './svg-renderer.utils.js';

import type { BackgroundDescription } from '../../definitions/map-definition.js';
import type { PreparedBackground } from '../atlas-renderer.js';

export class SvgRenderer extends AtlasRenderer {
  readonly #surface: SVGSVGElement;
  #background: BackgroundDescription | undefined;
  #width = 0;
  #height = 0;
  #scale: number | undefined;

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepareBackground(background: BackgroundDescription): Promise<PreparedBackground> {
    const image = await prepareImage(background);

    return { show: () => this.#show(background, image) };
  }

  #show(background: BackgroundDescription, image: SVGImageElement): void {
    this.#background = background;
    this.#scale = undefined;
    this.#surface.replaceChildren(image);
    this.#updateView();
  }

  override resize(width: number, height: number): void {
    this.#width = width;
    this.#height = height;
    this.#surface.setAttribute('width', String(width));
    this.#surface.setAttribute('height', String(height));
    this.#updateView();
  }

  #updateView(): void {
    const background = this.#background;

    if (!background || this.#width <= 0 || this.#height <= 0) {
      return;
    }

    this.#scale ??= Math.min(this.#width / background.width, this.#height / background.height);
    const width = this.#width / this.#scale;
    const height = this.#height / this.#scale;
    const x = (background.width - width) / 2;
    const y = (background.height - height) / 2;
    this.#surface.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }
}
