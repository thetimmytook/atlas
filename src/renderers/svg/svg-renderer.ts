import { Renderer } from '#renderers/renderer.js';

import {
  applyGeometry,
  applyScreenScale,
  createObject,
  prepareImage,
} from './svg-renderer.utils.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { PreparedScene } from '#renderers/renderer.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';
import type { SvgObject } from './svg-renderer.utils.js';

export class SvgRenderer extends Renderer {
  readonly #surface: SVGSVGElement;
  #objects: readonly SvgObject[] = [];

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepare(
    background: BackgroundDescription,
    geometry: SceneGeometry,
  ): Promise<PreparedScene> {
    const image = await prepareImage(background);
    const objects = geometry.objects.map(object => createObject(object, geometry.symbols));

    return {
      show: (): void => {
        this.#objects = objects;
        this.#surface.replaceChildren(image, ...objects.map(object => object.element));
      },
    };
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
    const scale = bounds.width / viewport.width;

    for (const entry of this.#objects) {
      const { geometry } = entry.object;
      applyGeometry(entry.element, entry.shape, geometry);
      applyScreenScale(entry.shape, geometry.kind, scale);
      entry.element.removeAttribute('visibility');
    }
  }
}
