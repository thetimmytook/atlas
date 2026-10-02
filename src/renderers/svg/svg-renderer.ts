import { AtlasRenderer } from '#renderers/atlas-renderer.js';

import { createPoint, prepareImage } from './svg-renderer.utils.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { PreparedScene } from '#renderers/atlas-renderer.js';
import type { SceneGeometry, ScenePoint } from '#spatial/scene-geometry.js';

export class SvgRenderer extends AtlasRenderer {
  readonly #surface: SVGSVGElement;
  #points: readonly { point: ScenePoint; element: SVGGElement }[] = [];

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepare(
    background: BackgroundDescription,
    geometry: SceneGeometry,
  ): Promise<PreparedScene> {
    const image = await prepareImage(background);
    const points = geometry.points.map(point => ({
      point,
      element: createPoint(point),
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

    for (const { point, element } of this.#points) {
      element.setAttribute(
        'transform',
        `translate(${point.object.geometry.position.x} ${point.object.geometry.position.y}) scale(${scale})`,
      );
      element.removeAttribute('visibility');
    }
  }
}
