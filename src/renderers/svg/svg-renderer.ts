import { Renderer } from '#renderers/renderer.js';
import { isLayerEligible } from '#spatial/scene-geometry.js';

import {
  applyGeometry,
  applyLabel,
  applyAppearance,
  applyScreenScale,
  createObject,
  prepareImage,
} from './svg-renderer.utils.js';

import type { Rect } from '#math/rect.js';
import type { Size } from '#math/size.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { PreparedScene } from '#renderers/renderer.js';
import type { ObjectLabelView } from '#spatial/object-label.js';
import type { SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';
import type { SvgObject } from './svg-renderer.utils.js';

export class SvgRenderer extends Renderer {
  readonly #surface: SVGSVGElement;
  readonly #labels: ObjectLabelView | undefined;
  #labelRevision: number | undefined;
  readonly #labelChanges = new Set<SvgObject>();
  #objects: readonly SvgObject[] = [];
  #geometry: SceneGeometry | undefined;
  #layers = new Map<MapLayer, SVGGElement>();
  #visible = new Map<MapLayer, boolean>();
  #sources: readonly SceneObject[] = [];
  #bySource = new Map<SceneObject, SvgObject>();
  readonly #geometryChanges = new Set<SvgObject>();
  readonly #appearanceChanges = new Set<SvgObject>();
  readonly #unpainted = new Set<SvgObject>();
  readonly #points = new Set<SvgObject>();
  #width: number | undefined;
  #height: number | undefined;
  #viewBox: string | undefined;
  #scale: number | undefined;

  constructor(surface: SVGSVGElement, labels?: ObjectLabelView) {
    super();
    this.#surface = surface;
    this.#labels = labels;
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
    const objects = sources.map(entry => createObject(entry, geometry.appearanceFor(entry)));

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
        this.#geometryChanges.clear();
        this.#appearanceChanges.clear();
        this.#labelChanges.clear();
        this.#labelRevision = undefined;
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
    this.#labels?.refresh();

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

    this.#collectChanges();

    // Keep both pending change kinds and new-node visibility until a usable viewport returns.
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
      this.#applyCameraScale(scale);
      this.#scale = scale;
    }

    this.#applyChanges(scaleChanged, scale);
  }

  #applyCameraScale(scale: number): void {
    for (const object of this.#points) {
      if (!isLayerEligible(object.source.layer)) {
        continue;
      }

      applyScreenScale(object.shape, 'point', scale);
    }

    // Label translation stays in map units; typography and offset stay in screen units.
    for (const object of this.#objects) {
      if (object.label && isLayerEligible(object.source.layer)) {
        this.#labelChanges.add(object);
      }
    }
  }

  #collectChanges(): void {
    const changes = this.#geometry?.takeChanges();

    for (const source of changes?.geometry ?? []) {
      const object = this.#bySource.get(source);

      if (object) {
        this.#geometryChanges.add(object);
        this.#labelChanges.add(object);
      }
    }

    for (const source of changes?.appearance ?? []) {
      const object = this.#bySource.get(source);

      if (object) {
        this.#appearanceChanges.add(object);
        this.#labelChanges.add(object);
      }
    }

    for (const source of changes?.labels ?? []) {
      const object = this.#bySource.get(source);

      if (object) {
        this.#labelChanges.add(object);
      }
    }

    if (this.#labels && this.#labels.revision !== this.#labelRevision) {
      this.#objects.forEach(object => this.#labelChanges.add(object));
      this.#labelRevision = this.#labels.revision;
    }
  }

  #applyChanges(scaleChanged: boolean, scale: number): void {
    for (const object of this.#appearanceChanges) {
      const appearance = this.#geometry!.appearanceFor(object.source);
      const replaced = appearance !== object.appearance && applyAppearance(object, appearance);

      if (replaced) {
        applyScreenScale(object.shape, object.source.geometry.kind, scale);
      }
    }

    for (const object of this.#geometryChanges) {
      applyGeometry(object.element, object.shape, object.source.geometry);
    }

    for (const object of this.#labelChanges) {
      applyLabel(
        object,
        this.#labels?.forEntry(object.source),
        this.#geometry!.labelPositionFor(object.source),
        scale,
      );
    }

    for (const object of this.#unpainted) {
      if (!scaleChanged || !isLayerEligible(object.source.layer)) {
        applyScreenScale(object.shape, object.source.geometry.kind, scale);
      }

      object.element.removeAttribute('visibility');
    }

    this.#geometryChanges.clear();
    this.#appearanceChanges.clear();
    this.#labelChanges.clear();
    this.#unpainted.clear();
  }

  #addObject(object: SvgObject): void {
    this.#geometryChanges.add(object);
    this.#unpainted.add(object);
    this.#labelChanges.add(object);

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

    const ownerNodes = new Map<MapLayer, Map<MapEntry, SvgObject>>();

    for (const object of this.#objects) {
      if (object.source.object.kind === 'point') {
        continue;
      }

      const byOwner = ownerNodes.get(object.source.layer) ?? new Map<MapEntry, SvgObject>();
      byOwner.set(object.source.object, object);
      ownerNodes.set(object.source.layer, byOwner);
    }

    const previous = this.#bySource;
    this.#objects = sources.map(source => {
      const existing =
        previous.get(source) ??
        (source.object.kind === 'polygon'
          ? ownerNodes.get(source.layer)?.get(source.object)
          : undefined);

      if (existing) {
        previous.delete(existing.source);

        // Direct/clipped polygon views replace scene entries, while the owner remains displayed.
        if (existing.source !== source) {
          existing.source = source;
          this.#geometryChanges.add(existing);
          this.#appearanceChanges.add(existing);
          this.#labelChanges.add(existing);
        }

        return existing;
      }

      const object = createObject(source, geometry.appearanceFor(source));
      this.#addObject(object);

      return object;
    });

    // Fragment slots can change while their owner/layer label survives.
    for (const object of this.#objects) {
      const oldHost = ownerNodes.get(object.source.layer)?.get(object.source.object);

      if (oldHost?.label && oldHost !== object && geometry.labelPositionFor(object.source)) {
        object.label = oldHost.label;
        delete oldHost.label;
        object.element.append(object.label);
        this.#labelChanges.add(object);
      }
    }

    for (const object of previous.values()) {
      object.element.remove();
      this.#geometryChanges.delete(object);
      this.#appearanceChanges.delete(object);
      this.#labelChanges.delete(object);
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
        // Reuse first-paint work: hidden camera updates were skipped. Resolve current
        // symbols/labels even when this render keeps the renderer-wide scale.
        for (const object of this.#objects) {
          if (object.source.layer === layer) {
            this.#unpainted.add(object);
            this.#labelChanges.add(object);
          }
        }

        element.removeAttribute('display');
      } else {
        element.setAttribute('display', 'none');
      }

      this.#visible.set(layer, visible);
    }
  }
}
