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
import type { SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';
import type { SvgObject } from './svg-renderer.utils.js';

export class SvgRenderer extends Renderer {
  readonly #surface: SVGSVGElement;
  #objects: readonly SvgObject[] = [];
  #geometry: SceneGeometry | undefined;
  #sources: readonly SceneObject[] = [];

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepare(
    background: BackgroundDescription,
    geometry: SceneGeometry,
  ): Promise<PreparedScene> {
    const image = await prepareImage(background);
    const sources = geometry.objects;
    const objects = sources.map(entry => createObject(entry, geometry.symbols));

    return {
      show: (): void => {
        this.#objects = objects;
        this.#geometry = geometry;
        this.#sources = sources;
        this.#surface.replaceChildren(image, ...objects.map(object => object.element));
      },
    };
  }

  override render(viewport: Size, bounds: Rect): void {
    this.#surface.setAttribute('width', String(viewport.width));
    this.#surface.setAttribute('height', String(viewport.height));
    this.#syncObjects();

    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    this.#surface.setAttribute(
      'viewBox',
      `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
    );
    const scale = bounds.width / viewport.width;

    for (const entry of this.#objects) {
      const { geometry } = entry.source;
      applyGeometry(entry.element, entry.shape, geometry);
      applyScreenScale(entry.shape, geometry.kind, scale);
      entry.element.removeAttribute('visibility');
    }
  }

  #syncObjects(): void {
    const geometry = this.#geometry;

    if (!geometry) {
      return;
    }

    const sources = geometry.objects;

    if (sources === this.#sources) {
      return;
    }

    const previous = new Map(this.#objects.map(object => [object.source, object]));
    this.#objects = sources.map(source => {
      const object = previous.get(source) ?? createObject(source, geometry.symbols);
      previous.delete(source);

      return object;
    });

    for (const object of previous.values()) {
      object.element.remove();
    }

    this.#sources = sources;
    let next: SVGGElement | null = null;

    // Insert new objects and vertices in composition order, reusing old nodes.
    for (let index = this.#objects.length - 1; index >= 0; index--) {
      const object = this.#objects.at(index)!;

      if (object.element.nextSibling !== next || object.element.parentNode !== this.#surface) {
        this.#surface.insertBefore(object.element, next);
      }

      next = object.element;
    }
  }
}
