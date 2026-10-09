import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { AtlasError } from '#errors/atlas-error.js';
import { CameraControls } from '#interaction/camera-controls.js';
import { MapCoordinates } from '#interaction/map-coordinates.js';
import { MapSurfaceEvent } from '#interaction/map-surface-event.js';
import { ObjectClickEvent } from '#interaction/object-click-event.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';

import html from './map-element.html?raw';

import type { MapDefinition, ResolvedMapDefinition } from '#definitions/map-definition.js';
import type { SurfaceInputDetail } from '#interaction/camera-controls.js';
import type { ClickTrigger } from '#interaction/map-surface-event.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapObjectCollection } from '#objects/map-object-collection.js';
import type { Renderer } from '#renderers/renderer.js';

export class MapElement extends HTMLElement {
  readonly #coordinates: MapCoordinates;
  readonly #controls: CameraControls;
  readonly #camera = new Camera();
  #renderFrame: number | undefined;
  #batchDepth = 0;
  #renderPending = false;
  readonly #renderer: Renderer;
  #model = new MapModel();
  #clickTrigger: ClickTrigger = 'release';
  #loading = false;
  #resizeObserver: ResizeObserver | undefined;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
    const surface = shadow.querySelector('svg');

    if (!surface) {
      throw new Error('MapElement template must contain an SVG surface.');
    }

    this.#renderer = new SvgRenderer(surface);
    this.#coordinates = new MapCoordinates(surface, this.#camera);
    this.#controls = new CameraControls(surface, this.#camera, this.#coordinates);
  }

  get camera(): Camera {
    return this.#camera;
  }

  get coordinates(): MapCoordinates {
    return this.#coordinates;
  }

  get clickTrigger(): ClickTrigger {
    return this.#clickTrigger;
  }

  set clickTrigger(value: ClickTrigger) {
    if (value !== 'press' && value !== 'release') {
      throw new AtlasError('Click trigger must be press or release.', {
        code: 'INVALID_CLICK_TRIGGER',
        details: { value },
      });
    }

    if (value === this.#clickTrigger) {
      return;
    }

    this.#clickTrigger = value;
    this.#controls.cancelClick();
  }

  fit(): void {
    const size = this.#model.layers.reduce(
      (result, layer) => ({
        width: Math.max(result.width, layer.background?.size.width ?? 0),
        height: Math.max(result.height, layer.background?.size.height ?? 0),
      }),
      { width: 0, height: 0 },
    );

    if (size.width === 0 || size.height === 0) {
      return;
    }

    const { width, height } = size;
    this.#camera.fit(new Rect(0, 0, width, height));
  }

  get objects(): MapObjectCollection {
    return this.#model.objects;
  }

  get layers(): readonly MapLayer[] {
    return this.#model.layers;
  }

  get definition(): ResolvedMapDefinition | undefined {
    return this.#model.definition;
  }

  /**
   * Group synchronous edits while deferring only this map's rendering.
   * Returned thenables are rejected after invocation; successful edits are not rolled back.
   */
  batch(callback: () => void): void {
    if (typeof callback !== 'function') {
      throw new AtlasError('Batch callback must be a function.', {
        code: 'INVALID_BATCH_CALLBACK',
        details: { receivedType: typeof callback },
      });
    }

    this.#batchDepth++;

    try {
      const result: unknown = callback();

      if (
        result !== null &&
        (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as { then?: unknown }).then === 'function'
      ) {
        throw new AtlasError('Batch callback must be synchronous.', {
          code: 'ASYNC_BATCH_CALLBACK',
        });
      }
    } finally {
      this.#batchDepth--;

      if (this.#batchDepth === 0 && this.#renderPending) {
        this.#requestRender();
      }
    }
  }

  async load(definition: MapDefinition): Promise<void> {
    if (this.#loading) {
      throw new AtlasError('A map load is already in progress.', {
        code: 'MAP_LOAD_IN_PROGRESS',
      });
    }

    this.#loading = true;

    try {
      const resolvedDefinition = resolveMapDefinition(definition);
      const model = new MapModel(resolvedDefinition);
      const scene = await this.#renderer.prepare(model.geometry);
      const previousModel = this.#model;
      scene.show();
      this.#model = model;
      this.#unobserveModel(previousModel);
      this.#controls.cancelClick();
      this.#observeModel();
      this.fit();
      this.#requestRender();
    } finally {
      this.#loading = false;
    }
  }

  connectedCallback(): void {
    if (this.#resizeObserver) {
      return;
    }

    this.#observeModel();
    this.#controls.addEventListener('press', this.#surfacePress);
    this.#controls.addEventListener('release', this.#surfaceRelease);
    this.#controls.connect();
    this.#camera.addEventListener('change', this.#requestRender);
    this.#requestRender();
    this.#resizeObserver = new ResizeObserver(entries => {
      if (!this.isConnected) {
        return;
      }

      for (const entry of entries) {
        this.#camera.resize(new Size(entry.contentRect.width, entry.contentRect.height));
      }
    });
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.#unobserveModel(this.#model);
    this.#controls.disconnect();
    this.#controls.removeEventListener('press', this.#surfacePress);
    this.#controls.removeEventListener('release', this.#surfaceRelease);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#camera.removeEventListener('change', this.#requestRender);

    if (this.#renderFrame !== undefined) {
      cancelAnimationFrame(this.#renderFrame);
      this.#renderFrame = undefined;
    }
  }

  readonly #surfacePress = (event: Event): void => {
    this.#surfaceEvent('press', event);
  };

  readonly #surfaceRelease = (event: Event): void => {
    this.#surfaceEvent('release', event);
  };

  #surfaceEvent(type: ClickTrigger, event: Event): void {
    if (!this.#coordinates.available) {
      return;
    }

    const input = (event as CustomEvent<SurfaceInputDetail>).detail;
    const mapPoint = this.#coordinates.clientToMap(input.clientPoint);
    const shouldClick =
      this.#clickTrigger === type &&
      (type === 'press' ? this.#controls.canClickOnPress : input.isClick === true);

    // The pre-load collection is available, but has no prepared display to pick.
    const hit =
      shouldClick && this.#model.definition
        ? this.#model.spatial.hitTest(mapPoint, this.#camera)
        : undefined;
    const model = this.#model;

    this.dispatchEvent(new MapSurfaceEvent(type, mapPoint, input));

    // A surface listener may disconnect the component, replace its map, or remove the hit.
    if (
      !hit ||
      !this.isConnected ||
      this.#model !== model ||
      this.#clickTrigger !== type ||
      (type === 'press' && !this.#controls.canClickOnPress) ||
      !model.spatial.hasHit(hit, mapPoint, this.#camera)
    ) {
      return;
    }

    if (type === 'press') {
      this.#controls.consumeGesture();
    }

    this.dispatchEvent(
      new ObjectClickEvent(hit.object, mapPoint, input.clientPoint, hit.layer, hit.route),
    );
  }

  #observeModel(): void {
    if (!this.isConnected) {
      return;
    }

    this.#model.addEventListener('change', this.#requestRender);
    this.#model.observeChanges();
  }

  #unobserveModel(model: MapModel): void {
    model.unobserveChanges();
    model.removeEventListener('change', this.#requestRender);
  }

  readonly #requestRender = (): void => {
    if (!this.isConnected) {
      return;
    }

    if (this.#batchDepth > 0) {
      this.#renderPending = true;

      return;
    }

    this.#renderPending = false;

    if (this.#renderFrame !== undefined) {
      return;
    }

    this.#renderFrame = requestAnimationFrame(() => {
      this.#renderFrame = undefined;
      this.#renderer.render(this.#camera.viewport, this.#camera.bounds);
    });
  };
}
