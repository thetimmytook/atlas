import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { AtlasError } from '#errors/atlas-error.js';
import { CameraControls } from '#interaction/camera-controls.js';
import { MapCoordinates } from '#interaction/map-coordinates.js';
import { MapSurfaceEvent } from '#interaction/map-surface-event.js';
import { ObjectClickEvent } from '#interaction/object-click-event.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import html from './map-element.html?raw';

import type { MapDefinition, ResolvedMapDefinition } from '#definitions/map-definition.js';
import type { SurfaceInputDetail } from '#interaction/camera-controls.js';
import type { ClickTrigger } from '#interaction/map-surface-event.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { Renderer } from '#renderers/renderer.js';

export class MapElement extends HTMLElement {
  readonly #coordinates: MapCoordinates;
  readonly #controls: CameraControls;
  readonly #camera = new Camera();
  #renderFrame: number | undefined;
  readonly #renderer: Renderer;
  #definition: ResolvedMapDefinition | undefined;
  #objects = new MapObjectCollection();
  #spatial: Spatial | undefined;
  #clickTrigger: ClickTrigger = 'release';
  #objectConnection: AbortController | undefined;
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
    if (!this.#definition) {
      return;
    }

    const { width, height } = this.#definition.background.size;
    this.#camera.fit(new Rect(0, 0, width, height));
  }

  get objects(): MapObjectCollection {
    return this.#objects;
  }

  get definition(): ResolvedMapDefinition | undefined {
    return this.#definition;
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
      const objects = new MapObjectCollection(resolvedDefinition.objects);
      const geometry = prepareSceneGeometry(objects);
      const spatial = new Spatial(geometry);
      const scene = await this.#renderer.prepare(resolvedDefinition.background, geometry);
      this.#objectConnection?.abort();
      scene.show();
      this.#objects = objects;
      this.#spatial = spatial;
      this.#controls.cancelClick();
      this.#definition = resolvedDefinition;
      this.#observeObjects();
      this.fit();
    } finally {
      this.#loading = false;
    }
  }

  connectedCallback(): void {
    if (this.#resizeObserver) {
      return;
    }

    this.#observeObjects();
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
    this.#objectConnection?.abort();
    this.#objectConnection = undefined;
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
    const shouldClick = this.#clickTrigger === type && (type === 'press' || input.isClick === true);
    const hit = shouldClick ? this.#spatial?.hitTest(mapPoint, this.#camera) : undefined;
    const objects = this.#objects;

    this.dispatchEvent(new MapSurfaceEvent(type, mapPoint, input));

    // A surface listener may disconnect the component or replace its map.
    if (!hit || !this.isConnected || this.#objects !== objects) {
      return;
    }

    if (type === 'press') {
      this.#controls.consumeGesture();
    }

    this.dispatchEvent(new ObjectClickEvent(hit.object, mapPoint, input.clientPoint, hit.route));
  }

  #observeObjects(): void {
    this.#objectConnection?.abort();

    if (!this.isConnected) {
      return;
    }

    this.#objectConnection = new AbortController();
    this.#objects.addEventListener('add', this.#objectAdded, {
      signal: this.#objectConnection.signal,
    });

    for (const object of this.#objects) {
      this.#observeObject(object);
    }
  }

  #observeObject(object: MapEntry): void {
    const connection = this.#objectConnection;

    if (!connection) {
      return;
    }

    object.addEventListener('change', this.#requestRender, { signal: connection.signal });
  }

  readonly #objectAdded = (event: Event): void => {
    this.#observeObject((event as CustomEvent<MapEntry>).detail);
    this.#requestRender();
  };

  readonly #requestRender = (): void => {
    if (!this.isConnected || this.#renderFrame !== undefined) {
      return;
    }

    this.#renderFrame = requestAnimationFrame(() => {
      this.#renderFrame = undefined;
      this.#renderer.render(this.#camera.viewport, this.#camera.bounds);
    });
  };
}
