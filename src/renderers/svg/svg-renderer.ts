import { AtlasRenderer } from '#renderers/atlas-renderer.js';

import { createPoint, prepareImage } from './svg-renderer.utils.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { AtlasObject } from '#objects/atlas-object.js';
import type { MapObjects } from '#objects/map-objects.js';
import type { PreparedScene } from '#renderers/atlas-renderer.js';

export class SvgRenderer extends AtlasRenderer {
  readonly #surface: SVGSVGElement;
  #points: readonly { object: AtlasObject; element: SVGGElement }[] = [];

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepare(
    background: BackgroundDescription,
    objects: MapObjects,
  ): Promise<PreparedScene> {
    const image = await prepareImage(background);
    const points = Array.from(objects, object => ({
      object,
      element: createPoint(object),
    }));

    return {
      show: (): void => {
        this.#points = points;
        this.#surface.replaceChildren(image, ...points.map(point => point.element));
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

    for (const { object, element } of this.#points) {
      element.setAttribute(
        'transform',
        `translate(${object.geometry.position.x} ${object.geometry.position.y}) scale(${scale})`,
      );
      element.removeAttribute('visibility');
    }
  }
}
