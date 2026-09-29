import { Camera } from '#camera/camera.js';
import { prepareMapDefinition } from '#definitions/map-definition.js';
import { AtlasError } from '#errors/atlas-error.js';
import { CameraControls } from '#interaction/camera-controls.js';
import { MapCoordinates } from '#interaction/map-coordinates.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';

import html from './atlas-map.html?raw';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { AtlasRenderer } from '#renderers/atlas-renderer.js';

export class AtlasMap extends HTMLElement {
  readonly #coordinates: MapCoordinates;
  readonly #controls: CameraControls;
  readonly #camera = new Camera();
  #renderFrame: number | undefined;
  readonly #renderer: AtlasRenderer;
  #definition: MapDefinition | undefined;
  #loading = false;
  #resizeObserver: ResizeObserver | undefined;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
    const surface = shadow.querySelector('svg');

    if (!surface) {
      throw new Error('AtlasMap template must contain an SVG surface.');
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

  fit(): void {
    if (!this.#definition) {
      return;
    }

    const { width, height } = this.#definition.background;
    this.#camera.fit(new Rect(0, 0, width, height));
  }

  get definition(): MapDefinition | undefined {
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
      const preparedDefinition = prepareMapDefinition(definition);
      const background = await this.#renderer.prepareBackground(preparedDefinition.background);
      background.show();
      this.#definition = preparedDefinition;
      this.fit();
    } finally {
      this.#loading = false;
    }
  }

  connectedCallback(): void {
    if (this.#resizeObserver) {
      return;
    }

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
    this.#controls.disconnect();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#camera.removeEventListener('change', this.#requestRender);

    if (this.#renderFrame !== undefined) {
      cancelAnimationFrame(this.#renderFrame);
      this.#renderFrame = undefined;
    }
  }

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
