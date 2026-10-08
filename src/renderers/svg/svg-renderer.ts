import { Renderer } from '#renderers/renderer.js';
import { isLayerEligible } from '#spatial/scene-geometry.js';

import {
  applyGeometry,
  applyScreenScale,
  createObject,
  prepareImage,
} from './svg-renderer.utils.js';

import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { PreparedScene } from '#renderers/renderer.js';
import type { SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';
import type { SvgObject } from './svg-renderer.utils.js';

export class SvgRenderer extends Renderer {
  readonly #surface: SVGSVGElement;
  #objects: readonly SvgObject[] = [];
  #geometry: SceneGeometry | undefined;
  #layers = new Map<MapLayer, SVGGElement>();
  #visible = new Map<MapLayer, boolean>();
  #sources: readonly SceneObject[] = [];
  #bySource = new Map<SceneObject, SvgObject>();
  readonly #changed = new Set<SvgObject>();
  readonly #unpainted = new Set<SvgObject>();
  readonly #points = new Set<SvgObject>();
  #width: number | undefined;
  #height: number | undefined;
  #viewBox: string | undefined;
  #scale: number | undefined;

  constructor(surface: SVGSVGElement) {
    super();
    this.#surface = surface;
  }

  override async prepare(geometry: SceneGeometry): Promise<PreparedScene> {
    const layers = await Promise.all(
      geometry.layers.map(async layer => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        element.setAttribute('data-layer-id', layer.id);

        if (layer.background) {
          element.append(await prepareImage(layer.background, layer.id));
        }

        return [layer, element] as const;
      }),
    );
    const byLayer = new Map(layers);
    const sources = geometry.objects;
    const objects = sources.map(entry => createObject(entry, geometry.symbols));

    for (const object of objects) {
      byLayer.get(object.source.layer)!.append(object.element);
    }

    return {
      show: (): void => {
        this.#objects = objects;
        this.#geometry = geometry;
        this.#layers = byLayer;
        this.#visible.clear();
        this.#sources = sources;
        this.#bySource = new Map(objects.map(object => [object.source, object]));
        this.#changed.clear();
        this.#unpainted.clear();
        this.#points.clear();
        this.#scale = undefined;

        for (const object of objects) {
          this.#addObject(object);
        }

        this.#syncVisibility();
        this.#surface.replaceChildren(...byLayer.values());
      },
    };
  }

  override render(viewport: Size, bounds: Rect): void {
    if (viewport.width !== this.#width) {
      this.#surface.setAttribute('width', String(viewport.width));
      this.#width = viewport.width;
    }

    if (viewport.height !== this.#height) {
      this.#surface.setAttribute('height', String(viewport.height));
      this.#height = viewport.height;
    }

    this.#syncObjects();
    this.#syncVisibility();

    for (const source of this.#geometry?.takeChanges() ?? []) {
      const object = this.#bySource.get(source);

      if (object) {
        this.#changed.add(object);
      }
    }

    // Keep pending geometry and new-node visibility until a usable viewport returns.
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const viewBox = `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`;

    if (viewBox !== this.#viewBox) {
      this.#surface.setAttribute('viewBox', viewBox);
      this.#viewBox = viewBox;
    }

    const scale = bounds.width / viewport.width;
    const scaleChanged = scale !== this.#scale;

    if (scaleChanged) {
      for (const object of this.#points) {
        applyScreenScale(object.shape, 'point', scale);
      }

      this.#scale = scale;
    }

    this.#applyChangedGeometry(scaleChanged, scale);
  }

  #applyChangedGeometry(scaleChanged: boolean, scale: number): void {
    for (const object of this.#changed) {
      const { geometry } = object.source;
      applyGeometry(object.element, object.shape, geometry);

      if (this.#unpainted.delete(object)) {
        if (!scaleChanged) {
          applyScreenScale(object.shape, geometry.kind, scale);
        }

        object.element.removeAttribute('visibility');
      }
    }

    this.#changed.clear();
  }

  #addObject(object: SvgObject): void {
    this.#changed.add(object);
    this.#unpainted.add(object);

    if (object.source.geometry.kind === 'point') {
      this.#points.add(object);
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

    const previous = this.#bySource;
    this.#objects = sources.map(source => {
      const existing = previous.get(source);
      previous.delete(source);

      if (existing) {
        return existing;
      }

      const object = createObject(source, geometry.symbols);
      this.#addObject(object);

      return object;
    });

    for (const object of previous.values()) {
      object.element.remove();
      this.#changed.delete(object);
      this.#unpainted.delete(object);
      this.#points.delete(object);
    }

    this.#bySource = new Map(this.#objects.map(object => [object.source, object]));
    this.#sources = sources;
    const nextByLayer = new Map<MapLayer, SVGGElement>();

    // Insert new objects and vertices in composition order, reusing old nodes.
    for (let index = this.#objects.length - 1; index >= 0; index--) {
      const object = this.#objects.at(index)!;
      const layer = object.source.layer;
      const parent = this.#layers.get(layer)!;
      const next = nextByLayer.get(layer) ?? null;

      if (object.element.nextSibling !== next || object.element.parentNode !== parent) {
        parent.insertBefore(object.element, next);
      }

      nextByLayer.set(layer, object.element);
    }
  }

  #syncVisibility(): void {
    for (const [layer, element] of this.#layers) {
      const visible = isLayerEligible(layer);

      if (this.#visible.get(layer) === visible) {
        continue;
      }

      if (visible) {
        element.removeAttribute('display');
      } else {
        element.setAttribute('display', 'none');
      }

      this.#visible.set(layer, visible);
    }
  }
}
